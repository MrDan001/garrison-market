// FILE: apps/frontend/lib/rush.actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { XP_AMOUNTS, LEVEL_THRESHOLDS, MAX_DEFINED_LEVEL, STREAK_GRACE_HOURS, formatRushDisplayName } from "./rush-config";

type XpEventType = keyof typeof XP_AMOUNTS;

// SECURITY FIX: shared by awardXp/awardCustomXp below. Confirms the
// session doesn't just belong to the right person, but that this person
// actually has access to the storeId being passed in — an owner must
// own the store, a staff member must be assigned to it. Without this, a
// legitimate, correctly-authenticated user could still pass an
// arbitrary storeId belonging to someone else's shop and pollute that
// store's XP totals, streaks, and leaderboard.
async function verifyStoreAccess(session: { id: number; role: string }, storeId: number): Promise<boolean> {
  if (session.role === "staff") {
    const staff = await prisma.user.findUnique({
      where: { id: session.id },
      select: { staffStoreId: true },
    });
    return staff?.staffStoreId === storeId;
  }
  const store = await prisma.store.findFirst({
    where: { id: storeId, ownerId: session.id },
    select: { id: true },
  });
  return !!store;
}

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

// Shared core, extracted in Fix C2 so the reward spin's XP-boost prize
// (a variable, owner/prize-defined amount) can reuse the exact same
// profile-update + streak math as the fixed XP_AMOUNTS-driven awards,
// instead of duplicating it.
//
// Along the way this fixes a real bug in the upsert's create branch: it
// previously set `userId: storeId ? storeId : userId`, which would have
// created a RushProfile under the wrong userId any time this ran before
// getOrCreateRushProfile() had already created the row. In practice most
// callers call getOrCreateRushProfile() first, which masked it — but it
// was wrong and is now `userId`.
async function applyXp(userId: number, storeId: number, amount: number, type: string, meta?: Record<string, any>) {
  if (!amount) return;

  const profile = await prisma.rushProfile.upsert({
    where: { userId_storeId: { userId, storeId } },
    update: {},
    create: { userId, storeId },
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
}

// SECURITY FIX: userId/storeId used to be trusted directly from the
// caller with no verification. Every real call site in this codebase
// passes the current session's own id (never someone else's) — this
// function only ever awards XP to the person triggering the action —
// but because the file has a file-level "use server" directive, it was
// also independently callable as a public Server Action with an
// arbitrary userId and storeId, letting anyone hand XP (and therefore
// levels, quests, and the real cash/gift reward spin) to any account,
// or pollute a store they have no access to. Both are now verified.
export async function awardXp(userId: number, storeId: number, type: XpEventType, meta?: Record<string, any>) {
  try {
    const session = await getSessionUser();
    if (!session || session.id !== userId) {
      throw new Error("Unauthorized: userId does not match session");
    }
    if (!(await verifyStoreAccess(session, storeId))) {
      throw new Error("Unauthorized: no access to storeId");
    }
    await applyXp(userId, storeId, XP_AMOUNTS[type], type, meta);
  } catch (error) {
    console.error(`awardXp failed [type=${type}, userId=${userId}, storeId=${storeId}]:`, error);
  }
}

// Fix C2 addition — for XP amounts that aren't one of the fixed
// XP_AMOUNTS types, namely the spin wheel's owner/default-defined
// "Bonus XP Boost" prize. `sourceType` is stored as the XpEvent's type
// (e.g. "SPIN_XP_BOOST") so it's distinguishable in history from the
// regular XP sources.
//
// SECURITY FIX: same as awardXp above — now verifies the session
// matches userId and has access to storeId before applying an
// attacker-controlled `amount`.
export async function awardCustomXp(
  userId: number,
  storeId: number,
  amount: number,
  sourceType: string,
  meta?: Record<string, any>,
) {
  try {
    const session = await getSessionUser();
    if (!session || session.id !== userId) {
      throw new Error("Unauthorized: userId does not match session");
    }
    if (!(await verifyStoreAccess(session, storeId))) {
      throw new Error("Unauthorized: no access to storeId");
    }
    await applyXp(userId, storeId, amount, sourceType, meta);
  } catch (error) {
    console.error(`awardCustomXp failed [type=${sourceType}, userId=${userId}, storeId=${storeId}]:`, error);
  }
}