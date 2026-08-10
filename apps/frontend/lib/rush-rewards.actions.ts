// FILE: apps/frontend/lib/rush-rewards.actions.ts (NEW FILE)
//
// Stage 5 — the spin-the-wheel reward. A spin becomes claimable once
// today's Restock Run quest is completed (Stage 3), and stays claimed
// permanently once used — one spin per profile per calendar day, ever.
// Cosmetic-only by default (see SPIN_PRIZES in rush-config.ts); no real
// value is granted unless an owner-funded reward pool is added later,
// which would only mean editing the prize list, not this logic.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getOrCreateRushProfile } from "./rush.actions";
import { pickPrize } from "./rush-config";

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type SpinState = {
  available: boolean;
  claimed: boolean;
  prizeLabel: string | null;
};

export async function getSpinAvailability(): Promise<SpinState | null> {
  try {
    const profile = await getOrCreateRushProfile();
    if (!profile) return null;

    const questDate = startOfToday();

    const [quest, spin] = await Promise.all([
      prisma.questProgress.findUnique({
        where: { rushProfileId_type_questDate: { rushProfileId: profile.id, type: "RESTOCK_RUN", questDate } },
      }),
      prisma.rewardSpin.findUnique({
        where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
      }),
    ]);

    const questCompletedToday = quest?.completed ?? false;

    if (spin?.claimed) {
      return { available: false, claimed: true, prizeLabel: spin.prizeLabel };
    }

    return { available: questCompletedToday, claimed: false, prizeLabel: null };
  } catch (error) {
    console.error("getSpinAvailability failed:", error);
    return null;
  }
}

export async function claimSpin(): Promise<{ success: boolean; prizeLabel?: string }> {
  try {
    const profile = await getOrCreateRushProfile();
    if (!profile) return { success: false };

    const questDate = startOfToday();

    const result = await prisma.$transaction(async (tx) => {
      const quest = await tx.questProgress.findUnique({
        where: { rushProfileId_type_questDate: { rushProfileId: profile.id, type: "RESTOCK_RUN", questDate } },
      });
      if (!quest?.completed) return { blocked: true as const };

      const existingSpin = await tx.rewardSpin.findUnique({
        where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
      });
      if (existingSpin?.claimed) return { blocked: true as const, prizeLabel: existingSpin.prizeLabel };

      const prizeLabel = pickPrize();

      await tx.rewardSpin.upsert({
        where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
        update: { claimed: true, prizeLabel, claimedAt: new Date() },
        create: { rushProfileId: profile.id, spinDate: questDate, claimed: true, prizeLabel, claimedAt: new Date() },
      });

      return { blocked: false as const, prizeLabel };
    });

    if (result.blocked || !result.prizeLabel) return { success: false };

    revalidatePath("/staff/rush");
    revalidatePath("/owner/rush");

    return { success: true, prizeLabel: result.prizeLabel };
  } catch (error) {
    console.error("claimSpin failed:", error);
    return { success: false };
  }
}