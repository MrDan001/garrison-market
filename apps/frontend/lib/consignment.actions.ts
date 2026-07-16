"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification.actions";
import { getActiveStoreId } from "./store-context";

type SignOutItem = { inventoryId: number; quantityOut: number };

export async function isConsignmentEnabledForStaff() {
  const session = await getSessionUser();
  if (!session) return false;

  const ownerId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerId) return false;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { consignmentEnabled: true },
  });

  return owner?.consignmentEnabled ?? false;
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
    include: { items: true },
  });
  if (!consignment) throw new Error("Consignment not found");
  if (consignment.staffId !== session.id) throw new Error("Unauthorized");
  if (consignment.status !== "out") throw new Error("This consignment is already settled");

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