// FILE: apps/frontend/lib/consignment.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createNotification } from "./notification.actions";
import { getActiveStoreId, getActiveStore } from "./store-context";
import { assertSubscriptionActive, hasFeatureAccess } from "./subscription-guard";
import { sendConsignmentSettlementEmail } from "./email";
import { convertToBaseUnit } from "./scale-units";
import { awardXp } from "./rush.actions";

type SignOutItem = { inventoryId: number; quantityOut: number };
type SignOutScaleItem = { scaleInventoryId: number; enteredQty: number; enteredUnit: string };

export async function isConsignmentEnabledForStaff() {
  const session = await getSessionUser();
  if (!session) return false;

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) return false;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      consignmentEnabled: true, plan: true, subscriptionStatus: true, trialEndsAt: true,
      // maxPackageEnabled was missing here before — resolveEffectivePlanId()
      // reads it to resolve Max regardless of what `plan` says, so without
      // it a Max owner relying on the flag (rather than plan:"max" stored)
      // could fail this check. staffConsignmentOverride is the new
      // admin-override half of the check, via hasFeatureAccess() below.
      maxPackageEnabled: true, staffConsignmentOverride: true,
    },
  });

  // Both the owner's manual toggle AND (plan OR admin override) must allow
  // it — Basic plan owners without an override never see consignment
  // regardless of the toggle state, but an active trial counts as Pro,
  // and an override always wins regardless of plan.
  return (owner?.consignmentEnabled ?? false) && (owner ? hasFeatureAccess(owner, "staffConsignment") : false);
}

