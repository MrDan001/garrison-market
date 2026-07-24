"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification.actions";
import { getActiveStore } from "./store-context";
import { convertToBaseUnit } from "./scale-units";

export const WASTAGE_REASONS = ["trimming", "spillage", "spoilage", "sample", "other"] as const;
export type WastageReason = (typeof WASTAGE_REASONS)[number];

export const WASTAGE_REASON_LABELS: Record<WastageReason, string> = {
  trimming: "Trimming",
  spillage: "Spillage",
  spoilage: "Spoilage",
  sample: "Sample / Taste Test",
  other: "Other",
};

// ============================================================================
// Submit (staff) — always allowed regardless of the wastageVisibleToStaff
// toggle, which only gates the REPORT view, not submission. Sits as
// "pending" and does NOT touch stock until the owner approves it.
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
  if (!activeStore || activeStore.storeType !== "scale") {
    throw new Error("This action is only available for weight/volume stores.");
  }

  const inv = await prisma.scaleInventory.findUnique({ where: { id: params.scaleInventoryId } });
  if (!inv || inv.storeId !== activeStore.id) throw new Error("Item not found.");

  const baseQty = convertToBaseUnit(params.quantity, params.unit, inv.unit);
  if (baseQty > Number(inv.quantity)) {
    throw new Error(`That's more than the ${Number(inv.quantity)}${inv.unit} currently in stock for ${inv.name}.`);
  }

  const entry = await prisma.scaleWastage.create({
    data: {
      ownerId: session.ownerId,
      storeId: activeStore.id,
      scaleInventoryId: params.scaleInventoryId,
      staffId: session.id,
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
    include: { scaleInventory: true, staff: { select: { id: true, fullName: true } } },
  });
  if (!entry || entry.ownerId !== session.id) throw new Error("Unauthorized");
  if (entry.status !== "pending") throw new Error("This entry has already been reviewed.");

  const baseQty = Number(entry.quantityInBaseUnit);
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