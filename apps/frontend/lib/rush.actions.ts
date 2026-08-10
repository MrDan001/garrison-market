// FILE: apps/frontend/lib/rush.actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { XP_AMOUNTS, LEVEL_THRESHOLDS, MAX_DEFINED_LEVEL, STREAK_GRACE_HOURS, formatRushDisplayName } from "./rush-config";

type XpEventType = keyof typeof XP_AMOUNTS;

// --- Level math -------------------------------------------------------

export async function computeLevel(totalXp: number) {
  let level = 1;
  let remaining = totalXp;

  for (const threshold of LEVEL_THRESHOLDS) {
    if (level >= MAX_DEFINED_LEVEL) break;
    if (remaining < threshold) break;
    remaining -= threshold;
    level += 1;
  }

  const nextThreshold = LEVEL_THRESHOLDS[level - 1] ?? null;
  return { level, xpIntoLevel: remaining, xpForNextLevel: nextThreshold };
}

// --- Streak math --------------------------------------------------------

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(lastActive: Date, now: Date) {
  const graceAdjustedNow = new Date(now.getTime() - STREAK_GRACE_HOURS * 60 * 60 * 1000);
  const yesterday = new Date(graceAdjustedNow);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(lastActive, yesterday);
}

// --- Profile access -----------------------------------------------------

export async function getOrCreateRushProfile() {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    const profile = await prisma.rushProfile.upsert({
      where: { userId_storeId: { userId: session.id, storeId } },
      update: {},
      create: { userId: session.id, storeId },
    });

    return profile;
  } catch (error) {
    console.error("getOrCreateRushProfile failed:", error);
    return null;
  }
}

export async function getRushProfile() {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    return await prisma.rushProfile.findUnique({
      where: { userId_storeId: { userId: session.id, storeId } },
    });
  } catch (error) {
    console.error("getRushProfile failed:", error);
    return null;
  }
}

// --- Stage 2 addition: display stats for the card + world screen --------

export type RushDisplayStats = {
  displayName: string;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  percentToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  isMaxLevel: boolean;
};

export async function getRushDisplayStats(): Promise<RushDisplayStats | null> {
  try {
    const profile = await getOrCreateRushProfile();
    if (!profile) return null;

    const store = await prisma.store.findUnique({
      where: { id: profile.storeId },
      select: { name: true },
    });
    if (!store) return null;

    // Dynamically derive current level metrics from totalXp
    const { level, xpIntoLevel, xpForNextLevel } = await computeLevel(profile.totalXp);
    const isMaxLevel = xpForNextLevel === null;
    const percentToNextLevel = isMaxLevel
      ? 100
      : Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100));

    return {
      displayName: formatRushDisplayName(store.name),
      level,
      totalXp: profile.totalXp,
      xpIntoLevel,
      xpForNextLevel,
      percentToNextLevel,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      isMaxLevel,
    };
  } catch (error) {
    console.error("getRushDisplayStats failed:", error);
    return null;
  }
}

// --- The hook every existing action calls --------------------------------

export async function awardXp(userId: number, storeId: number, type: XpEventType, meta?: Record<string, any>) {
  try {
    const amount = XP_AMOUNTS[type];
    if (!amount) return;

    const profile = await prisma.rushProfile.upsert({
      where: { userId_storeId: { userId, storeId } },
      update: {},
      create: { userId: storeId ? storeId : userId, storeId },
    });

    const now = new Date();
    const newTotalXp = profile.totalXp + amount;
    const { level, xpIntoLevel } = await computeLevel(newTotalXp);

    let currentStreak = profile.currentStreak;
    let longestStreak = profile.longestStreak;

    if (!profile.lastActiveDate) {
      currentStreak = 1;
    } else if (isSameCalendarDay(profile.lastActiveDate, now)) {
      // same day — no change
    } else if (isYesterday(profile.lastActiveDate, now)) {
      currentStreak = profile.currentStreak + 1;
    } else {
      currentStreak = 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    await prisma.$transaction([
      prisma.rushProfile.update({
        where: { id: profile.id },
        data: {
          totalXp: newTotalXp,
          xpIntoLevel,
          level,
          currentStreak,
          longestStreak,
          lastActiveDate: now,
        },
      }),
      prisma.xpEvent.create({
        data: {
          rushProfileId: profile.id,
          type,
          amount,
          meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
        },
      }),
    ]);
  } catch (error) {
    console.error(`awardXp failed [type=${type}, userId=${userId}, storeId=${storeId}]:`, error);
  }
}