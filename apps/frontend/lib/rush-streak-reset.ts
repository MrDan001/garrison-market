// FILE: apps/frontend/lib/rush-streak-reset.ts (NEW FILE)
//
// Nightly job: any RushProfile whose lastActiveDate is older than
// "yesterday" (i.e. they had no qualifying event yesterday OR today)
// has its currentStreak reset to 0. longestStreak is never touched —
// it's a permanent personal best, not a running counter.
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

  const result = await prisma.rushProfile.updateMany({
    where: {
      currentStreak: { gt: 0 },
      OR: [
        { lastActiveDate: null },
        { lastActiveDate: { lt: cutoff } },
      ],
    },
    data: { currentStreak: 0 },
  });

  return { streaksReset: result.count };
}