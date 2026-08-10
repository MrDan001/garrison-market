// FILE: apps/frontend/lib/business.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { put } from "@vercel/blob";
import { redirect } from "next/navigation";
import { createNotification } from "./notification.actions";
import { resolveOrCreateCustomer } from "./customer.actions";
import { getActiveStoreId } from "./store-context";
import { assertSubscriptionActive, checkPlanLimit } from "./subscription-guard";
import { awardXp } from "./rush.actions";
import { consumeStockBatchesFifo } from "./stock-batch.helpers";

// Deep sterilization helper to turn Decimals and Dates into safe primitives
function serializeData<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value && typeof value === "object" && value.constructor.name === "Decimal") {
        return Number(value);
      }
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );
}

// Reconciles a report's cash/transfer figures against money actually
// COLLECTED, not sale price. A part-payment sale only puts its amountPaid
// in the till at checkout time — the rest arrives later (possibly a
// different day, possibly logged by a different staff member) as a
// follow-up DebtPayment. Without this, a ₦97,000 sale where only ₦80,200
// was collected would report the full ₦97,000 as cash received, making
// the drawer look ₦16,800 short when nothing is actually missing — it's
// just still owed. totalSales / item breakdowns are untouched by any of
// this: goods sold is goods sold regardless of debt.
async function reconcileCashAndTransfer(
  recentSales: { total: any; paymentMethod: string; debt: { payments: { amount: any }[] } | null }[],
  authorId: number,
  salesStartTime: Date
) {
  let cashTotal = 0;
  let transferTotal = 0;
  let newDebtThisPeriod = 0;

  for (const sale of recentSales) {
    const saleTotal = Number(sale.total);
    // sale.debt.payments here is pre-filtered to isInitialPayment: true —
    // at most one row, the amount handed over at checkout itself.
    const collected = sale.debt
      ? (sale.debt.payments[0] ? Number(sale.debt.payments[0].amount) : 0)
      : saleTotal;

    if (sale.debt) newDebtThisPeriod += saleTotal - collected;

    if (sale.paymentMethod === "cash") cashTotal += collected;
    else if (sale.paymentMethod === "transfer") transferTotal += collected;
  }

  // Follow-up debt repayments this staff member logged in the same
  // window — these are real money landing in the till today even though
  // they belong to a sale from a previous report period.
  const followUpPayments = await prisma.debtPayment.findMany({
    where: { staffId: authorId, isInitialPayment: false, createdAt: { gte: salesStartTime } },
  });
  let followUpTotal = 0;
  for (const p of followUpPayments) {
    const amt = Number(p.amount);
    followUpTotal += amt;
    if (p.paymentMethod === "cash") cashTotal += amt;
    else if (p.paymentMethod === "transfer") transferTotal += amt;
  }

  return { cashTotal, transferTotal, newDebtThisPeriod, followUpTotal };
}

// Builds the debt-related lines appended to a report's notes so the owner
// isn't left wondering why cash/transfer totals don't match the sum of
// sale prices — purely informational, doesn't affect any stored total.
function buildDebtNotes(newDebtThisPeriod: number, followUpTotal: number): string[] {
  const notes: string[] = [];
  if (newDebtThisPeriod > 0) {
    notes.push(`₦${newDebtThisPeriod.toLocaleString()} of today's sales is still owed by customers (part payments) — see Debtors.`);
  }
  if (followUpTotal > 0) {
    notes.push(`₦${followUpTotal.toLocaleString()} collected today from previous debtors.`);
  }
  return notes;
}

