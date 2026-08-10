// FILE: apps/frontend/lib/stock-batch.actions.ts
//
// Read-only actions backing the owner's Batches UI. Everything here is
// derived from StockBatch/OrderItemBatch (Stages 1–2) plus StockLoss/
// StockReturn (Stage 4) — no new mutations of its own beyond what those
// stages already wrote; this just shapes that data for the product
// detail page and the per-batch detail page (Stock Usage, Sales
// overview/history, Customers, Loss, Returns, Activity).

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";

// A product's own detail page — the item plus every batch ever added to
// it, newest first, each flagged active/depleted by whether it still has
// stock left.
export async function getInventoryWithBatches(inventoryId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const item = await prisma.inventory.findFirst({
    where: { id: inventoryId, ownerId: session.id },
    include: { categoryRef: { select: { name: true } } },
  });
  if (!item) return null;

  const batchRows = await prisma.stockBatch.findMany({
    where: { inventoryId },
    orderBy: { addedAt: "desc" },
  });

  return {
    item: {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      categoryName: item.categoryRef?.name ?? item.category,
      sku: item.sku,
      description: item.description,
      image: item.image,
      image2: item.image2,
      image3: item.image3,
      trackExpiry: item.trackExpiry,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
      restockLevel: item.restockLevel,
      margin:
        item.costPrice != null && Number(item.price) > 0
          ? Math.round(((Number(item.price) - Number(item.costPrice)) / Number(item.price)) * 1000) / 10
          : null,
    },
    batches: batchRows.map((b) => ({
      id: b.id,
      addedAt: b.addedAt.toISOString(),
      originalQty: b.originalQty,
      remainingQty: b.remainingQty,
      isActive: b.remainingQty > 0,
    })),
  };
}

