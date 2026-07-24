"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { createNotification } from "./notification.actions";
import { getActiveStore } from "./store-context";
import { assertSubscriptionActive, checkPlanLimit } from "./subscription-guard";
import { convertToBaseUnit } from "./scale-units";

// ============================================================================
// Unit conversion — see lib/scale-units.ts. A ScaleInventory product is
// always stocked/reported in its fixed base unit ("kg" or "L"), set once at
// creation. Staff may enter sale/wastage amounts in the smaller counterpart
// unit too ("g" for kg, "ml" for L); convertToBaseUnit() below turns that
// back into the base unit before it touches ScaleInventory.quantity.
// ============================================================================

// ============================================================================
// CRUD actions
// ============================================================================

export async function addScaleItemAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  try {
    await assertSubscriptionActive(session.id);
  } catch (err: any) {
    return { success: false, error: err?.message || "Your trial or subscription has ended." };
  }

  // Products across BOTH Inventory and ScaleInventory count toward the same
  // plan limit — see the updated "products" branch in checkPlanLimit.
  const limitCheck = await checkPlanLimit(session.id, "products");
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason || "Plan limit reached." };
  }

  const activeStore = await getActiveStore();
  if (!activeStore || activeStore.storeType !== "scale") {
    return { success: false, error: "This action is only available for weight/volume stores." };
  }

  const name = formData.get("name") as string;
  const quantity = parseFloat(formData.get("quantity") as string);
  const unit = formData.get("unit") as string;
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = (formData.get("category") as string) || null;
  const restockLevelRaw = formData.get("restockLevel") as string;
  const restockLevel = restockLevelRaw ? parseFloat(restockLevelRaw) : null;
  const imageUrl = (formData.get("imageUrl") as string) || null;

  if (!name?.trim()) return { success: false, error: "Product name is required." };
  if (isNaN(quantity) || quantity < 0) return { success: false, error: "Enter a valid starting quantity." };
  if (unit !== "kg" && unit !== "L") return { success: false, error: "Choose a unit — kg or L." };
  if (isNaN(price) || price < 0) return { success: false, error: "Enter a valid selling price." };

  const newItem = await prisma.scaleInventory.create({
    data: {
      name: name.trim(),
      quantity,
      unit,
      costPrice: isNaN(costPrice) ? null : costPrice,
      price,
      category,
      restockLevel,
      image: imageUrl,
      ownerId: session.id,
      storeId: activeStore.id,
    },
  });

  await createNotification({
    ownerId: session.id,
    recipientId: null,
    storeId: activeStore.id,
    type: "new_item",
    message: `${newItem.name} was added to inventory.`,
    link: "/staff/inventory",
  });

  if (restockLevel != null && Number(newItem.quantity) <= restockLevel) {
    await createNotification({
      ownerId: session.id,
      recipientId: null,
      storeId: activeStore.id,
      type: "low_stock",
      message:
        Number(newItem.quantity) <= 0
          ? `${newItem.name} was added already out of stock.`
          : `${newItem.name} was added below its restock level (${Number(newItem.quantity)}${unit} left).`,
      link: "/staff/inventory",
    });
  }

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function updateScaleItemAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await assertSubscriptionActive(session.id);

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const existing = await prisma.scaleInventory.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== session.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const quantity = parseFloat(formData.get("quantity") as string);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = (formData.get("category") as string) || null;
  const restockLevelRaw = formData.get("restockLevel") as string;
  const restockLevel = restockLevelRaw ? parseFloat(restockLevelRaw) : null;

  // Unit is intentionally NOT editable here — it's fixed at creation
  // (see ScaleInventory.unit comment in scale.prisma).

  const updateData: any = {
    name,
    quantity: isNaN(quantity) ? existing.quantity : quantity,
    costPrice: isNaN(costPrice) ? null : costPrice,
    price: isNaN(price) ? existing.price : price,
    category,
    restockLevel,
  };

  const imageUrl = formData.get("imageUrl") as string | null;
  if (imageUrl) updateData.image = imageUrl;

  const updated = await prisma.scaleInventory.update({ where: { id }, data: updateData });

  const before = { quantity: Number(existing.quantity), restockLevel: existing.restockLevel != null ? Number(existing.restockLevel) : null };
  const after = { quantity: Number(updated.quantity), restockLevel: updated.restockLevel != null ? Number(updated.restockLevel) : null };

  if (after.restockLevel != null) {
    const wasLow = before.restockLevel != null && before.quantity <= before.restockLevel;
    const isLowNow = after.quantity <= after.restockLevel;

    if (!wasLow && isLowNow) {
      await createNotification({
        ownerId: session.id,
        recipientId: null,
        storeId: existing.storeId,
        type: "low_stock",
        message:
          after.quantity <= 0
            ? `${updated.name} is now out of stock.`
            : `${updated.name} is running low (${after.quantity}${updated.unit} left).`,
        link: "/staff/inventory",
      });
    } else if (wasLow && !isLowNow) {
      await createNotification({
        ownerId: session.id,
        recipientId: null,
        storeId: existing.storeId,
        type: "restock",
        message: `${updated.name} was restocked (${after.quantity}${updated.unit} now available).`,
        link: "/staff/inventory",
      });
    }
  }

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function deleteScaleItemAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await assertSubscriptionActive(session.id);

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const item = await prisma.scaleInventory.findUnique({ where: { id } });
  if (!item || item.ownerId !== session.id) throw new Error("Unauthorized");

  let archived = false;

  try {
    await prisma.scaleInventory.delete({ where: { id } });
  } catch (error: any) {
    if (error.code === "P2003") {
      await prisma.scaleInventory.update({ where: { id }, data: { quantity: 0 } });
      archived = true;
    } else {
      throw error;
    }
  }

  revalidatePath("/owner/inventory");
  return { success: true, archived };
}

