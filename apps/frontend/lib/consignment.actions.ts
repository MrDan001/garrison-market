// FILE: apps/frontend/lib/consignment.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createNotification } from "./notification.actions";
import { getActiveStoreId, getActiveStore } from "./store-context";
import { assertSubscriptionActive, resolveEffectivePlanId } from "./subscription-guard";
import { getPlanConfig } from "./plans";
import { sendConsignmentSettlementEmail } from "./email";
import { convertToBaseUnit } from "./scale-units";

type SignOutItem = { inventoryId: number; quantityOut: number };
type SignOutScaleItem = { scaleInventoryId: number; enteredQty: number; enteredUnit: string };

export async function isConsignmentEnabledForStaff() {
  const session = await getSessionUser();
  if (!session) return false;

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) return false;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { consignmentEnabled: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
  });

  // Both the owner's manual toggle AND their (effective) plan must allow it
  // — Basic plan owners never see consignment regardless of the toggle
  // state, but an active trial counts as Premium.
  const planAllows = owner ? getPlanConfig(resolveEffectivePlanId(owner)).consignment : false;
  return (owner?.consignmentEnabled ?? false) && planAllows;
}

export async function signOutConsignment(params: {
  recipientName: string;
  recipientPhone: string;
  recipientNote?: string;
  items: SignOutItem[];
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) throw new Error("No owner scope found for this account");

  await assertSubscriptionActive(ownerId);

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { consignmentEnabled: true },
  });
  if (!owner?.consignmentEnabled) throw new Error("Consignment is not enabled for this store");

  if (!params.recipientName.trim() || !params.recipientPhone.trim()) {
    throw new Error("Recipient name and phone are required");
  }
  if (params.items.length === 0) throw new Error("Add at least one item");

  // For staff, this resolves their assigned staffStoreId. For an owner, it
  // resolves whichever store they've switched into (cookie), same as
  // getInventoryForStaff / addItemAction in business.actions.ts.
  const storeId = await getActiveStoreId();

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      id: { in: params.items.map((i) => i.inventoryId) },
      ownerId,
      ...(storeId ? { storeId } : {}),
    },
  });

  for (const item of params.items) {
    const inv = inventoryRows.find((r) => r.id === item.inventoryId);
    if (!inv) throw new Error(`Item ${item.inventoryId} not found`);
    if (inv.quantity < item.quantityOut) {
      throw new Error(`Insufficient stock for ${inv.name}. Available: ${inv.quantity}`);
    }
  }

  const consignment = await prisma.consignment.create({
    data: {
      ownerId,
      staffId: session.id,
      storeId: storeId ?? undefined,
      recipientName: params.recipientName.trim(),
      recipientPhone: params.recipientPhone.trim(),
      recipientNote: params.recipientNote?.trim() || null,
      status: "out",
      items: {
        create: params.items.map((item) => {
          const inv = inventoryRows.find((r) => r.id === item.inventoryId)!;
          return {
            inventoryId: item.inventoryId,
            quantityOut: item.quantityOut,
            priceAtTime: inv.price,
          };
        }),
      },
    },
  });

  for (const item of params.items) {
    await prisma.inventory.update({
      where: { id: item.inventoryId },
      data: { quantity: { decrement: item.quantityOut } },
    });
  }

  revalidatePath("/staff/consignment");
  revalidatePath("/owner/consignments");
  return { success: true, id: consignment.id };
}