// Full detail for one batch: the Stock Usage bar, the Sales-tab overview
// + history, the Customers breakdown, and a merged Activity timeline.
// Loss/Returns tabs — wired in Stage 4.
export async function getBatchDetail(batchId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const batch = await prisma.stockBatch.findFirst({
    where: { id: batchId, ownerId: session.id },
    include: {
      inventory: { select: { id: true, name: true, image: true, sku: true } },
      createdBy: { select: { fullName: true, email: true } },
    },
  });
  if (!batch) return null;

  const [lines, lossRows, returnRows] = await Promise.all([
    prisma.orderItemBatch.findMany({
      where: { stockBatchId: batchId },
      include: {
        orderItem: {
          select: {
            id: true,
            priceAtTime: true,
            originalPrice: true,
            order: {
              select: {
                id: true,
                buyerName: true,
                customerId: true,
                paymentMethod: true,
                date: true,
                staff: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.stockLoss.findMany({
      where: { stockBatchId: batchId },
      include: { recordedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stockReturn.findMany({
      where: { stockBatchId: batchId },
      include: { recordedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const consumedQty = batch.originalQty - batch.remainingQty;
  const costPrice = batch.costPrice != null ? Number(batch.costPrice) : 0;

  let expectedRevenue = 0;
  let actualRevenue = 0;

  const salesHistory: {
    id: number;
    orderId: number;
    buyerName: string;
    quantity: number;
    amount: number;
    date: string;
    paymentMethod: string;
    staffName: string | null;
  }[] = [];

  type CustomerAgg = { name: string; orders: Set<number>; quantity: number; spent: number };
  const customerMap = new Map<string, CustomerAgg>();

  for (const line of lines) {
    const oi = line.orderItem;
    const unitPrice = Number(oi.priceAtTime);
    const unitOriginal = oi.originalPrice != null ? Number(oi.originalPrice) : unitPrice;
    const lineActual = unitPrice * line.quantity;
    const lineExpected = unitOriginal * line.quantity;

    actualRevenue += lineActual;
    expectedRevenue += lineExpected;

    const buyerName = oi.order.buyerName?.trim() || "Walk-in";
    const staffName = oi.order.staff?.fullName || oi.order.staff?.email || null;

    salesHistory.push({
      id: line.id,
      orderId: oi.order.id,
      buyerName,
      quantity: line.quantity,
      amount: lineActual,
      date: oi.order.date.toISOString(),
      paymentMethod: oi.order.paymentMethod,
      staffName,
    });

    const key = oi.order.customerId != null ? `c:${oi.order.customerId}` : `n:${buyerName}`;
    const existing = customerMap.get(key) ?? { name: buyerName, orders: new Set<number>(), quantity: 0, spent: 0 };
    existing.orders.add(oi.order.id);
    existing.quantity += line.quantity;
    existing.spent += lineActual;
    customerMap.set(key, existing);
  }

  const costSpent = consumedQty * costPrice;
  const discountGiven = Math.max(0, expectedRevenue - actualRevenue);

  const customers = Array.from(customerMap.values())
    .map((c) => ({ name: c.name, orderCount: c.orders.size, quantity: c.quantity, spent: c.spent }))
    .sort((a, b) => b.spent - a.spent);

  const losses = lossRows.map((l) => ({
    id: l.id,
    quantity: l.quantity,
    reason: l.reason,
    note: l.note,
    date: l.createdAt.toISOString(),
    recordedByName: l.recordedBy?.fullName || l.recordedBy?.email || null,
  }));

  const returns = returnRows.map((r) => ({
    id: r.id,
    quantity: r.quantity,
    supplierName: r.supplierName,
    reason: r.reason,
    refundAmount: r.refundAmount != null ? Number(r.refundAmount) : null,
    note: r.note,
    date: r.createdAt.toISOString(),
    recordedByName: r.recordedBy?.fullName || r.recordedBy?.email || null,
  }));

  const activity: {
    type: "created" | "sold" | "loss" | "return";
    staffName: string | null;
    buyerName?: string;
    orderId?: number;
    quantity: number;
    date: string;
    paymentMethod: string | null;
    detail?: string | null;
  }[] = [
    {
      type: "created" as const,
      staffName: batch.createdBy?.fullName || batch.createdBy?.email || null,
      quantity: batch.originalQty,
      date: batch.addedAt.toISOString(),
      paymentMethod: batch.paymentMethod,
    },
    ...salesHistory.map((s) => ({
      type: "sold" as const,
      staffName: s.staffName,
      buyerName: s.buyerName,
      orderId: s.orderId,
      quantity: s.quantity,
      date: s.date,
      paymentMethod: s.paymentMethod,
    })),
    ...losses.map((l) => ({
      type: "loss" as const,
      staffName: l.recordedByName,
      quantity: l.quantity,
      date: l.date,
      paymentMethod: null,
      detail: l.reason,
    })),
    ...returns.map((r) => ({
      type: "return" as const,
      staffName: r.recordedByName,
      quantity: r.quantity,
      date: r.date,
      paymentMethod: null,
      detail: r.supplierName ? `to ${r.supplierName}` : null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    id: batch.id,
    inventoryId: batch.inventoryId,
    inventoryName: batch.inventory.name,
    inventoryImage: batch.inventory.image,
    addedAt: batch.addedAt.toISOString(),
    originalQty: batch.originalQty,
    remainingQty: batch.remainingQty,
    consumedQty,
    percentUsed: batch.originalQty > 0 ? Math.round((consumedQty / batch.originalQty) * 100) : 0,
    costPrice: batch.costPrice != null ? Number(batch.costPrice) : null,
    sellingPriceAtTime: Number(batch.sellingPriceAtTime),
    expiryDate: batch.expiryDate ? batch.expiryDate.toISOString() : null,
    paymentMethod: batch.paymentMethod,
    isActive: batch.remainingQty > 0,
    createdByName: batch.createdBy?.fullName || batch.createdBy?.email || null,
    salesOverview: {
      costSpent,
      expectedRevenue,
      actualRevenue,
      discountGiven,
      ordersCount: new Set(salesHistory.map((s) => s.orderId)).size,
      quantitySold: consumedQty,
    },
    salesHistory,
    customers,
    losses,
    returns,
    activity,
  };
}