export async function submitDailyReport(authorId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.id !== authorId) throw new Error("Unauthorized");

  await assertSubscriptionActive(session.ownerId ?? session.id);

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { fullName: true, staffStoreId: true },
  });

  const store = author?.staffStoreId
    ? await prisma.store.findUnique({ where: { id: author.staffStoreId }, select: { storeType: true } })
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReportToday = await prisma.report.findFirst({
    where: { authorId, date: { gte: today } },
    orderBy: { date: 'desc' }
  });

  const salesStartTime = lastReportToday ? new Date(lastReportToday.date) : today;

  // ============================================================
  // Scale stores: reports are itemized per PRODUCT, not per sale —
  // "Rice: 12kg — ₦24,000" — so sales since the last report get
  // grouped by product before being written as ScaleReportItem rows.
  // ============================================================
  if (store?.storeType === "scale") {
    const recentSales = await prisma.order.findMany({
      where: { staffId: authorId, date: { gte: salesStartTime } },
      include: {
        scaleItems: { include: { scaleInventory: true } },
        debt: { include: { payments: { where: { isInitialPayment: true } } } },
      },
    });

    const allSoldScaleItems = recentSales.flatMap((s) => s.scaleItems);
    const totalValue = recentSales.reduce((sum, s) => sum + Number(s.total), 0);
    const { cashTotal, transferTotal, newDebtThisPeriod, followUpTotal } =
      await reconcileCashAndTransfer(recentSales, authorId, salesStartTime);

    const grouped = new Map<number, { name: string; unit: string; qty: number; total: number }>();
    for (const item of allSoldScaleItems) {
      const key = item.scaleInventoryId;
      const qty = Number(item.quantityInBaseUnit);
      const total = Number(item.priceAtTime);
      const existing = grouped.get(key);
      if (existing) {
        existing.qty += qty;
        existing.total += total;
      } else {
        grouped.set(key, {
          name: item.scaleInventory?.name ?? "Unknown Item",
          unit: item.scaleInventory?.unit ?? "",
          qty,
          total,
        });
      }
    }

    const baseNote = content && content.trim() !== "" ? content.trim() : null;
    const debtNotes = buildDebtNotes(newDebtThisPeriod, followUpTotal);

    const newReport = await prisma.report.create({
      data: {
        totalSales: totalValue,
        cashTotal,
        transferTotal,
        notes: [baseNote, ...debtNotes].filter(Boolean).join("\n") || "None",
        status: "pending",
        authorId,
        ownerId: session.ownerId!,
        storeId: author?.staffStoreId ?? undefined,
        scaleItems: {
          create: Array.from(grouped.entries()).map(([scaleInventoryId, g]) => ({
            scaleInventoryId,
            name: g.name,
            quantitySold: g.qty,
            unit: g.unit,
            totalPrice: g.total,
          })),
        },
      },
    });

    const submittedAt = new Date(newReport.date).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // recipientId targeted at the owner specifically (not null/broadcast) —
    // this used to go out with recipientId: null, which getNotificationsForStaff
    // treats as "visible to everyone under this owner", so every staff member
    // (including whoever just submitted) saw "X submitted a report" in their
    // own notification feed. Staff should only ever hear back once their
    // report is approved/declined (see updateReportStatus below), never on
    // submission itself.
    await createNotification({
      ownerId: session.ownerId!,
      recipientId: session.ownerId!,
      storeId: author?.staffStoreId ?? null,
      type: "report_submitted",
      message: `${author?.fullName || "A staff member"} submitted a daily report on ${submittedAt}.`,
      link: "/owner/report",
    });

    revalidatePath("/staff/report");
    revalidatePath("/owner/dashboard");
    return { success: true };
  }

  // Standard-store branch. If the owner has scaleConsignmentEnabled on
  // (admin override), this staff member may ALSO have live sales against
  // consigned scale stock today — those get grouped by product, same as
  // the native-scale-store branch above, and folded into this same report
  // alongside their regular list-inventory sales.
  const recentSales = await prisma.order.findMany({
    where: { staffId: authorId, date: { gte: salesStartTime } },
    include: {
      items: { include: { inventory: true } },
      scaleItems: { include: { scaleInventory: true } },
      debt: { include: { payments: { where: { isInitialPayment: true } } } },
    }
  });

  const allSoldItems = recentSales.flatMap((s: any) => s.items);
  const allSoldScaleItems = recentSales.flatMap((s: any) => s.scaleItems);
  const totalValue = recentSales.reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const { cashTotal, transferTotal, newDebtThisPeriod, followUpTotal } =
    await reconcileCashAndTransfer(recentSales as any, authorId, salesStartTime);

  const groupedScale = new Map<number, { name: string; unit: string; qty: number; total: number }>();
  for (const item of allSoldScaleItems) {
    const key = item.scaleInventoryId;
    const qty = Number(item.quantityInBaseUnit);
    const total = Number(item.priceAtTime);
    const existing = groupedScale.get(key);
    if (existing) {
      existing.qty += qty;
      existing.total += total;
    } else {
      groupedScale.set(key, {
        name: item.scaleInventory?.name ?? "Unknown Item",
        unit: item.scaleInventory?.unit ?? "",
        qty,
        total,
      });
    }
  }

  const baseNote = content && content.trim() !== "" ? content.trim() : null;
  const debtNotes = buildDebtNotes(newDebtThisPeriod, followUpTotal);

  const newReport = await prisma.report.create({
    data: {
      totalSales: totalValue,
      cashTotal,
      transferTotal,
      notes: [baseNote, ...debtNotes].filter(Boolean).join("\n") || "None",
      status: "pending",
      authorId: authorId,
      ownerId: session.ownerId!,
      storeId: author?.staffStoreId ?? undefined,
      items: {
        create: allSoldItems.map((i: any) => ({
          inventoryId: i.inventoryId,
          name: i.inventory?.name ?? "Unknown Item",
          quantity: i.quantity,
          price: i.priceAtTime,
          total: Number(i.priceAtTime) * i.quantity,
          ...(i.discountValue
            ? {
                originalPrice: i.originalPrice,
                discountValue: i.discountValue,
                discountType: i.discountType,
                discountReason: i.discountReason,
              }
            : {}),
        })),
      },
      scaleItems: {
        create: Array.from(groupedScale.entries()).map(([scaleInventoryId, g]) => ({
          scaleInventoryId,
          name: g.name,
          quantitySold: g.qty,
          unit: g.unit,
          totalPrice: g.total,
        })),
      },
    },
  });

  const submittedAt = new Date(newReport.date).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // recipientId targeted at the owner specifically (not null/broadcast) —
  // this used to go out with recipientId: null, which getNotificationsForStaff
  // treats as "visible to everyone under this owner", so every staff member
  // (including whoever just submitted) saw "X submitted a report" in their
  // own notification feed. Staff should only ever hear back once their
  // report is approved/declined (see updateReportStatus below), never on
  // submission itself.
  await createNotification({
    ownerId: session.ownerId!,
    recipientId: session.ownerId!,
    storeId: author?.staffStoreId ?? null,
    type: "report_submitted",
    message: `${author?.fullName || "A staff member"} submitted a daily report on ${submittedAt}.`,
    link: "/owner/report",
  });

  revalidatePath("/staff/report");
  revalidatePath("/owner/dashboard");
  return { success: true };
}

