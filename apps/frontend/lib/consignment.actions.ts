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
  if (!activeStore || activeStore.storeType !== "scale") {
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

  return prisma.consignment.findMany({
    where: { staffId: session.id, status: "out" },
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

  return prisma.consignment.findMany({
    where: { staffId: session.id, status: "settled" },
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