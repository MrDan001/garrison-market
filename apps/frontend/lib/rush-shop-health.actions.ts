// FILE: apps/frontend/lib/rush-shop-health.actions.ts (UPDATED — Stage 5 extracts the scoring logic into an exported, store-parameterized function so getStoreComparison can reuse it without duplicating the math. Behavior of getShopHealth() is unchanged.)
//
// Shop health is computed live, never stored — it's a derived read over
// data you already have (inventory, orders, staff), not a new fact about
// the business.

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { SHOP_HEALTH_WEIGHTS, scoreToTier } from "./rush-config";

export type ShopHealthState = {
  score: number; // 0-100
  tier: number; // 1-5
  tierLabel: string;
  breakdown: {
    stockHealth: number;
    salesTrend: number;
    staffActivity: number;
  };
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Stage 5: the reusable core, parameterized by storeId + ownerId instead
// of reading them from the session. getShopHealth() (below) and
// getStoreComparison() (in rush-leaderboard.actions.ts) both call this
// so the scoring formula only ever lives in one place.
export async function computeHealthForStore(storeId: number, ownerId: number): Promise<ShopHealthState> {
  const todayStart = startOfToday();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [
    standardItems,
    scaleItems,
    todaySalesAgg,
    yesterdaySalesAgg,
    assignedStaff,
    activeStaffOrders,
  ] = await Promise.all([
    prisma.inventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      select: { quantity: true, restockLevel: true },
    }),
    prisma.scaleInventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      select: { quantity: true, restockLevel: true },
    }),
    prisma.order.aggregate({
      where: { storeId, date: { gte: todayStart } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { storeId, date: { gte: yesterdayStart, lt: todayStart } },
      _sum: { total: true },
    }),
    prisma.user.count({
      where: { staffStoreId: storeId, role: "staff", status: "approved" },
    }),
    prisma.order.findMany({
      where: { storeId, date: { gte: todayStart }, staffId: { not: null } },
      select: { staffId: true },
      distinct: ["staffId"],
    }),
  ]);

  const allItems = [
    ...standardItems.map((i) => ({ quantity: Number(i.quantity), restockLevel: i.restockLevel != null ? Number(i.restockLevel) : null })),
    ...scaleItems.map((i) => ({ quantity: Number(i.quantity), restockLevel: i.restockLevel != null ? Number(i.restockLevel) : null })),
  ];
  const trackedItems = allItems.filter((i) => i.restockLevel != null);
  const healthyItems = trackedItems.filter((i) => i.quantity > (i.restockLevel as number));
  const stockHealth = trackedItems.length === 0 ? 100 : Math.round((healthyItems.length / trackedItems.length) * 100);

  const todayTotal = Number(todaySalesAgg._sum.total ?? 0);
  const yesterdayTotal = Number(yesterdaySalesAgg._sum.total ?? 0);
  const salesTrend = yesterdayTotal > 0
    ? Math.min(100, Math.round((todayTotal / yesterdayTotal) * 100))
    : todayTotal > 0 ? 100 : 50;

  const staffActivity = assignedStaff === 0
    ? 100
    : Math.round((activeStaffOrders.length / assignedStaff) * 100);

  const score = Math.round(
    stockHealth * SHOP_HEALTH_WEIGHTS.stock +
    salesTrend * SHOP_HEALTH_WEIGHTS.sales +
    staffActivity * SHOP_HEALTH_WEIGHTS.staff
  );

  const { tier, label } = scoreToTier(score);

  return {
    score,
    tier,
    tierLabel: label,
    breakdown: { stockHealth, salesTrend, staffActivity },
  };
}

export async function getShopHealth(): Promise<ShopHealthState | null> {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    const ownerId = session.role === "owner" ? session.id : session.ownerId;
    if (!ownerId) return null;

    return await computeHealthForStore(storeId, ownerId);
  } catch (error) {
    console.error("getShopHealth failed:", error);
    return null;
  }
}