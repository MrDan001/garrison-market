// FILE: apps/frontend/lib/rush-quests.actions.ts (NEW FILE)
//
// Stage 3 — the two quests: Restock Run and Sales Sprint.
//
// Restock Run needs its own small state (QuestProgress) because "verify
// this item's count today" isn't a concept your inventory system already
// tracks. Sales Sprint needs none — it's a live read over orders you
// already store, so there's nothing new to persist for it.
//
// Every export here follows the same fail-soft contract as rush.actions.ts:
// never throw into a page render or a client click handler; return a safe
// empty/null shape instead and log the error server-side.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { getOrCreateRushProfile, awardXp } from "./rush.actions";

const RESTOCK_RUN_TARGET = 5;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// --- Restock Run ---------------------------------------------------------

export type RestockRunState = {
  progress: number;
  target: number;
  completed: boolean;
  verifiedInventoryIds: (number | string)[];
};

export async function getRestockRunState(): Promise<RestockRunState | null> {
  try {
    const profile = await getOrCreateRushProfile();
    if (!profile) return null;

    const questDate = startOfToday();
    const quest = await prisma.questProgress.findUnique({
      where: {
        rushProfileId_type_questDate: {
          rushProfileId: profile.id,
          type: "RESTOCK_RUN",
          questDate,
        },
      },
    });

    if (!quest) {
      return { progress: 0, target: RESTOCK_RUN_TARGET, completed: false, verifiedInventoryIds: [] };
    }

    return {
      progress: quest.progress,
      target: quest.target,
      completed: quest.completed,
      verifiedInventoryIds: Array.isArray(quest.verifiedInventoryIds)
        ? (quest.verifiedInventoryIds as (number | string)[])
        : [],
    };
  } catch (error) {
    console.error("getRestockRunState failed:", error);
    return null;
  }
}

// A handful of real inventory items from the active store, surfaced as
// "things to verify today." Pulls from BOTH inventory systems — the
// standard Inventory table and the separate ScaleInventory table used
// by weight/volume-based stores (Store.storeType === "scale") — since
// they're two independent tables an owner can have items in
// simultaneously. Each item is tagged with `kind` and identified by a
// composite `key` ("inventory:3" / "scale:3") rather than the bare
// numeric id, because ScaleInventory has its own separate autoincrement
// sequence — its ids collide with Inventory ids (both can have an id of
// 3, referring to two entirely different products), so the bare number
// alone isn't safe to use as a unique key across both. Staler items
// (least recently touched) come first across the combined pool — a
// natural nudge toward what hasn't been looked at in a while.
export type RestockRunItem = {
  key: string;
  id: number;
  kind: "inventory" | "scale";
  name: string;
  quantity: number;
  unit?: string;
};