export async function getOpenConsignmentsForStaff() {
  const session = await getSessionUser();
  if (!session) return [];

  return prisma.consignment.findMany({
    where: { staffId: session.id, status: "out" },
    include: {
      store: { select: { id: true, name: true } },
      items: { include: { inventory: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getConsignmentHistoryForStaff() {
  const session = await getSessionUser();
  if (!session) return [];

  return prisma.consignment.findMany({
    where: { staffId: session.id, status: "settled" },
    include: {
      store: { select: { id: true, name: true } },
      items: { include: { inventory: true } },
    },
    orderBy: { settledAt: "desc" },
    take: 20,
  });
}

export async function settleConsignment(
  consignmentId: number,
  settlements: { itemId: number; quantitySold: number; quantityReturned: number }[]
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const consignment = await prisma.consignment.findUnique({
    where: { id: consignmentId },
    include: {
      items: { include: { inventory: { select: { name: true } } } },
      owner: { select: { email: true, fullName: true } },
      store: { select: { name: true } },
    },
  });
  if (!consignment) throw new Error("Consignment not found");
  if (consignment.staffId !== session.id) throw new Error("Unauthorized");
  if (consignment.status !== "out") throw new Error("This consignment is already settled");

  await assertSubscriptionActive(consignment.ownerId);

  for (const s of settlements) {
    const item = consignment.items.find((i) => i.id === s.itemId);
    if (!item) throw new Error("Item mismatch");
    if (s.quantitySold + s.quantityReturned !== item.quantityOut) {
      throw new Error(
        `Sold + returned must equal the quantity signed out (${item.quantityOut}) for each item`
      );
    }
  }

  const total = settlements.reduce((sum, s) => {
    const item = consignment.items.find((i) => i.id === s.itemId)!;
    return sum + Number(item.priceAtTime) * s.quantitySold;
  }, 0);

  const soldItems = settlements.filter((s) => s.quantitySold > 0);

  if (soldItems.length > 0) {
    await prisma.order.create({
      data: {
        total,
        ownerId: consignment.ownerId,
        staffId: consignment.staffId,
        storeId: consignment.storeId,
        consignmentId: consignment.id,
        items: {
          create: soldItems.map((s) => {
            const item = consignment.items.find((i) => i.id === s.itemId)!;
            return {
              inventoryId: item.inventoryId,
              quantity: s.quantitySold,
              priceAtTime: item.priceAtTime,
            };
          }),
        },
      },
    });
  }

  for (const s of settlements) {
    const item = consignment.items.find((i) => i.id === s.itemId)!;

    await prisma.consignmentItem.update({
      where: { id: s.itemId },
      data: { quantitySold: s.quantitySold, quantityReturned: s.quantityReturned },
    });

    if (s.quantityReturned > 0) {
      await prisma.inventory.update({
        where: { id: item.inventoryId },
        data: { quantity: { increment: s.quantityReturned } },
      });
    }
  }

  await prisma.consignment.update({
    where: { id: consignmentId },
    data: { status: "settled", settledAt: new Date() },
  });

  await createNotification({
    ownerId: consignment.ownerId,
    recipientId: null,
    storeId: consignment.storeId,
    type: "announcement",
    message: `Consignment with ${consignment.recipientName} was settled — ₦${total.toLocaleString()} in sales.`,
    link: "/owner/consignments",
  });

  if (consignment.owner?.email) {
    const headerList = await headers();
    const host = headerList.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    await sendConsignmentSettlementEmail(consignment.owner.email, consignment.owner.fullName || "there", {
      recipientName: consignment.recipientName,
      storeName: consignment.store?.name,
      totalSales: total,
      items: settlements.map((s) => {
        const item = consignment.items.find((i) => i.id === s.itemId)!;
        return {
          name: item.inventory.name,
          quantitySold: s.quantitySold,
          quantityReturned: s.quantityReturned,
          subtotal: Number(item.priceAtTime) * s.quantitySold,
        };
      }),
      link: `${baseUrl}/owner/consignments`,
    });
  }

  revalidatePath("/staff/consignment");
  revalidatePath("/owner/consignments");
  return { success: true };
}

export async function getConsignmentsForOwner(storeId?: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  return prisma.consignment.findMany({
    where: {
      ownerId: session.id,
      ...(storeId ? { storeId } : {}),
    },
    include: {
      staff: { select: { fullName: true } },
      store: { select: { id: true, name: true } },
      items: { include: { inventory: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================================================
// Scale (weight/volume) consignments — same lifecycle as the standard
// consignment functions above (sign out → open → settle → history), just
// against ScaleInventory/ScaleConsignmentItem with decimal quantities and
// unit conversion, mirroring the pattern used for Scale selling.
// ============================================================================

export async function signOutScaleConsignment(params: {
  recipientName: string;
  recipientPhone: string;
  recipientNote?: string;
  items: SignOutScaleItem[];
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) throw new Error("No owner scope found for this account");

  await assertSubscriptionActive(ownerId);

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { consignmentEnabled: true },
  });
  if (!owner?.consignmentEnabled) throw new Error("Consignment is not enabled for this store");

  if (!params.recipientName.trim() || !params.recipientPhone.trim()) {
    throw new Error("Recipient name and phone are required");
  }
  if (params.items.length === 0) throw new Error("Add at least one item");

  const activeStore = await getActiveStore();
  if (!activeStore) {
    throw new Error("No active store found");
  }

  // A store qualifies for scale sign-out either because it's a native
  // "scale" store, OR because the admin has switched on the
  // scaleConsignmentEnabled override for this owner (unlocks a parallel
  // Scale layer on top of an otherwise-untouched standard store).
  if (activeStore.storeType !== "scale") {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { scaleConsignmentEnabled: true },
    });
    if (!owner?.scaleConsignmentEnabled) {
      throw new Error("This action is only available for weight/volume stores");
    }
  }

  const inventoryRows = await prisma.scaleInventory.findMany({
    where: {
      id: { in: params.items.map((i) => i.scaleInventoryId) },
      ownerId,
      storeId: activeStore.id,
    },
  });

  const resolved: { item: SignOutScaleItem; baseQty: number; inv: (typeof inventoryRows)[number] }[] = [];

  for (const item of params.items) {
    const inv = inventoryRows.find((r) => r.id === item.scaleInventoryId);
    if (!inv) throw new Error(`Item ${item.scaleInventoryId} not found`);

    const baseQty = convertToBaseUnit(item.enteredQty, item.enteredUnit, inv.unit);
    if (baseQty <= 0) throw new Error(`Invalid quantity for ${inv.name}.`);
    if (Number(inv.quantity) < baseQty) {
      throw new Error(`Insufficient stock for ${inv.name}. Available: ${Number(inv.quantity)}${inv.unit}`);
    }
    resolved.push({ item, baseQty, inv });
  }

  const consignment = await prisma.consignment.create({
    data: {
      ownerId,
      staffId: session.id,
      storeId: activeStore.id,
      recipientName: params.recipientName.trim(),
      recipientPhone: params.recipientPhone.trim(),
      recipientNote: params.recipientNote?.trim() || null,
      status: "out",
      scaleItems: {
        create: resolved.map(({ item, baseQty, inv }) => ({
          scaleInventoryId: item.scaleInventoryId,
          quantityOut: baseQty,
          unit: inv.unit,
          priceAtTime: inv.price,
        })),
      },
    },
  });

  for (const { item, baseQty } of resolved) {
    await prisma.scaleInventory.update({
      where: { id: item.scaleInventoryId },
      data: { quantity: { decrement: baseQty } },
    });
  }

  revalidatePath("/staff/consignment");
  revalidatePath("/owner/consignments");
  return { success: true, id: consignment.id };
}

export async function getOpenScaleConsignmentsForStaff() {
  const session = await getSessionUser();
  if (!session) return [];

  // A staff member should see BOTH consignments signed out to them
  // personally AND any store-wide shared consignment (staffId: null) —
  // scoped to their own store, since a shared consignment at a different
  // store they don't work at should never surface here.
  const storeId = await getActiveStoreId();

  return prisma.consignment.findMany({
    where: {
      status: "out",
      OR: [{ staffId: session.id }, { staffId: null, storeId: storeId ?? -1 }],
    },
    include: {
      store: { select: { id: true, name: true } },
      scaleItems: { include: { scaleInventory: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getScaleConsignmentHistoryForStaff() {
  const session = await getSessionUser();
  if (!session) return [];

  const storeId = await getActiveStoreId();

  return prisma.consignment.findMany({
    where: {
      status: "settled",
      OR: [{ staffId: session.id }, { staffId: null, storeId: storeId ?? -1 }],
    },
    include: {
      store: { select: { id: true, name: true } },
      scaleItems: { include: { scaleInventory: true } },
    },
    orderBy: { settledAt: "desc" },
    take: 20,
  });
}

export async function settleScaleConsignment(
  consignmentId: number,
  settlements: { itemId: number; quantitySold: number; quantityReturned: number }[]
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const consignment = await prisma.consignment.findUnique({
    where: { id: consignmentId },
    include: {
      scaleItems: { include: { scaleInventory: { select: { name: true } } } },
      owner: { select: { email: true, fullName: true } },
      store: { select: { name: true } },
    },
  });
  if (!consignment) throw new Error("Consignment not found");
  if (consignment.staffId !== session.id) throw new Error("Unauthorized");
  if (consignment.status !== "out") throw new Error("This consignment is already settled");

  await assertSubscriptionActive(consignment.ownerId);

  // Settlement amounts are entered in the same base unit the item was
  // signed out in (no unit re-selection at settle time), so this is a
  // direct decimal comparison — small floating point drift is possible,
  // so allow a tiny epsilon rather than requiring an exact match.
  const EPSILON = 0.0001;
  for (const s of settlements) {
    const item = consignment.scaleItems.find((i) => i.id === s.itemId);
    if (!item) throw new Error("Item mismatch");
    if (Math.abs(s.quantitySold + s.quantityReturned - Number(item.quantityOut)) > EPSILON) {
      throw new Error(
        `Sold + returned must equal the quantity signed out (${Number(item.quantityOut)}${item.unit}) for each item`
      );
    }
  }

  const total = settlements.reduce((sum, s) => {
    const item = consignment.scaleItems.find((i) => i.id === s.itemId)!;
    return sum + Number(item.priceAtTime) * s.quantitySold;
  }, 0);

  const soldItems = settlements.filter((s) => s.quantitySold > 0);

  if (soldItems.length > 0) {
    await prisma.order.create({
      data: {
        total,
        ownerId: consignment.ownerId,
        staffId: consignment.staffId,
        storeId: consignment.storeId,
        consignmentId: consignment.id,
        scaleItems: {
          create: soldItems.map((s) => {
            const item = consignment.scaleItems.find((i) => i.id === s.itemId)!;
            return {
              scaleInventoryId: item.scaleInventoryId,
              quantity: s.quantitySold,
              unit: item.unit,
              quantityInBaseUnit: s.quantitySold,
              priceAtTime: Number(item.priceAtTime) * s.quantitySold,
            };
          }),
        },
      },
    });
  }

  for (const s of settlements) {
    const item = consignment.scaleItems.find((i) => i.id === s.itemId)!;

    await prisma.scaleConsignmentItem.update({
      where: { id: s.itemId },
      data: { quantitySold: s.quantitySold, quantityReturned: s.quantityReturned },
    });

    if (s.quantityReturned > 0) {
      await prisma.scaleInventory.update({
        where: { id: item.scaleInventoryId },
        data: { quantity: { increment: s.quantityReturned } },
      });
    }
  }

  await prisma.consignment.update({
    where: { id: consignmentId },
    data: { status: "settled", settledAt: new Date() },
  });

  await createNotification({
    ownerId: consignment.ownerId,
    recipientId: null,
    storeId: consignment.storeId,
    type: "announcement",
    message: `Consignment with ${consignment.recipientName} was settled — ₦${total.toLocaleString()} in sales.`,
    link: "/owner/consignments",
  });

  if (consignment.owner?.email) {
    const headerList = await headers();
    const host = headerList.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    await sendConsignmentSettlementEmail(consignment.owner.email, consignment.owner.fullName || "there", {
      recipientName: consignment.recipientName,
      storeName: consignment.store?.name,
      totalSales: total,
      items: settlements.map((s) => {
        const item = consignment.scaleItems.find((i) => i.id === s.itemId)!;
        return {
          // Unit baked into the name since the email template's item type
          // doesn't carry a separate unit field.
          name: `${item.scaleInventory.name} (${item.unit})`,
          quantitySold: s.quantitySold,
          quantityReturned: s.quantityReturned,
          subtotal: Number(item.priceAtTime) * s.quantitySold,
        };
      }),
      link: `${baseUrl}/owner/consignments`,
    });
  }

  revalidatePath("/staff/consignment");
  revalidatePath("/owner/consignments");
  return { success: true };
}

// ============================================================================
// Owner → Staff scale sign-out (admin-override daily consignment)
// ============================================================================
// Used only when an owner has scaleConsignmentEnabled on. Unlike the
// staff-initiated signOutScaleConsignment above (staff → external
// recipient), this is OWNER-initiated and targets one of their own staff
// members directly — that staff member's `staffId` on the resulting
// Consignment is what makes it show up in their own "scale inventory" view
// (getOpenScaleConsignmentsForStaff already filters on staffId, so no
// changes were needed there).

export async function getStaffForScaleOverride() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const storeId = await getActiveStoreId();
  if (!storeId) return [];

  return prisma.user.findMany({
    where: { ownerId: session.id, role: "staff", staffStoreId: storeId },
    select: { id: true, fullName: true, email: true, phoneNumber: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getStaffScaleStockSummary() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const activeStore = await getActiveStore();
  if (!activeStore) return [];

  const openConsignments = await prisma.consignment.findMany({
    where: { ownerId: session.id, storeId: activeStore.id, status: "out", scaleItems: { some: {} } },
    include: {
      staff: { select: { id: true, fullName: true } },
      scaleItems: { include: { scaleInventory: { select: { name: true } } } },
    },
  });

  return openConsignments.map((c) => ({
    staffId: c.staffId,
    staffName: c.staffId === null ? "All Staff (shared)" : c.staff?.fullName || "Staff",
    items: c.scaleItems.map((i) => ({
      name: i.scaleInventory?.name || "Item",
      unit: i.unit,
      quantityOut: Number(i.quantityOut),
      quantitySold: Number(i.quantitySold),
      quantityWasted: Number(i.quantityWasted),
      remaining: Number(i.quantityOut) - Number(i.quantitySold) - Number(i.quantityWasted),
    })),
  }));
}

export async function ownerSignOutScaleToStaffAction(params: {
  staffId: number | "all";
  items: SignOutScaleItem[];
}) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await assertSubscriptionActive(session.id);

  const owner = await prisma.user.findUnique({
    where: { id: session.id },
    select: { scaleConsignmentEnabled: true },
  });
  if (!owner?.scaleConsignmentEnabled) {
    throw new Error("Scale Consignment is not enabled for this account.");
  }

  if (params.items.length === 0) throw new Error("Add at least one item");

  const activeStore = await getActiveStore();
  if (!activeStore) throw new Error("No active store found");

  const isAllStaff = params.staffId === "all";

  // For "All Staff", the resulting consignment has staffId: null — no one
  // specific staff row to resolve. Otherwise, resolve and validate the
  // chosen staff member same as before.
  const staff = isAllStaff
    ? null
    : await prisma.user.findFirst({
        where: { id: params.staffId as number, ownerId: session.id, role: "staff", staffStoreId: activeStore.id },
        select: { id: true, fullName: true, phoneNumber: true },
      });
  if (!isAllStaff && !staff) throw new Error("Staff member not found for this store");

  const inventoryRows = await prisma.scaleInventory.findMany({
    where: {
      id: { in: params.items.map((i) => i.scaleInventoryId) },
      ownerId: session.id,
      storeId: activeStore.id,
    },
  });

  const resolved: { item: SignOutScaleItem; baseQty: number; inv: (typeof inventoryRows)[number] }[] = [];

  for (const item of params.items) {
    const inv = inventoryRows.find((r) => r.id === item.scaleInventoryId);
    if (!inv) throw new Error(`Item ${item.scaleInventoryId} not found`);

    const baseQty = convertToBaseUnit(item.enteredQty, item.enteredUnit, inv.unit);
    if (baseQty <= 0) throw new Error(`Invalid quantity for ${inv.name}.`);
    if (Number(inv.quantity) < baseQty) {
      throw new Error(`Insufficient stock for ${inv.name}. Available: ${Number(inv.quantity)}${inv.unit}`);
    }
    resolved.push({ item, baseQty, inv });
  }

  const consignment = await prisma.$transaction(async (tx) => {
    // Top-up support: if this staff member (or, for "All Staff", the
    // store's shared consignment) already has an open scale consignment
    // today, merge into it instead of creating a second, duplicate-looking
    // consignment — matching item rows get their quantityOut bumped up,
    // new items get added as new rows on the SAME consignment.
    const existing = await tx.consignment.findFirst({
      where: {
        ownerId: session.id,
        staffId: isAllStaff ? null : staff!.id,
        storeId: activeStore.id,
        status: "out",
        scaleItems: { some: {} },
      },
      include: { scaleItems: true },
    });

    if (existing) {
      for (const { item, baseQty, inv } of resolved) {
        const existingLine = existing.scaleItems.find((si) => si.scaleInventoryId === item.scaleInventoryId);
        if (existingLine) {
          await tx.scaleConsignmentItem.update({
            where: { id: existingLine.id },
            data: { quantityOut: { increment: baseQty } },
          });
        } else {
          await tx.scaleConsignmentItem.create({
            data: {
              consignmentId: existing.id,
              scaleInventoryId: item.scaleInventoryId,
              quantityOut: baseQty,
              unit: inv.unit,
              priceAtTime: inv.price,
            },
          });
        }
      }
      return existing;
    }

    return tx.consignment.create({
      data: {
        ownerId: session.id,
        staffId: isAllStaff ? null : staff!.id,
        storeId: activeStore.id,
        recipientName: isAllStaff ? "All Staff" : staff!.fullName || "Staff",
        recipientPhone: isAllStaff ? "" : staff!.phoneNumber || "",
        recipientNote: isAllStaff ? "Daily scale consignment sign-out (shared)" : "Daily scale consignment sign-out",
        status: "out",
        scaleItems: {
          create: resolved.map(({ item, baseQty, inv }) => ({
            scaleInventoryId: item.scaleInventoryId,
            quantityOut: baseQty,
            unit: inv.unit,
            priceAtTime: inv.price,
          })),
        },
      },
    });
  });

  for (const { item, baseQty } of resolved) {
    await prisma.scaleInventory.update({
      where: { id: item.scaleInventoryId },
      data: { quantity: { decrement: baseQty } },
    });
  }

  await createNotification({
    ownerId: session.id,
    recipientId: isAllStaff ? null : staff!.id,
    storeId: activeStore.id,
    type: "announcement",
    message: isAllStaff
      ? `Fresh scale stock has been signed out to all staff.`
      : `Fresh scale stock has been signed out to you.`,
    link: "/staff/inventory",
  });

  revalidatePath("/staff/inventory");
  revalidatePath("/staff/consignment");
  revalidatePath("/owner/consignments");
  revalidatePath("/owner/inventory");
  return { success: true, id: consignment.id };
}

// ============================================================================
// Live selling against an open scale consignment (admin-override mode)
// ============================================================================
// Every sale updates quantitySold on the ScaleConsignmentItem in real time —
// this is what feeds submitDailyReport's scale grouping, and what the
// midnight/manual settlement reads to compute what's unsold.
type ConsignmentSaleCartItem = {
  consignmentItemId: number;
  enteredQty: number;
  enteredUnit: string;
  price: number; // per base unit, post-discount if any
};

export async function sellFromScaleConsignmentAction(
  cartItems: ConsignmentSaleCartItem[],
  paymentMethod: "cash" | "transfer",
  buyerName?: string,
  buyerPhone?: string
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerId = session.role === "owner" ? session.id : session.ownerId!;
  await assertSubscriptionActive(ownerId);

  if (cartItems.length === 0) throw new Error("Cart is empty");

  // A shared consignment (staffId: null) is sellable by any staff member
  // at the store it was signed out to — everyone else is still scoped to
  // their own staffId.
  const activeStoreId = await getActiveStoreId();

  // Wrapped in a transaction so two near-simultaneous sells (e.g. a
  // double-tap) can't both read the same quantitySold and jointly oversell
  // past what's actually left on the consignment.
  const result = await prisma.$transaction(async (tx) => {
    const consignmentItems = await tx.scaleConsignmentItem.findMany({
      where: { id: { in: cartItems.map((c) => c.consignmentItemId) } },
      include: { consignment: true, scaleInventory: true },
    });

    const resolved: { cart: ConsignmentSaleCartItem; baseQty: number; row: (typeof consignmentItems)[number] }[] = [];

    for (const cart of cartItems) {
      const row = consignmentItems.find((r) => r.id === cart.consignmentItemId);
      if (!row) throw new Error("Consigned item not found.");
      const isOwnConsignment = row.consignment.staffId === session.id;
      const isSharedAtOwnStore = row.consignment.staffId === null && row.consignment.storeId === activeStoreId;
      if (!isOwnConsignment && !isSharedAtOwnStore) throw new Error("Unauthorized for this consignment.");
      if (row.consignment.status !== "out") throw new Error("This consignment has already been settled.");

      const baseQty = convertToBaseUnit(cart.enteredQty, cart.enteredUnit, row.unit);
      if (baseQty <= 0) throw new Error(`Invalid quantity for ${row.scaleInventory?.name}.`);

      const remaining = Number(row.quantityOut) - Number(row.quantitySold);
      if (baseQty > remaining) {
        throw new Error(`Only ${remaining}${row.unit} of ${row.scaleInventory?.name} left to sell today.`);
      }
      resolved.push({ cart, baseQty, row });
    }

    const total = resolved.reduce((sum, r) => sum + r.cart.price * r.baseQty, 0);
    // Use the consignment's own storeId as the source of truth — it's what
    // the item was actually signed out under, independent of whatever the
    // staff's "active store" cookie currently says.
    const saleStoreId = resolved[0].row.consignment.storeId;

    await tx.order.create({
      data: {
        total,
        paymentMethod,
        buyerName: buyerName?.trim() || "Walk-in Customer",
        buyerPhone: buyerPhone?.trim() || null,
        ownerId,
        staffId: session.id,
        storeId: saleStoreId,
        scaleItems: {
          create: resolved.map(({ cart, baseQty, row }) => ({
            scaleInventoryId: row.scaleInventoryId,
            quantity: cart.enteredQty,
            unit: cart.enteredUnit,
            quantityInBaseUnit: baseQty,
            priceAtTime: cart.price * baseQty,
          })),
        },
      },
    });

    for (const { baseQty, row } of resolved) {
      // Re-check remaining stock atomically inside the transaction via an
      // updateMany guard, in case another concurrent sale slipped in
      // between the read above and this write.
      const updateResult = await tx.scaleConsignmentItem.updateMany({
        where: {
          id: row.id,
          quantitySold: row.quantitySold, // optimistic lock on the value we read
        },
        data: { quantitySold: { increment: baseQty } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${row.scaleInventory?.name} was just sold by another request — please try again.`);
      }
    }

    return { total, saleStoreId };
  });

  const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(result.total);
  const staffName = await prisma.user.findUnique({ where: { id: session.id }, select: { fullName: true } });

  await createNotification({
    ownerId,
    recipientId: null,
    storeId: result.saleStoreId,
    type: "sale_made",
    message: staffName?.fullName ? `${staffName.fullName} made a scale sale of ${naira}.` : `A scale sale of ${naira} was made.`,
    link: "/owner/dashboard",
  });

  revalidatePath("/staff/inventory");
  revalidatePath("/owner/consignments");
  return { success: true, total: result.total };
}

// ============================================================================
// Merged cart checkout (admin-override mode: scaleConsignmentEnabled AND
// mergedCartEnabled both on for the owner)
// ============================================================================
// One sale, one Order row — combines standard Inventory items (Order.items)
// and consignment-signed-out Scale items (Order.scaleItems), which the
// schema already supports on a single Order. Modeled directly on
// sellFromScaleConsignmentAction above: wrapped in one $transaction with
// optimistic-lock guards on every row, so a concurrent sale on either side
// can't oversell.
type MergedListCartItem = {
  id: number; // Inventory id
  qty: number;
  price: number; // post-discount unit price
  originalPrice?: number;
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
};

type MergedScaleCartItem = ConsignmentSaleCartItem & {
  originalPrice?: number;
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
};

export async function processMergedSaleAction(
  listCartItems: MergedListCartItem[],
  scaleCartItems: MergedScaleCartItem[],
  paymentMethod: "cash" | "transfer",
  buyerName?: string,
  buyerPhone?: string
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  if (listCartItems.length === 0 && scaleCartItems.length === 0) throw new Error("Cart is empty");

  const ownerId = session.role === "owner" ? session.id : session.ownerId!;
  await assertSubscriptionActive(ownerId);

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { discountEnabled: true, scaleConsignmentEnabled: true, mergedCartEnabled: true },
  });
  if (!owner?.scaleConsignmentEnabled || !owner?.mergedCartEnabled) {
    throw new Error("Merged Cart is not enabled for this store.");
  }

  // Re-check discountEnabled server-side (client UI already hides the
  // discount option when it's off, but that's not a guarantee against a
  // tampered request) and strip discount fields from both cart types if so.
  if (!owner.discountEnabled) {
    for (const item of listCartItems) {
      delete item.discountValue;
      delete item.discountType;
      delete item.discountReason;
      delete item.originalPrice;
    }
    for (const item of scaleCartItems) {
      delete item.discountValue;
      delete item.discountType;
      delete item.discountReason;
      delete item.originalPrice;
    }
  }

  const activeStoreId = await getActiveStoreId();

  const result = await prisma.$transaction(async (tx) => {
    // --- Resolve + validate list items against Inventory ---
    const inventoryRows = listCartItems.length
      ? await tx.inventory.findMany({ where: { id: { in: listCartItems.map((c) => c.id) } } })
      : [];
    const resolvedList: { cart: MergedListCartItem; row: (typeof inventoryRows)[number] }[] = [];
    for (const cart of listCartItems) {
      const row = inventoryRows.find((r) => r.id === cart.id);
      if (!row) throw new Error(`Item ${cart.id} not found.`);
      if (row.quantity < cart.qty) {
        throw new Error(`Insufficient stock for ${row.name}. Available: ${row.quantity}`);
      }
      resolvedList.push({ cart, row });
    }

    // --- Resolve + validate scale items against the staff's open consignments ---
    const consignmentItems = scaleCartItems.length
      ? await tx.scaleConsignmentItem.findMany({
          where: { id: { in: scaleCartItems.map((c) => c.consignmentItemId) } },
          include: { consignment: true, scaleInventory: true },
        })
      : [];
    const resolvedScale: { cart: MergedScaleCartItem; baseQty: number; row: (typeof consignmentItems)[number] }[] = [];
    for (const cart of scaleCartItems) {
      const row = consignmentItems.find((r) => r.id === cart.consignmentItemId);
      if (!row) throw new Error("Consigned item not found.");
      const isOwnConsignment = row.consignment.staffId === session.id;
      const isSharedAtOwnStore = row.consignment.staffId === null && row.consignment.storeId === activeStoreId;
      if (!isOwnConsignment && !isSharedAtOwnStore) throw new Error("Unauthorized for this consignment.");
      if (row.consignment.status !== "out") throw new Error("This consignment has already been settled.");

      const baseQty = convertToBaseUnit(cart.enteredQty, cart.enteredUnit, row.unit);
      if (baseQty <= 0) throw new Error(`Invalid quantity for ${row.scaleInventory?.name}.`);
      const remaining = Number(row.quantityOut) - Number(row.quantitySold) - Number(row.quantityWasted ?? 0);
      if (baseQty > remaining) {
        throw new Error(`Only ${remaining}${row.unit} of ${row.scaleInventory?.name} left to sell today.`);
      }
      resolvedScale.push({ cart, baseQty, row });
    }

    const listTotal = resolvedList.reduce((sum, r) => sum + r.cart.price * r.cart.qty, 0);
    const scaleTotal = resolvedScale.reduce((sum, r) => sum + r.cart.price * r.baseQty, 0);
    const total = listTotal + scaleTotal;

    // Storefront for the sale: prefer the active store cookie, falling back
    // to wherever the scale consignment lines were signed out under (both
    // should normally agree for a merged-mode staff member).
    const saleStoreId = activeStoreId ?? resolvedScale[0]?.row.consignment.storeId ?? null;

    await tx.order.create({
      data: {
        total,
        paymentMethod,
        buyerName: buyerName?.trim() || "Walk-in Customer",
        buyerPhone: buyerPhone?.trim() || null,
        ownerId,
        staffId: session.id,
        storeId: saleStoreId,
        items: {
          create: resolvedList.map(({ cart }) => ({
            inventoryId: cart.id,
            quantity: cart.qty,
            priceAtTime: cart.price,
            ...(cart.discountValue
              ? {
                  originalPrice: cart.originalPrice,
                  discountValue: cart.discountValue,
                  discountType: cart.discountType ?? null,
                  discountReason: cart.discountReason ?? null,
                }
              : {}),
          })),
        },
        scaleItems: {
          create: resolvedScale.map(({ cart, baseQty, row }) => ({
            scaleInventoryId: row.scaleInventoryId,
            quantity: cart.enteredQty,
            unit: cart.enteredUnit,
            quantityInBaseUnit: baseQty,
            priceAtTime: cart.price * baseQty,
            ...(cart.discountValue
              ? {
                  originalPrice: (cart.originalPrice ?? cart.price) * baseQty,
                  discountValue: cart.discountValue,
                  discountType: cart.discountType ?? null,
                  discountReason: cart.discountReason ?? null,
                }
              : {}),
          })),
        },
      },
    });

    // Decrement Inventory with an optimistic lock (guards the same race
    // processSaleAction has, now closed for the merged path).
    for (const { cart, row } of resolvedList) {
      const updateResult = await tx.inventory.updateMany({
        where: { id: row.id, quantity: row.quantity },
        data: { quantity: { decrement: cart.qty } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${row.name} was just sold by another request — please try again.`);
      }
    }

    // Increment quantitySold on the consignment item, same optimistic lock
    // sellFromScaleConsignmentAction uses.
    for (const { baseQty, row } of resolvedScale) {
      const updateResult = await tx.scaleConsignmentItem.updateMany({
        where: { id: row.id, quantitySold: row.quantitySold },
        data: { quantitySold: { increment: baseQty } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${row.scaleInventory?.name} was just sold by another request — please try again.`);
      }
    }

    return { total, saleStoreId };
  });

  const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(result.total);
  const staffName = await prisma.user.findUnique({ where: { id: session.id }, select: { fullName: true } });

  await createNotification({
    ownerId,
    recipientId: null,
    storeId: result.saleStoreId,
    type: "sale_made",
    message: staffName?.fullName ? `${staffName.fullName} made a sale of ${naira}.` : `A sale of ${naira} was made.`,
    link: "/owner/dashboard",
  });

  // Low-stock notifications for the list side (scale side already covered
  // by the same check inside sellFromScaleConsignmentAction's flow — here
  // we mirror it for consistency, keyed off Inventory.restockLevel).
  for (const cart of listCartItems) {
    const updated = await prisma.inventory.findUnique({ where: { id: cart.id } });
    if (updated?.restockLevel != null && updated.quantity <= updated.restockLevel) {
      await createNotification({
        ownerId,
        recipientId: null,
        storeId: result.saleStoreId,
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
  revalidatePath("/owner/consignments");
  return { success: true, total: result.total };
}

// ============================================================================
// Auto-settlement for admin-override scale consignments
// ============================================================================
// Distinct from settleScaleConsignment above (which is the staff-entered,
// one-time settlement for external-recipient consignments on native scale
// stores). Here, quantitySold is already accurate — it was tracked live by
// sellFromScaleConsignmentAction on every sale — so this just closes the
// day out: whatever's left (quantityOut - quantitySold) goes back onto
// ScaleInventory, and the consignment is marked settled. No new Order is
// created (those were already created at time of sale).
export async function autoSettleScaleConsignment(consignmentId: number, source: "manual" | "midnight" = "manual") {
  const consignment = await prisma.consignment.findUnique({
    where: { id: consignmentId },
    include: {
      scaleItems: { include: { scaleInventory: { select: { name: true } } } },
      staff: { select: { fullName: true } },
    },
  });
  if (!consignment) throw new Error("Consignment not found");
  if (consignment.status !== "out") return { success: true, skipped: true };

  for (const item of consignment.scaleItems) {
    const sold = Number(item.quantitySold);
    const wasted = Number(item.quantityWasted);
    const returned = Math.max(0, Number(item.quantityOut) - sold - wasted);

    await prisma.scaleConsignmentItem.update({
      where: { id: item.id },
      data: { quantityReturned: returned },
    });

    if (returned > 0) {
      await prisma.scaleInventory.update({
        where: { id: item.scaleInventoryId },
        data: { quantity: { increment: returned } },
      });
    }
  }

  await prisma.consignment.update({
    where: { id: consignmentId },
    data: { status: "settled", settledAt: new Date() },
  });

  await createNotification({
    ownerId: consignment.ownerId,
    recipientId: null,
    storeId: consignment.storeId,
    type: "announcement",
    message:
      source === "midnight"
        ? `${consignment.staff?.fullName || "Staff"}'s scale consignment was auto-settled at midnight — unsold stock is back in your inventory.`
        : `${consignment.staff?.fullName || "Staff"}'s scale consignment was reconciled — unsold stock is back in your inventory.`,
    link: "/owner/consignments",
  });

  revalidatePath("/staff/inventory");
  revalidatePath("/owner/consignments");
  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function ownerReconcileScaleConsignmentAction(consignmentId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const consignment = await prisma.consignment.findUnique({
    where: { id: consignmentId },
    select: { ownerId: true },
  });
  if (!consignment || consignment.ownerId !== session.id) throw new Error("Not found");

  return autoSettleScaleConsignment(consignmentId, "manual");
}

export async function getScaleConsignmentsForOwner(storeId?: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  return prisma.consignment.findMany({
    where: {
      ownerId: session.id,
      ...(storeId ? { storeId } : {}),
    },
    include: {
      staff: { select: { fullName: true } },
      store: { select: { id: true, name: true } },
      scaleItems: { include: { scaleInventory: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}