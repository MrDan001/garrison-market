"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification.actions";
import { getActiveStore } from "./store-context";
import { convertToBaseUnit } from "./scale-units";
import { WASTAGE_REASONS, type WastageReason } from "./wastage-constants";

// ============================================================================
// Submit (staff) — always allowed regardless of the wastageVisibleToStaff
// toggle, which only gates the REPORT view, not submission. Sits as
// "pending" and does NOT touch stock until the owner approves it.
//
// Stage 1: now works for merged stores too (standard store + the
// admin-only scaleConsignmentEnabled override), not just native
// scale-only stores. The two cases differ in what the wastage is
// validated and later deducted against:
//  - Native scale store: no consignment layer exists — validated
//    against, and later deducted from, the shop's master ScaleInventory
//    pool directly (unchanged from before).
//  - Merged store: stock signed out to a staff member already left the
//    master pool at sign-out time, so wastage is validated against, and
//    later deducted from, THAT staff member's remaining signed-out
//    balance instead — otherwise approval would remove the same stock
//    from the master pool a second time.
// ============================================================================
export async function submitWastageAction(params: {
  scaleInventoryId: number;
  quantity: number;
  unit: string;
  reason: string;
  note?: string;
}) {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") throw new Error("Unauthorized");
  if (!session.ownerId) throw new Error("No store assigned to this account");

  if (!WASTAGE_REASONS.includes(params.reason as WastageReason)) {
    throw new Error("Choose a valid reason.");
  }
  if (isNaN(params.quantity) || params.quantity <= 0) {
    throw new Error("Enter a valid amount.");
  }

  const activeStore = await getActiveStore();
  if (!activeStore) throw new Error("No active store found.");

  const isNativeScale = activeStore.storeType === "scale";
  let isMerged = false;
  if (!isNativeScale) {
    const owner = await prisma.user.findUnique({
      where: { id: session.ownerId },
      select: { scaleConsignmentEnabled: true },
    });
    isMerged = !!owner?.scaleConsignmentEnabled;
  }
  if (!isNativeScale && !isMerged) {
    throw new Error("This action is only available for weight/volume stores.");
  }

  const inv = await prisma.scaleInventory.findUnique({ where: { id: params.scaleInventoryId } });
  if (!inv || inv.storeId !== activeStore.id) throw new Error("Item not found.");

  const baseQty = convertToBaseUnit(params.quantity, params.unit, inv.unit);

  let consignmentItemId: number | null = null;

  if (isNativeScale) {
    if (baseQty > Number(inv.quantity)) {
      throw new Error(`That's more than the ${Number(inv.quantity)}${inv.unit} currently in stock for ${inv.name}.`);
    }
  } else {
    // Merged store — find this staff member's open signed-out balance
    // for this item today (their own consignment OR a store-wide shared
    // one), and validate against what they actually still have, not the
    // shop-wide master pool.
    const openConsignment = await prisma.consignment.findFirst({
      where: {
        storeId: activeStore.id,
        status: "out",
        OR: [{ staffId: session.id }, { staffId: null }],
        scaleItems: { some: { scaleInventoryId: params.scaleInventoryId } },
      },
      include: { scaleItems: true },
    });
    const item = openConsignment?.scaleItems.find((i) => i.scaleInventoryId === params.scaleInventoryId);
    if (!item) {
      throw new Error(`${inv.name} isn't currently signed out to you.`);
    }
    const remaining = Number(item.quantityOut) - Number(item.quantitySold) - Number(item.quantityWasted);
    if (baseQty > remaining) {
      throw new Error(`That's more than the ${remaining}${inv.unit} you currently have signed out for ${inv.name}.`);
    }
    consignmentItemId = item.id;
  }

  const entry = await prisma.scaleWastage.create({
    data: {
      ownerId: session.ownerId,
      storeId: activeStore.id,
      scaleInventoryId: params.scaleInventoryId,
      staffId: session.id,
      consignmentItemId,
      quantity: params.quantity,
      unit: params.unit,
      quantityInBaseUnit: baseQty,
      reason: params.reason,
      note: params.note?.trim() || null,
      status: "pending",
    },
  });

  const staff = await prisma.user.findUnique({ where: { id: session.id }, select: { fullName: true } });

  await createNotification({
    ownerId: session.ownerId,
    recipientId: null,
    storeId: activeStore.id,
    type: "wastage_submitted",
    message: `${staff?.fullName || "A staff member"} logged ${params.quantity}${params.unit} of ${inv.name} as wastage — needs your approval.`,
    link: "/owner/wastage",
  });

  revalidatePath("/staff/wastage");
  revalidatePath("/owner/wastage");
  return { success: true, id: entry.id };
}