export async function getRestockRunItems(): Promise<RestockRunItem[]> {
  try {
    const session = await getSessionUser();
    if (!session) return [];

    const storeId = await getActiveStoreId();
    if (!storeId) return [];

    const ownerId = session.role === "owner" ? session.id : session.ownerId;
    if (!ownerId) return [];

    const [standardItems, scaleItems] = await Promise.all([
      prisma.inventory.findMany({
        where: { ownerId, OR: [{ storeId }, { storeId: null }] },
        select: { id: true, name: true, quantity: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 5,
      }),
      prisma.scaleInventory.findMany({
        where: { ownerId, OR: [{ storeId }, { storeId: null }] },
        select: { id: true, name: true, quantity: true, unit: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 5,
      }),
    ]);

    const combined: (RestockRunItem & { updatedAt: Date })[] = [
      ...standardItems.map((i) => ({
        key: `inventory:${i.id}`,
        id: i.id,
        kind: "inventory" as const,
        name: i.name,
        quantity: i.quantity,
        updatedAt: i.updatedAt,
      })),
      ...scaleItems.map((i) => ({
        key: `scale:${i.id}`,
        id: i.id,
        kind: "scale" as const,
        name: i.name,
        quantity: Number(i.quantity),
        unit: i.unit,
        updatedAt: i.updatedAt,
      })),
    ];

    return combined
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, 5)
      .map(({ updatedAt, ...item }) => item);
  } catch (error) {
    console.error("getRestockRunItems failed:", error);
    return [];
  }
}

// Marks one item — from either inventory system — as "verified" toward
// today's Restock Run. `kind` disambiguates which table `id` refers to,
// since the two tables' ids can collide (see getRestockRunItems above).
// Idempotent per item per day (tapping the same item twice does nothing
// the second time) so a double-tap on a slow connection can't inflate
// progress or XP.
export async function verifyRestockItem(id: number, kind: "inventory" | "scale" = "inventory") {
  const key = `${kind}:${id}`;
  try {
    const session = await getSessionUser();
    if (!session) return { success: false as const };

    const profile = await getOrCreateRushProfile();
    if (!profile) return { success: false as const };

    const questDate = startOfToday();

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.questProgress.findUnique({
        where: {
          rushProfileId_type_questDate: {
            rushProfileId: profile.id,
            type: "RESTOCK_RUN",
            questDate,
          },
        },
      });

      // Pre-existing rows may still hold bare numbers from before scale
      // items were added — those always meant an Inventory id, so treat
      // a matching bare number as equivalent to "inventory:<id>".
      const alreadyVerified: (number | string)[] = existing && Array.isArray(existing.verifiedInventoryIds)
        ? (existing.verifiedInventoryIds as (number | string)[])
        : [];
      const isAlreadyVerified = alreadyVerified.some(
        (v) => v === key || (kind === "inventory" && v === id)
      );

      if (isAlreadyVerified) {
        return { alreadyVerified: true, justCompleted: false };
      }

      const target = existing?.target ?? RESTOCK_RUN_TARGET;
      const newProgress = (existing?.progress ?? 0) + 1;
      const wasAlreadyCompleted = existing?.completed ?? false;
      const nowCompleted = newProgress >= target;
      const updatedIds = [...alreadyVerified, key];

      await tx.questProgress.upsert({
        where: {
          rushProfileId_type_questDate: {
            rushProfileId: profile.id,
            type: "RESTOCK_RUN",
            questDate,
          },
        },
        update: {
          progress: newProgress,
          completed: nowCompleted,
          completedAt: nowCompleted && !wasAlreadyCompleted ? new Date() : existing?.completedAt ?? null,
          verifiedInventoryIds: updatedIds,
        },
        create: {
          rushProfileId: profile.id,
          type: "RESTOCK_RUN",
          questDate,
          progress: newProgress,
          target,
          completed: nowCompleted,
          completedAt: nowCompleted ? new Date() : null,
          verifiedInventoryIds: updatedIds,
        },
      });

      return { alreadyVerified: false, justCompleted: nowCompleted && !wasAlreadyCompleted };
    });

    if (!outcome.alreadyVerified) {
      const storeId = await getActiveStoreId();
      if (storeId) {
        await awardXp(session.id, storeId, "STOCK_VERIFIED", { inventoryId: id, kind });
        if (outcome.justCompleted) {
          await awardXp(session.id, storeId, "QUEST_COMPLETED", { quest: "RESTOCK_RUN" });
        }
      }
    }

    revalidatePath("/staff/rush");
    revalidatePath("/owner/rush");

    return { success: true as const, alreadyVerified: outcome.alreadyVerified, justCompleted: outcome.justCompleted };
  } catch (error) {
    console.error("verifyRestockItem failed:", error);
    return { success: false as const };
  }
}

// --- Sales Sprint ---------------------------------------------------------

export type SalesSprintState = {
  todayTotal: number;
  yesterdayTotal: number;
  target: number;
  percent: number;
  isRecordPace: boolean;
};

// Shared math, parameterized by an optional extra Prisma where-clause so
// the store-wide and personal reads below don't duplicate the aggregate
// logic. Fix B: this replaces the old inline staffScope branch — that
// branch mixed "which rows to sum" with "who's asking," which meant staff
// could only ever see their own number and never the store's, even though
// team context is useful too. Now both reads always exist; callers decide
// which one(s) to show.
async function computeSalesSprint(storeId: number, extraWhere: Record<string, unknown>): Promise<SalesSprintState> {
  const todayStart = startOfToday();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [todayAgg, yesterdayAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { storeId, date: { gte: todayStart }, ...extraWhere },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { storeId, date: { gte: yesterdayStart, lt: todayStart }, ...extraWhere },
      _sum: { total: true },
    }),
  ]);

  const todayTotal = Number(todayAgg._sum.total ?? 0);
  const yesterdayTotal = Number(yesterdayAgg._sum.total ?? 0);
  // On a store's first day (or a quiet yesterday), fall back to a small
  // default target so the bar has something meaningful to race toward
  // instead of instantly reading "100%" the moment any sale happens.
  const target = yesterdayTotal > 0 ? yesterdayTotal : 10000;

  return {
    todayTotal,
    yesterdayTotal,
    target,
    percent: Math.min(100, Math.round((todayTotal / target) * 100)),
    isRecordPace: yesterdayTotal > 0 && todayTotal > yesterdayTotal,
  };
}

// Store-wide — every sale in the store, regardless of who made it. This is
// the "general one that counts as store target": unchanged behavior for
// owners, and now also shown to staff alongside their personal number
// (see getPersonalSalesSprintState below) rather than being hidden from
// them.
export async function getSalesSprintState(): Promise<SalesSprintState | null> {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    return await computeSalesSprint(storeId, {});
  } catch (error) {
    console.error("getSalesSprintState failed:", error);
    return null;
  }
}

// Fix B addition — scoped to only the calling staff member's own sales.
// Sales made by other staff never count toward this number.
export async function getPersonalSalesSprintState(): Promise<SalesSprintState | null> {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    return await computeSalesSprint(storeId, { staffId: session.id });
  } catch (error) {
    console.error("getPersonalSalesSprintState failed:", error);
    return null;
  }
}