// ============================================================================
// Staff-facing: browse + sell
// ============================================================================

export async function getScaleInventoryForStaff() {
  const session = await getSessionUser();
  const targetOwnerId = session?.ownerId || (session?.role === "owner" ? session.id : null);
  if (!targetOwnerId) throw new Error("Unauthorized");

  const activeStore = await getActiveStore();

  const data = await prisma.scaleInventory.findMany({
    where: {
      ownerId: targetOwnerId,
      ...(activeStore ? { storeId: activeStore.id } : {}),
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      price: true,
      costPrice: true,
      category: true,
      restockLevel: true,
      image: true,
    },
    orderBy: { name: "asc" },
  });

  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value && typeof value === "object" && value.constructor.name === "Decimal") return Number(value);
      return value;
    })
  );
}

// A cart line as sent from the staff selling UI. `enteredQty`/`enteredUnit`
// is exactly what the staff typed (may be the sub-unit, e.g. grams); the
// server re-derives the base-unit amount itself rather than trusting a
// client-computed value, since that's what actually gets deducted from stock.
interface ScaleCartItem {
  id: number;
  enteredQty: number;
  enteredUnit: string;
  price: number; // per base unit, post-discount if any
  originalPrice?: number; // per base unit, pre-discount
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
}

export async function processScaleSaleAction(
  cartItems: ScaleCartItem[],
  paymentMethod: "cash" | "transfer",
  buyerName?: string,
  buyerPhone?: string
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const saleOwnerScopeId = session.role === "owner" ? session.id : session.ownerId!;
  await assertSubscriptionActive(saleOwnerScopeId);

  const saleOwnerId = session.role === "owner" ? session.id : session.ownerId!;
  const activeStore = await getActiveStore();
  if (!activeStore || activeStore.storeType !== "scale") {
    throw new Error("This action is only available for weight/volume stores.");
  }

  // Discounts are gated by the owner's discountEnabled toggle — the staff
  // UI already hides the discount option when it's off, but that's a
  // client-side nicety, not a guarantee. Re-check here so a tampered
  // request can't apply a discount the owner never turned on.
  const ownerRecord = await prisma.user.findUnique({
    where: { id: saleOwnerId },
    select: { discountEnabled: true },
  });
  const discountsAllowed = ownerRecord?.discountEnabled ?? false;
  if (!discountsAllowed) {
    for (const item of cartItems) {
      delete item.discountValue;
      delete item.discountType;
      delete item.discountReason;
      delete item.originalPrice;
    }
  }

  // Resolve base units + validate stock BEFORE creating anything.
  const resolved: {
    item: ScaleCartItem;
    baseQty: number;
    inventory: Awaited<ReturnType<typeof prisma.scaleInventory.findUnique>>;
  }[] = [];

  for (const item of cartItems) {
    const inventory = await prisma.scaleInventory.findUnique({ where: { id: item.id } });
    if (!inventory) throw new Error(`Item ${item.id} not found.`);

    const baseQty = convertToBaseUnit(item.enteredQty, item.enteredUnit, inventory.unit);
    if (baseQty <= 0) throw new Error(`Invalid quantity for ${inventory.name}.`);
    if (Number(inventory.quantity) < baseQty) {
      throw new Error(`Insufficient stock for ${inventory.name}. Available: ${Number(inventory.quantity)}${inventory.unit}`);
    }

    resolved.push({ item, baseQty, inventory });
  }

  const total = resolved.reduce((sum, r) => sum + r.item.price * r.baseQty, 0);
  const cleanName = buyerName?.trim();
  const cleanPhone = buyerPhone?.trim();
  const saleStoreId = activeStore.id;

  await prisma.order.create({
    data: {
      total,
      paymentMethod,
      buyerName: cleanName || "Walk-in Customer",
      buyerPhone: cleanPhone || null,
      ownerId: saleOwnerId,
      staffId: session.id,
      storeId: saleStoreId,
      scaleItems: {
        create: resolved.map(({ item, baseQty, inventory }) => ({
          scaleInventoryId: item.id,
          quantity: item.enteredQty,
          unit: item.enteredUnit,
          quantityInBaseUnit: baseQty,
          priceAtTime: item.price * baseQty,
          ...(item.discountValue
            ? {
                originalPrice: (item.originalPrice ?? item.price) * baseQty,
                discountValue: item.discountValue,
                discountType: item.discountType ?? null,
                discountReason: item.discountReason ?? null,
              }
            : {}),
        })),
      },
    },
  });

  const soldByStaff =
    session.role !== "owner"
      ? await prisma.user.findUnique({ where: { id: session.id }, select: { fullName: true } })
      : null;

  const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(total);

  await createNotification({
    ownerId: saleOwnerId,
    recipientId: null,
    storeId: saleStoreId,
    type: "sale_made",
    message: soldByStaff?.fullName ? `${soldByStaff.fullName} made a sale of ${naira}.` : `A sale of ${naira} was made.`,
    link: "/owner/dashboard",
  });

  for (const { item, baseQty, inventory } of resolved) {
    const updated = await prisma.scaleInventory.update({
      where: { id: item.id },
      data: { quantity: { decrement: baseQty } },
    });

    const before = Number(inventory!.quantity);
    const after = Number(updated.quantity);
    const restockLevel = updated.restockLevel != null ? Number(updated.restockLevel) : null;

    if (restockLevel != null && before > restockLevel && after <= restockLevel) {
      await createNotification({
        ownerId: updated.ownerId,
        recipientId: null,
        storeId: saleStoreId,
        type: "low_stock",
        message:
          after <= 0
            ? `${updated.name} is now out of stock.`
            : `${updated.name} is running low (${after}${updated.unit} left).`,
        link: "/staff/inventory",
      });
    }
  }

  revalidatePath("/staff/inventory");
  revalidatePath("/owner/inventory");
  revalidatePath("/owner/orders");
  return { success: true };
}