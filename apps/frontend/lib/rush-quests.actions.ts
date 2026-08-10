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
  verifiedInventoryIds: number[];
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
        ? (quest.verifiedInventoryIds as number[])
        : [],
    };
  } catch (error) {
    console.error("getRestockRunState failed:", error);
    return null;
  }
}

// A handful of real inventory items from the active store, surfaced as
// "things to verify today." Staler items (least recently touched) come
// first — a natural nudge toward what hasn't been looked at in a while.
// Read-only, reuses existing Inventory rows — no new "verification"
// concept added to the inventory model itself.
export type RestockRunItem = { id: number; name: string; quantity: number };

export async function getRestockRunItems(): Promise<RestockRunItem[]> {
  try {
    const session = await getSessionUser();
    if (!session) return [];

    const storeId = await getActiveStoreId();
    if (!storeId) return [];

    const ownerId = session.role === "owner" ? session.id : session.ownerId;
    if (!ownerId) return [];

    return await prisma.inventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      select: { id: true, name: true, quantity: true },
      orderBy: { updatedAt: "asc" },
      take: 5,
    });
  } catch (error) {
    console.error("getRestockRunItems failed:", error);
    return [];
  }
}

// Marks one inventory item as "verified" toward today's Restock Run.
// Idempotent per item per day (tapping the same item twice does nothing
// the second time) so a double-tap on a slow connection can't inflate
// progress or XP.
export async function verifyRestockItem(inventoryId: number) {
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

      const alreadyVerified: number[] = existing && Array.isArray(existing.verifiedInventoryIds)
        ? (existing.verifiedInventoryIds as number[])
        : [];

      if (alreadyVerified.includes(inventoryId)) {
        return { alreadyVerified: true, justCompleted: false };
      }

      const target = existing?.target ?? RESTOCK_RUN_TARGET;
      const newProgress = (existing?.progress ?? 0) + 1;
      const wasAlreadyCompleted = existing?.completed ?? false;
      const nowCompleted = newProgress >= target;
      const updatedIds = [...alreadyVerified, inventoryId];

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
        await awardXp(session.id, storeId, "STOCK_VERIFIED", { inventoryId });
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

// Purely a read over orders that already exist — nothing persisted here.
// Staff see their own personal total; owners see the whole store's.
export async function getSalesSprintState(): Promise<SalesSprintState | null> {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    const todayStart = startOfToday();
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const staffScope = session.role === "staff" ? { staffId: session.id } : {};

    const [todayAgg, yesterdayAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { storeId, date: { gte: todayStart }, ...staffScope },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { storeId, date: { gte: yesterdayStart, lt: todayStart }, ...staffScope },
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
  } catch (error) {
    console.error("getSalesSprintState failed:", error);
    return null;
  }
}