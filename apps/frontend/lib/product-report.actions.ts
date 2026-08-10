// FILE: apps/frontend/lib/product-report.actions.ts
//
// Data layer for the per-product Report tab (Stage 1). Aggregates
// OrderItem/ScaleOrderItem rows for one product over a date range into
// the summary cards + chart series the Report tab shows.
//
// Profit uses real per-batch cost snapshots where available (via
// OrderItemBatch/ScaleOrderItemBatch → StockBatch/ScaleStockBatch.costPrice
// from Stages 1-6) rather than just "today's cost price" — a sale made
// last month still reflects what that batch actually cost back then, even
// if the product's cost price has since changed. Any quantity that can't
// be traced to a batch (pre-batch-tracking sales, or a batch with no cost
// price recorded) falls back to the product's current cost price so the
// numbers stay complete rather than silently undercounting cost.

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildDailyRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    days.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function getProductReport(inventoryId: number, startDate: string, endDate: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const item = await prisma.inventory.findFirst({
    where: { id: inventoryId, ownerId: session.id },
    select: { id: true, name: true, price: true, costPrice: true },
  });
  if (!item) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const lines = await prisma.orderItem.findMany({
    where: {
      inventoryId,
      order: { date: { gte: start, lte: end } },
    },
    include: {
      order: { select: { id: true, date: true, customerId: true, buyerName: true } },
      batchLines: { include: { stockBatch: { select: { costPrice: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const fallbackCost = item.costPrice != null ? Number(item.costPrice) : 0;

  let revenue = 0;
  let profit = 0;
  let qtySold = 0;
  let totalDiscounts = 0;
  const orderIds = new Set<number>();
  const customerKeys = new Set<string>();
  const dailyMap = new Map<string, { qty: number; revenue: number; profit: number }>();
  const dayOfWeekRevenue = [0, 0, 0, 0, 0, 0, 0];

  for (const line of lines) {
    const unitPrice = Number(line.priceAtTime);
    const unitOriginal = line.originalPrice != null ? Number(line.originalPrice) : unitPrice;
    const lineRevenue = unitPrice * line.quantity;
    const lineDiscount = Math.max(0, (unitOriginal - unitPrice) * line.quantity);

    // Cost: sum what's attributable to real batches, fall back to current
    // cost price for whatever quantity isn't (see file header).
    const batchAttributedQty = line.batchLines.reduce((sum, bl) => sum + bl.quantity, 0);
    const batchCost = line.batchLines.reduce((sum, bl) => {
      const cp = bl.stockBatch.costPrice != null ? Number(bl.stockBatch.costPrice) : fallbackCost;
      return sum + cp * bl.quantity;
    }, 0);
    const unattributedQty = Math.max(0, line.quantity - batchAttributedQty);
    const lineCost = batchCost + unattributedQty * fallbackCost;
    const lineProfit = lineRevenue - lineCost;

    revenue += lineRevenue;
    profit += lineProfit;
    qtySold += line.quantity;
    totalDiscounts += lineDiscount;
    orderIds.add(line.order.id);
    customerKeys.add(line.order.customerId != null ? `c:${line.order.customerId}` : `n:${line.order.buyerName || "walk-in"}`);

    const key = dateKey(line.order.date);
    const existing = dailyMap.get(key) ?? { qty: 0, revenue: 0, profit: 0 };
    existing.qty += line.quantity;
    existing.revenue += lineRevenue;
    existing.profit += lineProfit;
    dailyMap.set(key, existing);

    dayOfWeekRevenue[line.order.date.getUTCDay()] += lineRevenue;
  }

  const dailyKeys = buildDailyRange(start, end);
  const dailySeries = dailyKeys.map((key) => ({
    date: key,
    qty: dailyMap.get(key)?.qty ?? 0,
    revenue: dailyMap.get(key)?.revenue ?? 0,
    profit: dailyMap.get(key)?.profit ?? 0,
  }));

  const dayOfWeekSeries = DAY_NAMES.map((day, i) => ({ day, revenue: dayOfWeekRevenue[i] }));

  return {
    itemName: item.name,
    range: { start: startDate, end: endDate },
    summary: {
      revenue,
      profit,
      qtySold,
      orders: orderIds.size,
      customers: customerKeys.size,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      totalDiscounts,
    },
    dailySeries,
    dayOfWeekSeries,
  };
}

export async function getScaleProductReport(scaleInventoryId: number, startDate: string, endDate: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const item = await prisma.scaleInventory.findFirst({
    where: { id: scaleInventoryId, ownerId: session.id },
    select: { id: true, name: true, unit: true, price: true, costPrice: true },
  });
  if (!item) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const lines = await prisma.scaleOrderItem.findMany({
    where: {
      scaleInventoryId,
      order: { date: { gte: start, lte: end } },
    },
    include: {
      order: { select: { id: true, date: true, customerId: true, buyerName: true } },
      batchLines: { include: { scaleStockBatch: { select: { costPrice: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const fallbackCost = item.costPrice != null ? Number(item.costPrice) : 0;

  let revenue = 0;
  let profit = 0;
  let qtySold = 0;
  let totalDiscounts = 0;
  const orderIds = new Set<number>();
  const customerKeys = new Set<string>();
  const dailyMap = new Map<string, { qty: number; revenue: number; profit: number }>();
  const dayOfWeekRevenue = [0, 0, 0, 0, 0, 0, 0];

  for (const line of lines) {
    const baseQty = Number(line.quantityInBaseUnit);
    // priceAtTime/originalPrice on ScaleOrderItem are already totals for
    // the line (see processScaleSaleAction — priceAtTime = per-unit price
    // * baseQty), not per-unit, unlike standard OrderItem.
    const lineRevenue = Number(line.priceAtTime);
    const lineOriginal = line.originalPrice != null ? Number(line.originalPrice) : lineRevenue;
    const lineDiscount = Math.max(0, lineOriginal - lineRevenue);

    const batchAttributedQty = line.batchLines.reduce((sum, bl) => sum + Number(bl.quantity), 0);
    const batchCost = line.batchLines.reduce((sum, bl) => {
      const cp = bl.scaleStockBatch.costPrice != null ? Number(bl.scaleStockBatch.costPrice) : fallbackCost;
      return sum + cp * Number(bl.quantity);
    }, 0);
    const unattributedQty = Math.max(0, baseQty - batchAttributedQty);
    const lineCost = batchCost + unattributedQty * fallbackCost;
    const lineProfit = lineRevenue - lineCost;

    revenue += lineRevenue;
    profit += lineProfit;
    qtySold += baseQty;
    totalDiscounts += lineDiscount;
    orderIds.add(line.order.id);
    customerKeys.add(line.order.customerId != null ? `c:${line.order.customerId}` : `n:${line.order.buyerName || "walk-in"}`);

    const key = dateKey(line.order.date);
    const existing = dailyMap.get(key) ?? { qty: 0, revenue: 0, profit: 0 };
    existing.qty += baseQty;
    existing.revenue += lineRevenue;
    existing.profit += lineProfit;
    dailyMap.set(key, existing);

    dayOfWeekRevenue[line.order.date.getUTCDay()] += lineRevenue;
  }

  const dailyKeys = buildDailyRange(start, end);
  const dailySeries = dailyKeys.map((key) => ({
    date: key,
    qty: dailyMap.get(key)?.qty ?? 0,
    revenue: dailyMap.get(key)?.revenue ?? 0,
    profit: dailyMap.get(key)?.profit ?? 0,
  }));

  const dayOfWeekSeries = DAY_NAMES.map((day, i) => ({ day, revenue: dayOfWeekRevenue[i] }));

  return {
    itemName: item.name,
    unit: item.unit,
    range: { start: startDate, end: endDate },
    summary: {
      revenue,
      profit,
      qtySold,
      orders: orderIds.size,
      customers: customerKeys.size,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      totalDiscounts,
    },
    dailySeries,
    dayOfWeekSeries,
  };
}