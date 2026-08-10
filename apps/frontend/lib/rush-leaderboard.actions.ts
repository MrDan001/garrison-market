// FILE: apps/frontend/lib/rush-leaderboard.actions.ts (NEW FILE)
//
// Stage 5 — two read-only views: a weekly XP leaderboard scoped to the
// active store, and a store-vs-store health comparison for owners
// running more than one store. Both are pure GROUP BY-style reads over
// data the earlier stages already produce (XpEvent, computeHealthForStore)
// — nothing new is written anywhere in this file.

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { computeHealthForStore } from "./rush-shop-health.actions";

// --- Weekly leaderboard ---------------------------------------------------

export type LeaderboardEntry = {
  rank: number;
  name: string;
  xp: number;
  isCurrentUser: boolean;
};

export async function getWeeklyLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const session = await getSessionUser();
    if (!session) return [];

    const storeId = await getActiveStoreId();
    if (!storeId) return [];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const profiles = await prisma.rushProfile.findMany({
      where: { storeId },
      select: { id: true, userId: true },
    });
    if (profiles.length === 0) return [];

    const profileIds = profiles.map((p) => p.id);

    const xpSums = await prisma.xpEvent.groupBy({
      by: ["rushProfileId"],
      where: { rushProfileId: { in: profileIds }, createdAt: { gte: weekAgo } },
      _sum: { amount: true },
    });

    const xpByProfileId = new Map(xpSums.map((row) => [row.rushProfileId, row._sum.amount ?? 0]));
    const userIdByProfileId = new Map(profiles.map((p) => [p.id, p.userId]));

    const userIds = profiles.map((p) => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameByUserId = new Map(users.map((u) => [u.id, u.fullName || "Team member"]));

    const ranked = profiles
      .map((p) => ({
        userId: p.userId,
        xp: xpByProfileId.get(p.id) ?? 0,
        name: nameByUserId.get(p.userId) ?? "Team member",
      }))
      .filter((entry) => entry.xp > 0) // no point ranking someone with zero activity this week
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5)
      .map((entry, index) => ({
        rank: index + 1,
        name: entry.name,
        xp: entry.xp,
        isCurrentUser: entry.userId === session.id,
      }));

    return ranked;
  } catch (error) {
    console.error("getWeeklyLeaderboard failed:", error);
    return [];
  }
}

// --- Store vs store comparison (owners with multiple stores) -------------

export type StoreComparisonEntry = {
  storeId: number;
  storeName: string;
  score: number;
  tierLabel: string;
  isActive: boolean;
};

// Returns null (not just an empty array) when the owner has one store or
// fewer — callers use that to decide whether to render the section at
// all, versus "loaded but nothing to show."
export async function getStoreComparison(): Promise<StoreComparisonEntry[] | null> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "owner") return null;

    const [stores, activeStoreId] = await Promise.all([
      prisma.store.findMany({
        where: { ownerId: session.id },
        select: { id: true, name: true },
      }),
      getActiveStoreId(),
    ]);

    if (stores.length <= 1) return null;

    const results = await Promise.all(
      stores.map(async (store) => {
        const health = await computeHealthForStore(store.id, session.id);
        return {
          storeId: store.id,
          storeName: store.name,
          score: health.score,
          tierLabel: health.tierLabel,
          isActive: store.id === activeStoreId,
        };
      })
    );

    return results.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("getStoreComparison failed:", error);
    return null;
  }
}