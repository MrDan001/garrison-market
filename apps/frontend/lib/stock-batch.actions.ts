// FILE: apps/frontend/lib/stock-batch-scale.actions.ts
//
// Scale-inventory counterpart to stock-batch.actions.ts — same shape,
// same purpose, just reading ScaleStockBatch/ScaleOrderItemBatch/
// ScaleStockLoss/ScaleStockReturn instead of the standard-inventory
// models, and unit-aware (kg/L) instead of a bare count.

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";

export async function getScaleInventoryWithBatches(scaleInventoryId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const item = await prisma.scaleInventory.findFirst({
    where: { id: scaleInventoryId, ownerId: session.id },
    include: { categoryRef: { select: { name: true } } },
  });
  if (!item) return null;

  const batchRows = await prisma.scaleStockBatch.findMany({
    where: { scaleInventoryId },
    orderBy: { addedAt: "desc" },
  });

  return {
    item: {
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
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
      restockLevel: item.restockLevel != null ? Number(item.restockLevel) : null,
      margin:
        item.costPrice != null && Number(item.price) > 0
          ? Math.round(((Number(item.price) - Number(item.costPrice)) / Number(item.price)) * 1000) / 10
          : null,
    },
    batches: batchRows.map((b) => ({
      id: b.id,
      addedAt: b.addedAt.toISOString(),
      originalQty: Number(b.originalQty),
      remainingQty: Number(b.remainingQty),
      unit: item.unit,
      isActive: Number(b.remainingQty) > 0,
    })),
  };
}

export async function getScaleBatchDetail(batchId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const batch = await prisma.scaleStockBatch.findFirst({
    where: { id: batchId, ownerId: session.id },
    include: {
      scaleInventory: { select: { id: true, name: true, image: true, sku: true, unit: true } },
      createdBy: { select: { fullName: true, email: true } },
    },
  });
  if (!batch) return null;

  const [lines, lossRows, returnRows] = await Promise.all([
    prisma.scaleOrderItemBatch.findMany({
      where: { scaleStockBatchId: batchId },
      include: {
        scaleOrderItem: {
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
    prisma.scaleStockLoss.findMany({
      where: { scaleStockBatchId: batchId },
      include: { recordedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scaleStockReturn.findMany({
      where: { scaleStockBatchId: batchId },
      include: { recordedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const unit = batch.scaleInventory.unit;
  const originalQty = Number(batch.originalQty);
  const remainingQty = Number(batch.remainingQty);
  const consumedQty = originalQty - remainingQty;
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
    const oi = line.scaleOrderItem;
    const lineQty = Number(line.quantity);
    // priceAtTime/originalPrice on ScaleOrderItem are per-base-unit prices
    // (see processScaleSaleAction), so line revenue is qty * price, same
    // shape as standard inventory's per-unit math.
    const unitPrice = Number(oi.priceAtTime);
    const unitOriginal = oi.originalPrice != null ? Number(oi.originalPrice) : unitPrice;
    const lineActual = unitPrice * lineQty;
    const lineExpected = unitOriginal * lineQty;

    actualRevenue += lineActual;
    expectedRevenue += lineExpected;

    const buyerName = oi.order.buyerName?.trim() || "Walk-in";
    const staffName = oi.order.staff?.fullName || oi.order.staff?.email || null;

    salesHistory.push({
      id: line.id,
      orderId: oi.order.id,
      buyerName,
      quantity: lineQty,
      amount: lineActual,
      date: oi.order.date.toISOString(),
      paymentMethod: oi.order.paymentMethod,
      staffName,
    });

    const key = oi.order.customerId != null ? `c:${oi.order.customerId}` : `n:${buyerName}`;
    const existing = customerMap.get(key) ?? { name: buyerName, orders: new Set<number>(), quantity: 0, spent: 0 };
    existing.orders.add(oi.order.id);
    existing.quantity += lineQty;
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
    quantity: Number(l.quantity),
    reason: l.reason,
    note: l.note,
    date: l.createdAt.toISOString(),
    recordedByName: l.recordedBy?.fullName || l.recordedBy?.email || null,
  }));

  const returns = returnRows.map((r) => ({
    id: r.id,
    quantity: Number(r.quantity),
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
      quantity: originalQty,
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
    scaleInventoryId: batch.scaleInventoryId,
    inventoryName: batch.scaleInventory.name,
    inventoryImage: batch.scaleInventory.image,
    unit,
    addedAt: batch.addedAt.toISOString(),
    originalQty,
    remainingQty,
    consumedQty,
    percentUsed: originalQty > 0 ? Math.round((consumedQty / originalQty) * 100) : 0,
    costPrice: batch.costPrice != null ? Number(batch.costPrice) : null,
    sellingPriceAtTime: Number(batch.sellingPriceAtTime),
    expiryDate: batch.expiryDate ? batch.expiryDate.toISOString() : null,
    paymentMethod: batch.paymentMethod,
    isActive: remainingQty > 0,
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