// Owner-side twin of isConsignmentEnabledForStaff above — same toggle,
// different plan feature (ownerConsignment, Max-only, instead of
// staffConsignment). Used by the owner's own consignments page to decide
// whether to render the sign-out form or an upgrade prompt, matching what
// signOutConsignment itself now actually enforces server-side.
export async function isConsignmentEnabledForOwner() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return false;

  const owner = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      consignmentEnabled: true, plan: true, subscriptionStatus: true, trialEndsAt: true,
      maxPackageEnabled: true, ownerConsignmentOverride: true,
    },
  });

  return (owner?.consignmentEnabled ?? false) && (owner ? hasFeatureAccess(owner, "ownerConsignment") : false);
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
    select: {
      consignmentEnabled: true, plan: true, subscriptionStatus: true, trialEndsAt: true,
      maxPackageEnabled: true, staffConsignmentOverride: true, ownerConsignmentOverride: true,
    },
  });
  if (!owner?.consignmentEnabled) throw new Error("Consignment is not enabled for this store");

  // The toggle above just means the owner has turned consignment ON for
  // their store at all — this is the separate question of whether THIS
  // caller's role is entitled to use it. Staff need Pro+Max
  // (staffConsignment); the owner personally doing this needs Max
  // (ownerConsignment) — this is the actual enforcement of the
  // Staff/Owner Consignment split, previously only reflected in which UI
  // page had a form on it, never checked here.
  const requiredFeature = session.role === "owner" ? "ownerConsignment" : "staffConsignment";
  if (!hasFeatureAccess(owner, requiredFeature)) {
    throw new Error(
      session.role === "owner"
        ? "UPGRADE_REQUIRED: Signing consignment stock out yourself requires the Max Package."
        : "UPGRADE_REQUIRED: Consignment requires the Pro plan or higher."
    );
  }

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

  // Create the consignment and decrement stock together, atomically —
  // previously these were two separate top-level calls, so a failed or
  // interleaved decrement could leave a consignment recording more stock
  // signed out than was actually deducted. Each decrement also re-checks
  // the quantity we originally read (optimistic lock) so a concurrent
  // sign-out of the same item can't push stock negative.
  const consignment = await prisma.$transaction(async (tx) => {
    const created = await tx.consignment.create({
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
      const inv = inventoryRows.find((r) => r.id === item.inventoryId)!;
      const updateResult = await tx.inventory.updateMany({
        where: { id: item.inventoryId, quantity: inv.quantity },
        data: { quantity: { decrement: item.quantityOut } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${inv.name} stock changed before sign-out could complete — please try again.`);
      }
    }

    return created;
  });

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

  // Everything below runs in one transaction, and the status flip happens
  // FIRST via an optimistic-lock updateMany (only succeeds if status is
  // still "out"). Previously the "already settled" check above was a
  // plain read followed by several separate writes — two near-simultaneous
  // submits (e.g. a double-tap) could both pass that read before either
  // committed, producing duplicate Orders and duplicate inventory returns.
  // Locking the status first means only one concurrent call can proceed.
  await prisma.$transaction(async (tx) => {
    const lock = await tx.consignment.updateMany({
      where: { id: consignmentId, status: "out" },
      data: { status: "settled", settledAt: new Date() },
    });
    if (lock.count === 0) {
      throw new Error("This consignment is already settled");
    }

    if (soldItems.length > 0) {
      await tx.order.create({
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

      await tx.consignmentItem.update({
        where: { id: s.itemId },
        data: { quantitySold: s.quantitySold, quantityReturned: s.quantityReturned },
      });

      if (s.quantityReturned > 0) {
        await tx.inventory.update({
          where: { id: item.inventoryId },
          data: { quantity: { increment: s.quantityReturned } },
        });
      }
    }
  });

  // Rush XP — settling a consignment is the closest thing this app has to
  // "closing out" a shift's stock, and the sold+returned=out validation
  // above already guarantees it balances. Fire-and-forget; awardXp()
  // catches its own errors and can never block the real settlement.
  await awardXp(session.id, consignment.storeId!, "REGISTER_CLEAN", { consignmentId });

  // Same broadcast bug as the other notifications above: recipientId: null
  // meant the staff member who just settled this (and every other staff
  // member) saw "Consignment with X was settled" in their own feed too.
  // This is owner-facing reconciliation info, not something staff need
  // pinged about, so it's targeted at the owner specifically.
  await createNotification({
    ownerId: consignment.ownerId,
    recipientId: consignment.ownerId,
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
    select: {
      consignmentEnabled: true, scaleConsignmentEnabled: true, plan: true, subscriptionStatus: true,
      trialEndsAt: true, maxPackageEnabled: true, staffConsignmentOverride: true, ownerConsignmentOverride: true,
    },
  });
  if (!owner?.consignmentEnabled) throw new Error("Consignment is not enabled for this store");

  // Same role-aware check as signOutConsignment above, and the same
  // reasoning: the toggle is "does this store use consignment at all",
  // this is "is this caller's role entitled to it". Applies here
  // identically for the Scale/weight system.
  const requiredFeature = session.role === "owner" ? "ownerConsignment" : "staffConsignment";
  if (!hasFeatureAccess(owner, requiredFeature)) {
    throw new Error(
      session.role === "owner"
        ? "UPGRADE_REQUIRED: Signing consignment stock out yourself requires the Max Package."
        : "UPGRADE_REQUIRED: Consignment requires the Pro plan or higher."
    );
  }

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
  // Scale layer on top of an otherwise-untouched standard store). Reuses
  // the `owner` record fetched above instead of querying a second time.
  if (activeStore.storeType !== "scale" && !owner.scaleConsignmentEnabled) {
    throw new Error("This action is only available for weight/volume stores");
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

  // Create the consignment and decrement stock together, atomically — see
  // the same fix in signOutConsignment above for why. Each decrement
  // re-checks the quantity we originally read (optimistic lock).
  const consignment = await prisma.$transaction(async (tx) => {
    const created = await tx.consignment.create({
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

    for (const { item, baseQty, inv } of resolved) {
      const updateResult = await tx.scaleInventory.updateMany({
        where: { id: item.scaleInventoryId, quantity: inv.quantity },
        data: { quantity: { decrement: baseQty } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${inv.name} stock changed before sign-out could complete — please try again.`);
      }
    }

    return created;
  });

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
      scaleItems: { include: { scaleInventory: { include: { categoryRef: { select: { name: true } } } } } },
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

  // Everything below runs in one transaction, and the status flip happens
  // FIRST via an optimistic-lock updateMany (only succeeds if status is
  // still "out") — same fix as settleConsignment above, closing the
  // double-submit race where two near-simultaneous settle calls could
  // both pass the earlier status read before either committed.
  await prisma.$transaction(async (tx) => {
    const lock = await tx.consignment.updateMany({
      where: { id: consignmentId, status: "out" },
      data: { status: "settled", settledAt: new Date() },
    });
    if (lock.count === 0) {
      throw new Error("This consignment is already settled");
    }

    if (soldItems.length > 0) {
      await tx.order.create({
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

      await tx.scaleConsignmentItem.update({
        where: { id: s.itemId },
        data: { quantitySold: s.quantitySold, quantityReturned: s.quantityReturned },
      });

      if (s.quantityReturned > 0) {
        await tx.scaleInventory.update({
          where: { id: item.scaleInventoryId },
          data: { quantity: { increment: s.quantityReturned } },
        });
      }
    }
  });

  // Rush XP — same reasoning as the standard settleConsignment above.
  await awardXp(session.id, consignment.storeId!, "REGISTER_CLEAN", { consignmentId });

  // Same broadcast bug as the other notifications above: recipientId: null
  // meant the staff member who just settled this (and every other staff
  // member) saw "Consignment with X was settled" in their own feed too.
  // This is owner-facing reconciliation info, not something staff need
  // pinged about, so it's targeted at the owner specifically.
  await createNotification({
    ownerId: consignment.ownerId,
    recipientId: consignment.ownerId,
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
    select: {
      scaleConsignmentEnabled: true, plan: true, subscriptionStatus: true, trialEndsAt: true,
      maxPackageEnabled: true, ownerConsignmentOverride: true,
    },
  });
  if (!owner?.scaleConsignmentEnabled) {
    throw new Error("Scale Consignment is not enabled for this account.");
  }

  // scaleConsignmentEnabled above answers "does the Scale Consignment
  // subsystem exist for this store" — this is the separate question of
  // whether this owner's plan tier entitles them to use it themselves.
  // This action is owner-only (checked above), so it's always the Max-tier
  // ownerConsignment flag, never staffConsignment.
  if (!hasFeatureAccess(owner, "ownerConsignment")) {
    throw new Error("UPGRADE_REQUIRED: Signing scale stock out to staff requires the Max Package.");
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

    // Decrement stock in the SAME transaction as the create/top-up below —
    // previously this ran as a separate step after the transaction
    // committed, so a failed decrement could leave a consignment recording
    // more stock signed out than was actually deducted. Optimistic lock on
    // the quantity we originally read guards against a concurrent sign-out
    // of the same item.
    for (const { item, baseQty, inv } of resolved) {
      const updateResult = await tx.scaleInventory.updateMany({
        where: { id: item.scaleInventoryId, quantity: inv.quantity },
        data: { quantity: { decrement: baseQty } },
      });
      if (updateResult.count === 0) {
        throw new Error(`${inv.name} stock changed before sign-out could complete — please try again.`);
      }
    }

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

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) throw new Error("No owner scope found for this account");
  await assertSubscriptionActive(ownerId);

  // Selling against stock someone already signed out is the "Staff
  // Consignment" capability in the plan table — Pro+Max — regardless of
  // whether the session invoking it happens to be staff or the owner
  // themselves filling in at the till.
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true, maxPackageEnabled: true, staffConsignmentOverride: true },
  });
  if (!owner || !hasFeatureAccess(owner, "staffConsignment")) {
    throw new Error("UPGRADE_REQUIRED: Consignment requires the Pro plan or higher.");
  }

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

      const remaining = Number(row.quantityOut) - Number(row.quantitySold) - Number(row.quantityWasted ?? 0);
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

    // Resolved via tx (not the resolveOrCreateCustomer helper, which uses
    // the standalone prisma client) since saleStoreId is only known once
    // we're inside the transaction and reading the consignment row above.
    const cleanName = buyerName?.trim();
    const cleanPhone = buyerPhone?.trim();
    let customerId: number | null = null;
    if (cleanPhone && saleStoreId) {
      const customer = await tx.customer.upsert({
        where: { storeId_phone: { storeId: saleStoreId, phone: cleanPhone } },
        update: cleanName ? { name: cleanName } : {},
        create: { ownerId, storeId: saleStoreId, phone: cleanPhone, name: cleanName || "Customer" },
        select: { id: true },
      });
      customerId = customer.id;
    }

    await tx.order.create({
      data: {
        total,
        paymentMethod,
        buyerName: cleanName || "Walk-in Customer",
        buyerPhone: cleanPhone || null,
        ownerId,
        staffId: session.id,
        storeId: saleStoreId,
        customerId,
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
  buyerPhone?: string,
  paymentStatus: "full" | "partial" = "full",
  amountPaid?: number
) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  if (listCartItems.length === 0 && scaleCartItems.length === 0) throw new Error("Cart is empty");

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) throw new Error("No owner scope found for this account");
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

  const cleanNamePre = buyerName?.trim();
  const cleanPhonePre = buyerPhone?.trim();
  const isPartial = paymentStatus === "partial";
  if (isPartial) {
    if (!cleanNamePre || !cleanPhonePre) {
      throw new Error("Customer name and phone number are required for a part payment.");
    }
    if (amountPaid == null || isNaN(amountPaid) || amountPaid < 0) {
      throw new Error("Enter a valid amount paid.");
    }
  }

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

    if (isPartial && amountPaid! >= total) {
      throw new Error("Amount paid covers the full total — select \"Paid in full\" instead.");
    }

    // Storefront for the sale: prefer the active store cookie, falling back
    // to wherever the scale consignment lines were signed out under (both
    // should normally agree for a merged-mode staff member).
    const saleStoreId = activeStoreId ?? resolvedScale[0]?.row.consignment.storeId ?? null;

    // Same inline pattern as sellFromScaleConsignmentAction — saleStoreId
    // is only settled once we're inside the transaction, so this uses tx
    // directly rather than the resolveOrCreateCustomer helper.
    const cleanName = buyerName?.trim();
    const cleanPhone = buyerPhone?.trim();
    let customerId: number | null = null;
    if (cleanPhone && saleStoreId) {
      const customer = await tx.customer.upsert({
        where: { storeId_phone: { storeId: saleStoreId, phone: cleanPhone } },
        update: cleanName ? { name: cleanName } : {},
        create: { ownerId, storeId: saleStoreId, phone: cleanPhone, name: cleanName || "Customer" },
        select: { id: true },
      });
      customerId = customer.id;
    }

    if (isPartial && !customerId) {
      throw new Error("Couldn't link a customer for this part payment. Please try again.");
    }

    const order = await tx.order.create({
      data: {
        total,
        paymentMethod,
        buyerName: cleanName || "Walk-in Customer",
        buyerPhone: cleanPhone || null,
        ownerId,
        staffId: session.id,
        storeId: saleStoreId,
        customerId,
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

    if (isPartial) {
      const debt = await tx.debt.create({
        data: {
          orderId: order.id,
          customerId: customerId!,
          ownerId,
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
  }, { maxWait: 10000, timeout: 20000 });

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

  if (isPartial) {
    const owedNaira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(result.total - amountPaid!);
    await createNotification({
      ownerId,
      recipientId: null,
      storeId: result.saleStoreId,
      type: "debt_logged",
      message: staffName?.fullName
        ? `${staffName.fullName} logged a part payment — ${cleanNamePre} still owes ${owedNaira}.`
        : `A part payment was logged — ${cleanNamePre} still owes ${owedNaira}.`,
      link: "/owner/customers",
    });
  }

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
  revalidatePath("/owner/customers");
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
//
// NOT exported: this does the actual settlement with no session/ownership
// check of its own, so it must only ever be reached through one of the two
// narrow, purpose-built entry points below — ownerReconcileScaleConsignmentAction
// (owner-authed) or autoSettleScaleConsignmentForCron (only ever called from
// the CRON_SECRET-protected midnight route). Keeping it unexported means
// nothing else in the codebase can import and call it directly with an
// arbitrary consignmentId.
async function settleScaleConsignmentCore(consignmentId: number, source: "manual" | "midnight" = "manual") {
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

  // Same broadcast bug as report_submitted: recipientId: null means
  // getNotificationsForStaff shows this to EVERY staff member under this
  // owner, not just the owner — so the staff member whose own consignment
  // was settled (and every other staff member too) was seeing "X's scale
  // consignment was auto-settled..." in their own feed. This is
  // owner-facing inventory info, not something staff need pinged about,
  // so it's now targeted at the owner specifically.
  await createNotification({
    ownerId: consignment.ownerId,
    recipientId: consignment.ownerId,
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

  return settleScaleConsignmentCore(consignmentId, "manual");
}

// Cron-only entry point — called exclusively from runMidnightScaleConsignmentReset,
// which is itself only reachable via the CRON_SECRET-protected route at
// app/api/cron/scale-consignment-reset/route.ts. There's no user session at
// midnight, so this can't check a session the way ownerReconcileScaleConsignmentAction
// does; the narrow name and scope (vs. the old generic autoSettleScaleConsignment)
// make it much harder to accidentally reach from anywhere else.
export async function autoSettleScaleConsignmentForCron(consignmentId: number) {
  return settleScaleConsignmentCore(consignmentId, "midnight");
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