// ============================================================================
// Approve/decline (owner only)
// ============================================================================
export async function approveWastageAction(wastageId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const entry = await prisma.scaleWastage.findUnique({
    where: { id: wastageId },
    include: {
      scaleInventory: true,
      staff: { select: { id: true, fullName: true } },
      consignmentItem: true,
    },
  });
  if (!entry || entry.ownerId !== session.id) throw new Error("Unauthorized");
  if (entry.status !== "pending") throw new Error("This entry has already been reviewed.");

  const baseQty = Number(entry.quantityInBaseUnit);

  if (entry.consignmentItem) {
    // Merged-store entry — this stock already left the master pool at
    // sign-out, so it comes out of the consignment item's own balance
    // instead of ScaleInventory.quantity a second time.
    const item = entry.consignmentItem;
    const remaining = Number(item.quantityOut) - Number(item.quantitySold) - Number(item.quantityWasted);
    if (baseQty > remaining) {
      throw new Error(
        `That staff member's signed-out balance has changed since this was submitted — only ${remaining}${item.unit} of ${entry.scaleInventory.name} is left with them, less than the ${baseQty}${item.unit} being written off.`
      );
    }

    await prisma.$transaction([
      prisma.scaleWastage.update({
        where: { id: wastageId },
        data: { status: "approved", reviewedById: session.id, reviewedAt: new Date() },
      }),
      prisma.scaleConsignmentItem.update({
        where: { id: item.id },
        data: { quantityWasted: { increment: baseQty } },
      }),
    ]);
  } else {
    // Native scale store — no consignment layer, deduct straight from
    // the shop's master pool, same as before.
    if (baseQty > Number(entry.scaleInventory.quantity)) {
      throw new Error(
        `Stock has changed since this was submitted — only ${Number(entry.scaleInventory.quantity)}${entry.scaleInventory.unit} of ${entry.scaleInventory.name} is left, less than the ${baseQty}${entry.scaleInventory.unit} being written off.`
      );
    }

    await prisma.$transaction([
      prisma.scaleWastage.update({
        where: { id: wastageId },
        data: { status: "approved", reviewedById: session.id, reviewedAt: new Date() },
      }),
      prisma.scaleInventory.update({
        where: { id: entry.scaleInventoryId },
        data: { quantity: { decrement: baseQty } },
      }),
    ]);
  }

  await createNotification({
    ownerId: session.id,
    recipientId: entry.staffId,
    storeId: entry.storeId,
    type: "wastage_status",
    message: `Your wastage entry for ${entry.scaleInventory.name} (${entry.quantity}${entry.unit}) was approved.`,
    link: "/staff/wastage",
  });

  revalidatePath("/owner/wastage");
  revalidatePath("/staff/wastage");
  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function declineWastageAction(wastageId: number, declineReason: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");
  if (!declineReason?.trim()) throw new Error("Please provide a reason for declining.");

  const entry = await prisma.scaleWastage.findUnique({
    where: { id: wastageId },
    include: { scaleInventory: { select: { name: true } } },
  });
  if (!entry || entry.ownerId !== session.id) throw new Error("Unauthorized");
  if (entry.status !== "pending") throw new Error("This entry has already been reviewed.");

  await prisma.scaleWastage.update({
    where: { id: wastageId },
    data: {
      status: "declined",
      declineReason: declineReason.trim(),
      reviewedById: session.id,
      reviewedAt: new Date(),
    },
  });

  await createNotification({
    ownerId: session.id,
    recipientId: entry.staffId,
    storeId: entry.storeId,
    type: "wastage_status",
    message: `Your wastage entry for ${entry.scaleInventory.name} (${entry.quantity}${entry.unit}) was declined: ${declineReason.trim()}`,
    link: "/staff/wastage",
  });

  revalidatePath("/owner/wastage");
  revalidatePath("/staff/wastage");
  return { success: true };
}

// ============================================================================
// Owner report view — always visible to the owner. Pending queue +
// monthly totals + full history browsable by month/year.
// ============================================================================
export async function getWastageForOwner() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const activeStore = await getActiveStore();
  if (!activeStore) return { pending: [], monthly: [], monthTotal: { qty: 0, value: 0, month: "" } };

  const [pending, all] = await Promise.all([
    prisma.scaleWastage.findMany({
      where: { ownerId: session.id, storeId: activeStore.id, status: "pending" },
      include: { scaleInventory: { select: { name: true, unit: true, costPrice: true, price: true } }, staff: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scaleWastage.findMany({
      where: { ownerId: session.id, storeId: activeStore.id, status: { in: ["approved", "declined"] } },
      include: { scaleInventory: { select: { name: true, unit: true, costPrice: true, price: true } }, staff: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Group approved entries by month/year for browsing — value estimated
  // using each product's CURRENT cost price (falling back to selling
  // price), since ScaleWastage doesn't snapshot a price at submit time.
  const monthly = new Map<string, { month: string; qty: number; value: number; entries: typeof all }>();
  for (const entry of all) {
    if (entry.status !== "approved") continue;
    const d = new Date(entry.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
    const unitValue = entry.scaleInventory.costPrice != null ? Number(entry.scaleInventory.costPrice) : Number(entry.scaleInventory.price);
    const value = unitValue * Number(entry.quantityInBaseUnit);

    if (!monthly.has(key)) monthly.set(key, { month: label, qty: 0, value: 0, entries: [] });
    const bucket = monthly.get(key)!;
    bucket.qty += Number(entry.quantityInBaseUnit);
    bucket.value += value;
    bucket.entries.push(entry);
  }

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentBucket = monthly.get(currentKey);

  return {
    pending,
    history: all,
    monthly: Array.from(monthly.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, v]) => ({ key, month: v.month, qty: v.qty, value: v.value, entries: v.entries })),
    monthTotal: {
      qty: currentBucket?.qty ?? 0,
      value: currentBucket?.value ?? 0,
      month: currentBucket?.month ?? now.toLocaleDateString("en-NG", { month: "long", year: "numeric" }),
    },
  };
}

// ============================================================================
// Staff view — submission is always available; the report portion
// (history + monthly totals) is gated by the owner's toggle, checked
// separately via getWastageVisibilityForStaff().
// ============================================================================
export async function getWastageVisibilityForStaff() {
  const session = await getSessionUser();
  if (!session) return false;
  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) return false;

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { wastageVisibleToStaff: true } });
  return owner?.wastageVisibleToStaff ?? false;
}

export async function getWastageForStaff() {
  const session = await getSessionUser();
  if (!session) return [];

  return prisma.scaleWastage.findMany({
    where: { staffId: session.id },
    include: { scaleInventory: { select: { name: true, unit: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ============================================================================
// Stage 4: the actual report content behind the wastageVisibleToStaff
// toggle — previously the toggle existed but nothing was ever built to
// show when it was on. Mirrors getWastageForOwner's current-month total
// (approved entries only, same cost-price-based valuation), plus a
// per-product kg/₦ breakdown for that month, which is store-wide — not
// filtered to just this staff member's own entries — since the point is
// parity with what the owner sees.
// ============================================================================
export async function getWastageReportForStaff() {
  const session = await getSessionUser();
  if (!session) return null;
  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) return null;

  const activeStore = await getActiveStore();
  if (!activeStore) return null;

  const approved = await prisma.scaleWastage.findMany({
    where: { ownerId, storeId: activeStore.id, status: "approved" },
    include: { scaleInventory: { select: { name: true, unit: true, costPrice: true, price: true } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  const thisMonth = approved.filter((entry) => {
    const d = new Date(entry.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentKey;
  });

  const byProduct = new Map<string, { name: string; unit: string; qty: number; value: number; count: number }>();
  let totalQty = 0;
  let totalValue = 0;

  for (const entry of thisMonth) {
    const unitValue =
      entry.scaleInventory.costPrice != null ? Number(entry.scaleInventory.costPrice) : Number(entry.scaleInventory.price);
    const value = unitValue * Number(entry.quantityInBaseUnit);
    const qty = Number(entry.quantityInBaseUnit);

    totalQty += qty;
    totalValue += value;

    const key = entry.scaleInventory.name;
    if (!byProduct.has(key)) {
      byProduct.set(key, { name: entry.scaleInventory.name, unit: entry.scaleInventory.unit, qty: 0, value: 0, count: 0 });
    }
    const bucket = byProduct.get(key)!;
    bucket.qty += qty;
    bucket.value += value;
    bucket.count += 1;
  }

  return {
    month: monthLabel,
    totalQty,
    totalValue,
    count: thisMonth.length,
    byProduct: Array.from(byProduct.values()).sort((a, b) => b.value - a.value),
  };
}