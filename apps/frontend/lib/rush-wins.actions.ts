// FILE: apps/frontend/lib/rush-wins.actions.ts (NEW FILE — Fix C5)
//
// A staff member's full history of claimed spins — cosmetic wins (badge,
// XP boost, streak shield) that already applied themselves, and cash/gift
// wins with their settlement status. Scoped to the calling user's own
// RushProfile in their active store; there is no "view someone else's
// wins" mode here — that's what the owner's Settlements page is for.

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";

export type MyWinEntry = {
  id: number;
  prizeLabel: string;
  prizeKind: string;
  wonAt: Date;
  requiresSettlement: boolean;
  settled: boolean;
  settledAt: Date | null;
};

export async function listMyWins(): Promise<MyWinEntry[] | null> {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    const profile = await prisma.rushProfile.findUnique({
      where: { userId_storeId: { userId: session.id, storeId } },
      select: { id: true },
    });
    if (!profile) return [];

    const spins = await prisma.rewardSpin.findMany({
      where: { rushProfileId: profile.id, claimed: true },
      orderBy: { claimedAt: "desc" },
      select: {
        id: true,
        prizeLabel: true,
        prizeKind: true,
        claimedAt: true,
        requiresSettlement: true,
        settled: true,
        settledAt: true,
      },
    });

    return spins.map((s) => ({
      id: s.id,
      prizeLabel: s.prizeLabel ?? "Prize",
      prizeKind: s.prizeKind ?? "",
      wonAt: s.claimedAt ?? new Date(),
      requiresSettlement: s.requiresSettlement,
      settled: s.settled,
      settledAt: s.settledAt,
    }));
  } catch (error) {
    console.error("listMyWins failed:", error);
    return null;
  }
}