export async function createOrderAction(inventoryId: number) {
  const session = await getSessionUser();
  if (!session || !session.ownerId) throw new Error("Unauthorized");

  // ADDED: this action creates a real order/sale — must be blocked once
  // the owner's subscription/trial has expired, same as processSaleAction.
  await assertSubscriptionActive(session.ownerId);

  const item = await prisma.inventory.findUnique({
    where: { id: inventoryId, ownerId: session.ownerId }
  });

  if (item && item.quantity > 0) {
    await prisma.order.create({
      data: {
        total: item.price,
        ownerId: session.ownerId,
        staffId: session.id,
        items: {
          create: {
            inventoryId: item.id,
            quantity: 1,
            priceAtTime: item.price
          }
        }
      },
    });

    await prisma.inventory.update({
      where: { id: inventoryId },
      data: { quantity: { decrement: 1 } }
    });

    revalidatePath("/staff/orders");
  }
}

export async function getInventoryForStaff() {
  const session = await getSessionUser();
  const targetOwnerId = session?.ownerId || (session?.role === 'owner' ? session.id : null);
  if (!targetOwnerId) throw new Error("Unauthorized");

  const storeId = await getActiveStoreId();

  const data = await prisma.inventory.findMany({
    where: {
      ownerId: targetOwnerId,
      ...(storeId ? { storeId } : {}),
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      costPrice: true,
      category: true,
      categoryId: true,
      categoryRef: { select: { name: true } },
      sku: true,
      trackExpiry: true,
      expiryDate: true,
      restockLevel: true,
      image: true,
      ownerId: true
    },
    orderBy: { name: "asc" }
  });

  const salesCounts = await prisma.orderItem.groupBy({
    by: ["inventoryId"],
    where: {
      inventory: {
        ownerId: targetOwnerId,
        ...(storeId ? { storeId } : {}),
      },
    },
    _sum: { quantity: true },
  });
  const salesMap = new Map<string | number, number>();
  salesCounts.forEach((s) => {
    salesMap.set(s.inventoryId, s._sum.quantity ?? 0);
  });

  const withCategoryName = data.map((item) => ({
    ...item,
    categoryName: item.categoryRef?.name ?? null,
    salesCount: salesMap.get(item.id) ?? 0,
  }));

  return serializeData(withCategoryName);
}

export async function addInventoryAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== 'owner') throw new Error("Unauthorized");

  // ADDED: this is a separate/legacy inventory-creation path from
  // addItemAction below — it was missing the subscription gate entirely,
  // meaning a locked-out owner could still add products through it.
  await assertSubscriptionActive(session.id);

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const price = parseFloat(formData.get("price") as string);

  await prisma.inventory.create({
    data: { name, quantity, price, ownerId: session.id }
  });

  revalidatePath("/owner/inventory");
}

