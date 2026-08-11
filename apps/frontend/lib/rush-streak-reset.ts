// FILE: apps/frontend/lib/rush-streak-reset.ts (UPDATED — Fix C2 adds streak shield consumption. Everything else unchanged.)
//
// Nightly job: any RushProfile whose lastActiveDate is older than
// "yesterday" (i.e. they had no qualifying event yesterday OR today)
// has its currentStreak reset to 0 — UNLESS streakShieldActive is set,
// in which case the shield is consumed (set back to false) and the
// streak is protected for this one reset instead. longestStreak is never
// touched — it's a permanent personal best, not a running counter.
//
// Mirrors the shape of runMidnightScaleConsignmentReset in
// lib/scale-consignment-reset.ts so it slots into the same cron pattern.

import prisma from "@/lib/prisma";
import { STREAK_GRACE_HOURS } from "./rush-config";

export async function runNightlyRushStreakReset() {
  const graceAdjustedNow = new Date(Date.now() - STREAK_GRACE_HOURS * 60 * 60 * 1000);

  const cutoff = new Date(graceAdjustedNow);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(0, 0, 0, 0); // start of "yesterday" — anything before this is a broken streak

  const atRisk = await prisma.rushProfile.findMany({
    where: {
      currentStreak: { gt: 0 },
      OR: [
        { lastActiveDate: null },
        { lastActiveDate: { lt: cutoff } },
      ],
    },
    select: { id: true, streakShieldActive: true },
  });

  const shieldedIds = atRisk.filter((p) => p.streakShieldActive).map((p) => p.id);
  const resetIds = atRisk.filter((p) => !p.streakShieldActive).map((p) => p.id);

  if (shieldedIds.length > 0) {
    // Shield protects the streak once, then is consumed. lastActiveDate is
    // bumped to "now" so this same profile isn't caught by the check
    // again tomorrow night without a fresh qualifying action in between.
    await prisma.rushProfile.updateMany({
      where: { id: { in: shieldedIds } },
      data: { streakShieldActive: false, lastActiveDate: new Date() },
    });
  }

  if (resetIds.length > 0) {
    await prisma.rushProfile.updateMany({
      where: { id: { in: resetIds } },
      data: { currentStreak: 0 },
    });
  }

  return { streaksReset: resetIds.length, streaksShielded: shieldedIds.length };
}