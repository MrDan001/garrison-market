"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { put } from "@vercel/blob";
import { redirect } from "next/navigation";
import { createNotification } from "./notification.actions";
import { getActiveStoreId } from "./store-context";
import { assertSubscriptionActive, checkPlanLimit } from "./subscription-guard";

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

export async function submitDailyReport(authorId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.id !== authorId) throw new Error("Unauthorized");

  await assertSubscriptionActive(session.ownerId ?? session.id);

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { fullName: true, staffStoreId: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReportToday = await prisma.report.findFirst({
    where: { authorId, date: { gte: today } },
    orderBy: { date: 'desc' }
  });

  const salesStartTime = lastReportToday ? new Date(lastReportToday.date) : today;

  const recentSales = await prisma.order.findMany({
    where: { staffId: authorId, date: { gte: salesStartTime } },
    include: { items: { include: { inventory: true } } }
  });

  const allSoldItems = recentSales.flatMap((s: any) => s.items);
  const totalValue = recentSales.reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const cashTotal = recentSales
    .filter((s: any) => s.paymentMethod === "cash")
    .reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const transferTotal = recentSales
    .filter((s: any) => s.paymentMethod === "transfer")
    .reduce((sum: number, s: any) => sum + Number(s.total), 0);

  const newReport = await prisma.report.create({
    data: {
      totalSales: totalValue,
      cashTotal,
      transferTotal,
      notes: content && content.trim() !== "" ? content.trim() : "None",
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

  await createNotification({
    ownerId: session.ownerId!,
    recipientId: null,
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
      restockLevel: true,
      image: true,
      ownerId: true
    },
    orderBy: { name: "asc" }
  });

  return serializeData(data);
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
      ownerId: session.id,
      storeId: storeId ?? undefined,
    },
  });

  await createNotification({
    ownerId: session.id,
    recipientId: null,
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

  const imageUrl = formData.get("imageUrl") as string | null;
  if (imageUrl) {
    updateData.image = imageUrl;
  }

  // Snapshot stock before the edit so we can tell whether this update
  // crosses the restock threshold in either direction (going low, or
  // being restocked back to healthy) — owner-driven quantity edits
  // previously never generated any notification at all.
  const before = await prisma.inventory.findUnique({
    where: { id },
    select: { quantity: true, restockLevel: true, storeId: true },
  });

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
  buyerPhone?: string
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const saleOwnerScopeId = session.role === "owner" ? session.id : session.ownerId!;
  await assertSubscriptionActive(saleOwnerScopeId);

  const total = cartItems.reduce((sum: number, item: any) => sum + (Number(item.price) * item.qty), 0);

  for (const item of cartItems) {
    const inventory = await prisma.inventory.findUnique({
      where: { id: item.id }
    });

    if (!inventory) throw new Error(`Item ${item.id} not found.`);
    if (inventory.quantity < item.qty) {
      throw new Error(`Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}`);
    }
  }

  const cleanName = buyerName?.trim();
  const cleanPhone = buyerPhone?.trim();

  const saleOwnerId = session.role === 'owner' ? session.id : session.ownerId!;
  const saleStoreId = await getActiveStoreId();

  await prisma.order.create({
    data: {
      total: total,
      paymentMethod,
      buyerName: cleanName || "Walk-in Customer",
      buyerPhone: cleanPhone || null,
      ownerId: saleOwnerId,
      staffId: session.id,
      storeId: saleStoreId,
      items: {
        create: cartItems.map((item: any) => ({
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
        }))
      }
    }
  });

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

  for (const item of cartItems) {
    const before = await prisma.inventory.findUnique({ where: { id: item.id } });

    const updated = await prisma.inventory.update({
      where: { id: item.id },
      data: { quantity: { decrement: item.qty } }
    });

    if (
      before &&
      updated.restockLevel != null &&
      before.quantity > updated.restockLevel &&
      updated.quantity <= updated.restockLevel
    ) {
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

  revalidatePath("/staff/inventory");
  revalidatePath("/owner/dashboard");
  return { success: true };
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

  await createNotification({
    ownerId: report.ownerId,
    recipientId: null,
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

  const data = await prisma.order.findMany({
    where: { staffId: session.id },
    include: { items: { include: { inventory: true } } },
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

  if (!name?.trim()) return { success: false, error: "Store name is required." };

  await prisma.store.create({
    data: {
      name,
      phoneNumber: phoneNumber || null,
      address: address || null,
      city: city || null,
      state: state || null,
      productsSold: productsSold || null,
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