export async function addItemAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  // Limit/subscription failures are expected, user-facing conditions, not
  // server faults — returned as data (not thrown) so Next.js doesn't redact
  // the message in production. Same pattern as createStoreAction.
  try {
    await assertSubscriptionActive(session.id);
  } catch (err: any) {
    return { success: false, error: err?.message || "Your trial or subscription has ended." };
  }
  const limitCheck = await checkPlanLimit(session.id, "products");
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason || "Plan limit reached." };
  }

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = (formData.get("category") as string) || null;
  const restockLevel = parseInt(formData.get("restockLevel") as string, 10);

  const imageUrl = (formData.get("imageUrl") as string) || null;
  const image2Url = (formData.get("image2Url") as string) || null;
  const image3Url = (formData.get("image3Url") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const sku = (formData.get("sku") as string)?.trim() || null;

  const categoryIdRaw = formData.get("categoryId") as string;
  let categoryId: number | null = categoryIdRaw ? parseInt(categoryIdRaw, 10) : null;
  if (categoryId != null && !isNaN(categoryId)) {
    // Only trust a categoryId that actually belongs to this owner — same
    // defensive check the expense category flow does at write time.
    const validCategory = await prisma.productCategory.findFirst({
      where: { id: categoryId, ownerId: session.id },
    });
    if (!validCategory) categoryId = null;
  } else {
    categoryId = null;
  }

  const trackExpiry = formData.get("trackExpiry") === "true";
  const expiryDateRaw = formData.get("expiryDate") as string;
  const expiryDate = trackExpiry && expiryDateRaw ? new Date(expiryDateRaw) : null;

  const storeId = await getActiveStoreId();

  const newItem = await prisma.inventory.create({
    data: {
      name,
      quantity,
      costPrice,
      price,
      category,
      restockLevel,
      image: imageUrl,
      image2: image2Url,
      image3: image3Url,
      description,
      sku,
      categoryId: categoryId ?? undefined,
      trackExpiry,
      expiryDate,
      ownerId: session.id,
      storeId: storeId ?? undefined,
    },
  });

  // A brand-new product's starting quantity is functionally its first
  // restock — give it a StockBatch immediately so the item's whole
  // lifetime is batch-tracked from day one, not just restocks going
  // forward. Skipped for a zero-quantity product (nothing was actually
  // added yet); the first real "Add Stock" will create batch #1 instead.
  if (quantity > 0) {
    await prisma.stockBatch.create({
      data: {
        inventoryId: newItem.id,
        ownerId: session.id,
        storeId: storeId ?? undefined,
        originalQty: quantity,
        remainingQty: quantity,
        costPrice: isNaN(costPrice) ? null : costPrice,
        sellingPriceAtTime: price,
        expiryDate,
        createdById: session.id,
      },
    });
  }

  await createNotification({
    ownerId: session.id,
    recipientId: null,
    storeId: storeId ?? null,
    type: "new_item",
    message: `${newItem.name} was added to inventory.`,
    link: "/staff/inventory",
  });

  // The low-stock check in processSaleAction only fires on the exact sale
  // that crosses the threshold, so an item added already at/below its own
  // restock level (or already at 0) would otherwise never trigger an alert.
  if (restockLevel != null && !isNaN(restockLevel) && newItem.quantity <= restockLevel) {
    await createNotification({
      ownerId: session.id,
      recipientId: null,
      storeId: storeId ?? null,
      type: "low_stock",
      message: newItem.quantity <= 0
        ? `${newItem.name} was added already out of stock.`
        : `${newItem.name} was added below its restock level (${newItem.quantity} left).`,
      link: "/staff/inventory",
    });
  }

  revalidatePath("/owner/inventory");
  return { success: true };
}

// Restocking an existing product — the "+ Add Stock" action. Unlike
// updateItemAction's quantity field (a raw override, for corrections),
// this always *adds* to what's there: it creates a new StockBatch dated
// today and increments Inventory.quantity by the same amount, so the
// item's total never drifts out of sync with the sum of its batches.
//
// costPrice/sellingPrice/expiryDate/paymentMethod are all optional and
// batch-specific — a restock priced differently from the last one (e.g.
// a supplier cost increase) doesn't touch older batches' snapshots, and
// omitting sellingPrice just carries the product's current price forward.
export async function addStockToInventoryAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  try {
    await assertSubscriptionActive(session.id);
  } catch (err: any) {
    return { success: false, error: err?.message || "Your trial or subscription has ended." };
  }

  const inventoryId = parseInt(formData.get("inventoryId") as string, 10);
  const quantity = parseInt(formData.get("quantity") as string, 10);
  if (isNaN(inventoryId) || isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Enter a valid quantity to add." };
  }

  const item = await prisma.inventory.findFirst({
    where: { id: inventoryId, ownerId: session.id },
  });
  if (!item) return { success: false, error: "Product not found." };

  const costPriceRaw = formData.get("costPrice") as string;
  const costPrice = costPriceRaw ? parseFloat(costPriceRaw) : null;

  const sellingPriceRaw = formData.get("sellingPrice") as string;
  const sellingPrice = sellingPriceRaw ? parseFloat(sellingPriceRaw) : Number(item.price);

  const expiryDateRaw = formData.get("expiryDate") as string;
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;

  const paymentMethod = (formData.get("paymentMethod") as string) || null;

  const [, updatedItem] = await prisma.$transaction([
    prisma.stockBatch.create({
      data: {
        inventoryId: item.id,
        ownerId: session.id,
        storeId: item.storeId ?? undefined,
        originalQty: quantity,
        remainingQty: quantity,
        costPrice: costPrice != null && !isNaN(costPrice) ? costPrice : undefined,
        sellingPriceAtTime: sellingPrice,
        expiryDate,
        paymentMethod,
        createdById: session.id,
      },
    }),
    prisma.inventory.update({
      where: { id: item.id },
      data: {
        quantity: { increment: quantity },
        // A restock at a new price becomes the product's current
        // headline price/cost going forward — older batches keep their
        // own snapshot regardless.
        ...(sellingPriceRaw ? { price: sellingPrice } : {}),
        ...(costPrice != null && !isNaN(costPrice) ? { costPrice } : {}),
      },
    }),
  ]);

  await createNotification({
    ownerId: session.id,
    recipientId: null,
    storeId: item.storeId ?? null,
    type: "restock",
    message: `${updatedItem.name} was restocked (+${quantity}, ${updatedItem.quantity} now available).`,
    link: "/staff/inventory",
  });

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function updateItemAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  // ADDED: editing existing products is still a mutation that should be
  // blocked once the subscription is locked.
  await assertSubscriptionActive(session.id);

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = formData.get("category") as string;
  const restockLevel = parseInt(formData.get("restockLevel") as string, 10);

  const updateData: any = { name, quantity, costPrice, price, category, restockLevel };

  const description = (formData.get("description") as string)?.trim();
  updateData.description = description || null;
  const sku = (formData.get("sku") as string)?.trim();
  updateData.sku = sku || null;

  const categoryIdRaw = formData.get("categoryId") as string;
  if (categoryIdRaw) {
    const parsedCategoryId = parseInt(categoryIdRaw, 10);
    if (!isNaN(parsedCategoryId)) {
      const validCategory = await prisma.productCategory.findFirst({
        where: { id: parsedCategoryId, ownerId: session.id },
      });
      updateData.categoryId = validCategory ? parsedCategoryId : null;
    } else {
      updateData.categoryId = null;
    }
  } else {
    updateData.categoryId = null;
  }

  const trackExpiry = formData.get("trackExpiry") === "true";
  updateData.trackExpiry = trackExpiry;
  const expiryDateRaw = formData.get("expiryDate") as string;
  updateData.expiryDate = trackExpiry && expiryDateRaw ? new Date(expiryDateRaw) : null;

  const imageUrl = formData.get("imageUrl") as string | null;
  if (imageUrl) {
    updateData.image = imageUrl;
  }
  const image2Url = formData.get("image2Url") as string | null;
  if (image2Url) {
    updateData.image2 = image2Url;
  }
  const image3Url = formData.get("image3Url") as string | null;
  if (image3Url) {
    updateData.image3 = image3Url;
  }

  // Snapshot stock before the edit so we can tell whether this update
  // crosses the restock threshold in either direction (going low, or
  // being restocked back to healthy) — owner-driven quantity edits
  // previously never generated any notification at all.
  const before = await prisma.inventory.findUnique({
    where: { id },
    select: { quantity: true, restockLevel: true, storeId: true, ownerId: true },
  });

  if (!before || before.ownerId !== session.id) throw new Error("Unauthorized");

  let updated;
  try {
    updated = await prisma.inventory.update({ where: { id }, data: updateData });
  } catch (dbError) {
    console.error("Database update failed:", dbError);
    throw dbError;
  }

  if (before && updated.restockLevel != null) {
    const wasLow = before.restockLevel != null && before.quantity <= before.restockLevel;
    const isLowNow = updated.quantity <= updated.restockLevel;

    if (!wasLow && isLowNow) {
      await createNotification({
        ownerId: session.id,
        recipientId: null,
        storeId: before.storeId ?? null,
        type: "low_stock",
        message: updated.quantity <= 0
          ? `${updated.name} is now out of stock.`
          : `${updated.name} is running low (${updated.quantity} left).`,
        link: "/staff/inventory",
      });
    } else if (wasLow && !isLowNow) {
      await createNotification({
        ownerId: session.id,
        recipientId: null,
        storeId: before.storeId ?? null,
        type: "restock",
        message: `${updated.name} was restocked (${updated.quantity} now available).`,
        link: "/staff/inventory",
      });
    }
  }

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function processSaleAction(
  cartItems: any[],
  paymentMethod: "cash" | "transfer",
  buyerName?: string,
  buyerPhone?: string,
  paymentStatus: "full" | "partial" = "full",
  amountPaid?: number
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const saleOwnerScopeId = session.role === "owner" ? session.id : session.ownerId!;
  await assertSubscriptionActive(saleOwnerScopeId);

  const saleOwnerId = session.role === 'owner' ? session.id : session.ownerId!;

  // Re-check discountEnabled server-side — the staff UI already hides the
  // discount option when it's off, but that's a client-side nicety, not a
  // guarantee against a tampered request. Mirrors the same check in
  // processScaleSaleAction.
  const ownerRecord = await prisma.user.findUnique({
    where: { id: saleOwnerId },
    select: { discountEnabled: true },
  });
  if (!ownerRecord?.discountEnabled) {
    for (const item of cartItems) {
      delete item.discountValue;
      delete item.discountType;
      delete item.discountReason;
      delete item.originalPrice;
    }
  }

  const total = cartItems.reduce((sum: number, item: any) => sum + (Number(item.price) * item.qty), 0);

  const cleanName = buyerName?.trim();
  const cleanPhone = buyerPhone?.trim();
  const saleStoreId = await getActiveStoreId();

  // A part payment always needs a real debtor to chase later — the owner
  // has to know WHO owes and how to reach them, unlike a normal walk-in
  // sale where name/phone are just a nicety. This is enforced here, not
  // only in the staff UI, for the same reason the discountEnabled check
  // above is re-done server-side.
  const isPartial = paymentStatus === "partial";
  if (isPartial) {
    if (!cleanName || !cleanPhone) {
      throw new Error("Customer name and phone number are required for a part payment.");
    }
    if (amountPaid == null || isNaN(amountPaid) || amountPaid < 0) {
      throw new Error("Enter a valid amount paid.");
    }
    if (amountPaid >= total) {
      throw new Error("Amount paid covers the full total — select \"Paid in full\" instead.");
    }
  }

  // Resolved outside the stock transaction below — it's an identity
  // lookup/write, not an inventory mutation, so it doesn't need the same
  // optimistic-lock protection the stock decrements do.
  const customerId = await resolveOrCreateCustomer({
    ownerId: saleOwnerId,
    storeId: saleStoreId,
    name: cleanName,
    phone: cleanPhone,
  });

  if (isPartial && !customerId) {
    // Shouldn't happen given the check above (name+phone guarantees a
    // customer row), but guards against resolveOrCreateCustomer's
    // storeId-missing fallback silently returning null.
    throw new Error("Couldn't link a customer for this part payment. Please try again.");
  }

  // Wrapped in a transaction with an optimistic-lock guard on each
  // decrement, so two near-simultaneous sales can't both read the same
  // stock level and jointly oversell past what's actually available.
  const createdOrder = await prisma.$transaction(async (tx) => {
    const inventoryRows = await tx.inventory.findMany({ where: { id: { in: cartItems.map((i) => i.id) } } });

    for (const item of cartItems) {
      const inventory = inventoryRows.find((r) => r.id === item.id);
      if (!inventory) throw new Error(`Item ${item.id} not found.`);
      if (inventory.quantity < item.qty) {
        throw new Error(`Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}`);
      }
    }

    const order = await tx.order.create({
      data: {
        total: total,
        paymentMethod,
        buyerName: cleanName || "Walk-in Customer",
        buyerPhone: cleanPhone || null,
        ownerId: saleOwnerId,
        staffId: session.id,
        storeId: saleStoreId,
        customerId,
      }
    });

    // Created one at a time (rather than the nested items: { create: [...] }
    // shorthand used before) so we have each OrderItem's own id in hand to
    // link it to the batch(es) it drew from below.
    const createdOrderItems = [];
    for (const item of cartItems) {
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          inventoryId: item.id,
          quantity: item.qty,
          priceAtTime: Number(item.price),
          ...(item.discountValue
            ? {
                originalPrice: Number(item.originalPrice),
                discountValue: Number(item.discountValue),
                discountType: item.discountType ?? null,
                discountReason: item.discountReason ?? null,
              }
            : {}),
        },
      });
      createdOrderItems.push(orderItem);
    }

    if (isPartial) {
      const debt = await tx.debt.create({
        data: {
          orderId: order.id,
          customerId: customerId!,
          ownerId: saleOwnerId,
          storeId: saleStoreId,
          totalAmount: total,
          amountPaid: amountPaid!,
          status: "owing",
        },
      });

      if (amountPaid! > 0) {
        await tx.debtPayment.create({
          data: {
            debtId: debt.id,
            amount: amountPaid!,
            paymentMethod,
            isInitialPayment: true,
            staffId: session.id,
          },
        });
      }
    }

    for (const item of cartItems) {
      const row = inventoryRows.find((r) => r.id === item.id)!;
      const updateResult = await tx.inventory.updateMany({
        where: { id: item.id, quantity: row.quantity },
        data: { quantity: { decrement: item.qty } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${row.name} was just sold by another request — please try again.`);
      }

      // FIFO batch attribution — best-effort, never blocks the sale (see
      // consumeStockBatchesFifo). The Inventory decrement above is what
      // actually gates whether the sale can happen at all.
      const orderItem = createdOrderItems.find((oi) => oi.inventoryId === item.id)!;
      const consumed = await consumeStockBatchesFifo(tx, item.id, item.qty);
      if (consumed.length > 0) {
        await tx.orderItemBatch.createMany({
          data: consumed.map((c) => ({
            orderItemId: orderItem.id,
            stockBatchId: c.stockBatchId,
            quantity: c.quantity,
          })),
        });
      }
    }

    return order;
  }, { maxWait: 10000, timeout: 20000 });

  const soldByStaff = session.role !== 'owner'
    ? await prisma.user.findUnique({ where: { id: session.id }, select: { fullName: true } })
    : null;

  const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(total);

  await createNotification({
    ownerId: saleOwnerId,
    recipientId: null,
    storeId: saleStoreId,
    type: "sale_made",
    message: soldByStaff?.fullName
      ? `${soldByStaff.fullName} made a sale of ${naira}.`
      : `A sale of ${naira} was made.`,
    link: "/owner/dashboard",
  });

  if (isPartial) {
    const owedNaira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(total - amountPaid!);
    await createNotification({
      ownerId: saleOwnerId,
      recipientId: null,
      storeId: saleStoreId,
      type: "debt_logged",
      message: soldByStaff?.fullName
        ? `${soldByStaff.fullName} logged a part payment — ${cleanName} still owes ${owedNaira}.`
        : `A part payment was logged — ${cleanName} still owes ${owedNaira}.`,
      link: "/owner/customers",
    });
  }

  for (const item of cartItems) {
    const updated = await prisma.inventory.findUnique({ where: { id: item.id } });
    if (!updated) continue;

    if (updated.restockLevel != null && updated.quantity <= updated.restockLevel) {
      await createNotification({
        ownerId: updated.ownerId,
        recipientId: null,
        storeId: saleStoreId,
        type: "low_stock",
        message: updated.quantity <= 0
          ? `${updated.name} is now out of stock.`
          : `${updated.name} is running low (${updated.quantity} left).`,
        link: "/staff/inventory",
      });
    }
  }

  // Rush XP — fire-and-forget, never allowed to affect the real sale.
  // awardXp() already catches its own errors internally.
  if (!saleStoreId) {
    throw new Error("saleStoreId is required");
  }
  await awardXp(session.id, saleStoreId, "SALE_COMPLETED", { orderId: createdOrder.id });
  revalidatePath("/staff/inventory");
  revalidatePath("/owner/dashboard");
  revalidatePath("/owner/customers");
  return { success: true, orderId: createdOrder.id };
}

export async function getStaffReports() {
  const session = await getSessionUser();
  if (!session) return [];

  try {
    const data = await prisma.report.findMany({
      where: {
        ...(session.role === 'staff'
          ? { authorId: session.id }
          : { ownerId: session.id })
      },
      include: {
        author: {
          select: { fullName: true, email: true, role: true }
        },
        items: true
      },
      orderBy: { date: 'desc' }
    });
    return serializeData(data);
  } catch (error) {
    console.error("Error fetching staff reports:", error);
    return [];
  }
}

export async function getTodaySales() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const data = await prisma.order.findMany({
    where: { staffId: session.id, date: { gte: startOfToday } },
    include: { items: { include: { inventory: true } } }
  });
  return serializeData(data);
}

export async function updateReportStatus(reportId: number, status: "approved" | "declined") {
  // FIXED: this function previously had NO authentication or ownership
  // check at all — any authenticated (or even just any) caller could
  // approve/decline an arbitrary report belonging to any owner. Added a
  // proper owner check, ownership verification, and subscription gate.
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await assertSubscriptionActive(session.id);

  const existingReport = await prisma.report.findUnique({
    where: { id: reportId },
    select: { ownerId: true },
  });
  if (!existingReport || existingReport.ownerId !== session.id) throw new Error("Unauthorized");

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: status }
  });

  await createNotification({
    ownerId: report.ownerId,
    recipientId: report.authorId,
    type: "report_status",
    message: `Your report was ${status}.`,
    link: "/staff/report",
  });

  revalidatePath("/owner/report");
}

export async function requestReportRevision(reportId: number, note: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");
  if (!note.trim()) throw new Error("Please explain what needs correcting");

  // ADDED: was missing the subscription gate other report-mutation
  // actions have.
  await assertSubscriptionActive(session.id);

  const existingReport = await prisma.report.findUnique({
    where: { id: reportId },
    select: { ownerId: true },
  });
  if (!existingReport || existingReport.ownerId !== session.id) throw new Error("Unauthorized");

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: "revision_requested", ownerNote: note.trim() },
  });

  await createNotification({
    ownerId: report.ownerId,
    recipientId: report.authorId,
    type: "report_status",
    message: "Your report was sent back — a correction is needed.",
    link: "/staff/report",
  });

  revalidatePath("/owner/report");
  revalidatePath("/staff/report");
  return { success: true };
}

export async function resubmitReportAction(reportId: number, clarification: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  if (!clarification.trim()) throw new Error("Please add a clarification note");

  // ADDED: staff resubmitting a report is still a mutation tied to the
  // owner's subscription status.
  await assertSubscriptionActive(session.ownerId ?? session.id);

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  if (report.authorId !== session.id) throw new Error("Unauthorized");
  if (report.status !== "revision_requested") throw new Error("This report isn't awaiting correction");

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: "pending",
      notes: `${report.notes}\n\n[Clarification]: ${clarification.trim()}`,
      ownerNote: null,
    },
  });

  // Same fix as submitDailyReport's report_submitted notifications above —
  // this is still a "staff submitted something" event, just on the
  // resubmit-after-correction path, so it gets the same owner-only targeting.
  await createNotification({
    ownerId: report.ownerId,
    recipientId: report.ownerId,
    type: "report_status",
    message: "A staff report was resubmitted with a clarification.",
    link: "/owner/report",
  });

  revalidatePath("/staff/report");
  revalidatePath("/owner/report");
  return { success: true };
}

export async function updateInventoryQuantity(id: number, change: number) {
  // FIXED: this function previously had NO authentication check at all —
  // any caller could adjust any inventory item's quantity for any store.
  // Added owner check, ownership verification, and subscription gate.
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await assertSubscriptionActive(session.id);

  const existingItem = await prisma.inventory.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!existingItem || existingItem.ownerId !== session.id) throw new Error("Unauthorized");

  await prisma.inventory.update({
    where: { id },
    data: { quantity: { increment: change } }
  });
  revalidatePath("/owner/inventory");
}

export async function getStaffOrderHistory() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  // Previously only fetched `items` (standard Inventory lines), so any
  // scale sale — including the scale half of a merged-cart order — never
  // showed up here at all. Both relations live on the same Order already;
  // this was purely a missing include.
  const data = await prisma.order.findMany({
    where: { staffId: session.id },
    include: {
      items: { include: { inventory: true } },
      scaleItems: { include: { scaleInventory: true } },
    },
    orderBy: { date: 'desc' },
    take: 100
  });
  return serializeData(data);
}

export async function createStoreAction(
  formData: FormData
): Promise<{ success: false; error: string } | void> {
  const session = await getSessionUser();
  if (!session?.email) return { success: false, error: "Unauthorized" };

  const user = await prisma.user.findUnique({ where: { email: session.email } });
  if (!user) return { success: false, error: "User not found." };

  // NOTE: assertSubscriptionActive/checkPlanLimit failures are expected,
  // user-facing conditions (trial ended, plan limit hit) — not server faults.
  // Next.js redacts *thrown* Server Action errors in production builds down
  // to a generic "Server Components render" message, so these are returned
  // as data instead of thrown, the same way registerStaffAction already does.
  try {
    await assertSubscriptionActive(user.id);
    } catch (err: any) {
    return { success: false, error: err?.message || "Your trial or subscription has ended." };
  }

  const limitCheck = await checkPlanLimit(user.id, "stores");
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason || "Plan limit reached." };
  }

  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const productsSold = formData.get("productsSold") as string;
  const storeType = formData.get("storeType") as string;

  // storeType is the first decision an owner makes for a store and is
  // permanent — validate it strictly before anything else.
  if (storeType !== "standard" && storeType !== "scale") {
    return { success: false, error: "Please choose how this store sells its products." };
  }

  if (!name?.trim()) return { success: false, error: "Store name is required." };

  await prisma.store.create({
    data: {
      name,
      phoneNumber: phoneNumber || null,
      address: address || null,
      city: city || null,
      state: state || null,
      productsSold: productsSold || null,
      storeType,
      ownerId: user.id,
    },
  });

  redirect("/owner/stores");
}

export async function deleteInventoryAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  // ADDED: deleting/archiving inventory is a mutation and should be
  // blocked once the subscription is locked.
  await assertSubscriptionActive(session.id);

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const item = await prisma.inventory.findUnique({ where: { id } });
  if (!item || item.ownerId !== session.id) throw new Error("Unauthorized");

  let archived = false;

  try {
    await prisma.inventory.delete({ where: { id } });
  } catch (error: any) {
    if (error.code === "P2003") {
      await prisma.inventory.update({
        where: { id },
        data: { quantity: 0 },
      });
      archived = true;
    } else {
      throw error;
    }
  }

  revalidatePath("/owner/inventory");
  return { success: true, archived };
}