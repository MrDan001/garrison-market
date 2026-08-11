// FILE: apps/frontend/lib/rush-rewards.actions.ts (UPDATED — Fix C2 rewrite. Prizes now come from the owner-managed SpinPrizeOption pool per store instead of a fixed cosmetic-only list, and winning one actually does something: XP boosts move the XP bar, badges/titles are saved to the profile, streak shields arm real protection, and cash/gift prizes are recorded as pending until the owner settles them.)

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { getOrCreateRushProfile, awardCustomXp } from "./rush.actions";
import { DEFAULT_SPIN_PRIZES, weightedPick } from "./rush-config";

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// --- Prize pool: seed on first read, then always read from the DB --------

// Idempotent-ish — if two requests race to seed the pool at the exact
// same moment, the count-check narrows but doesn't fully close the
// window. Worst case is a harmless duplicate default row the owner can
// delete; not worth a distributed lock for how rarely a store's very
// first spin coincides with a second simultaneous request.
//
// Exported (Fix C3) so the owner's prize management page can seed +
// list ALL prizes (active and inactive), not just the active ones the
// spin itself draws from.
export async function ensurePrizePoolSeeded(storeId: number) {
  const alreadyHasAny = await prisma.spinPrizeOption.count({ where: { storeId } });
  if (alreadyHasAny === 0) {
    await prisma.spinPrizeOption.createMany({
      data: DEFAULT_SPIN_PRIZES.map((p) => ({
        storeId,
        label: p.label,
        kind: p.kind,
        xpAmount: p.xpAmount ?? null,
        weight: p.weight,
        isDefault: true,
        active: true,
      })),
    });
  }
  // else: pool already exists (possibly fully deactivated on purpose by
  // the owner) — never re-seed on top of an existing pool.
}

async function getActivePrizePool(storeId: number) {
  await ensurePrizePoolSeeded(storeId);
  return prisma.spinPrizeOption.findMany({
    where: { storeId, active: true },
    orderBy: { id: "asc" },
  });
}

// --- Spin availability ----------------------------------------------------

export type SpinState = {
  available: boolean;
  claimed: boolean;
  prizeLabel: string | null;
  prizeKind: string | null;
  // Links a claimed spin back to the exact prize option won, so the
  // wheel UI can find its matching segment and land on it precisely —
  // matching by label alone risks colliding with a renamed/duplicate
  // label.
  prizeOptionId: number | null;
  requiresSettlement: boolean;
  settled: boolean;
};

// The wheel's visual segments — everything currently on the wheel, in the
// exact same order claimSpin() draws from (id ascending), so a segment's
// position in this array always matches the index the server will report
// as the winner. Deliberately minimal (id + label only): the wheel is a
// display surface, not a place to leak cash amounts or gift descriptions
// to everyone glancing at the screen before a spin resolves — the label
// itself already carries whatever the owner wants shown (e.g. "₦2,000
// Cash Prize").
export type WheelPrize = { id: number; label: string };

export async function getSpinWheelPrizes(): Promise<WheelPrize[] | null> {
  try {
    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    const pool = await getActivePrizePool(storeId);
    return pool.map((p) => ({ id: p.id, label: p.label }));
  } catch (error) {
    console.error("getSpinWheelPrizes failed:", error);
    return null;
  }
}

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
      return {
        available: false,
        claimed: true,
        prizeLabel: spin.prizeLabel,
        prizeKind: spin.prizeKind,
        prizeOptionId: spin.prizeOptionId,
        requiresSettlement: spin.requiresSettlement,
        settled: spin.settled,
      };
    }

    return {
      available: questCompletedToday,
      claimed: false,
      prizeLabel: null,
      prizeKind: null,
      prizeOptionId: null,
      requiresSettlement: false,
      settled: false,
    };
  } catch (error) {
    console.error("getSpinAvailability failed:", error);
    return null;
  }
}

// --- Claim spin -------------------------------------------------------------

export async function claimSpin(): Promise<{
  success: boolean;
  prizeLabel?: string;
  prizeKind?: string;
  prizeOptionId?: number | null;
  effectSummary?: string;
  requiresSettlement?: boolean;
}> {
  try {
    const session = await getSessionUser();
    if (!session) return { success: false };

    const storeId = await getActiveStoreId();
    if (!storeId) return { success: false };

    const profile = await getOrCreateRushProfile();
    if (!profile) return { success: false };

    const questDate = startOfToday();

    // Step 1: verify eligibility and reserve today's spin row. Kept as its
    // own transaction (same shape as before Fix C2) so two rapid taps
    // can't both pass the "not yet claimed" check.
    const reserved = await prisma.$transaction(async (tx) => {
      const quest = await tx.questProgress.findUnique({
        where: { rushProfileId_type_questDate: { rushProfileId: profile.id, type: "RESTOCK_RUN", questDate } },
      });
      if (!quest?.completed) return { blocked: true as const };

      const existingSpin = await tx.rewardSpin.findUnique({
        where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
      });
      if (existingSpin?.claimed) {
        return {
          blocked: true as const,
          prizeLabel: existingSpin.prizeLabel,
          prizeKind: existingSpin.prizeKind,
          prizeOptionId: existingSpin.prizeOptionId,
          requiresSettlement: existingSpin.requiresSettlement,
        };
      }

      // Placeholder row — locks in "claimed" before we know the prize, so
      // a second concurrent tap sees claimed=true and bails above.
      await tx.rewardSpin.upsert({
        where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
        update: { claimed: true, claimedAt: new Date() },
        create: { rushProfileId: profile.id, spinDate: questDate, claimed: true, claimedAt: new Date() },
      });

      return { blocked: false as const };
    });

    if (reserved.blocked) {
      if (!reserved.prizeLabel) return { success: false };
      return {
        success: false,
        prizeLabel: reserved.prizeLabel,
        prizeKind: reserved.prizeKind ?? undefined,
        prizeOptionId: reserved.prizeOptionId,
        requiresSettlement: reserved.requiresSettlement,
      };
    }

    // Step 2: pick the prize from the store's live pool and apply it.
    const pool = await getActivePrizePool(storeId);
    const prize = weightedPick(pool);

    if (!prize) {
      // Empty pool (owner deactivated everything) — undo the reservation
      // rather than leaving a spin claimed with no prize.
      await prisma.rewardSpin.delete({
        where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
      });
      return { success: false };
    }

    let effectSummary = "";
    const requiresSettlement = prize.kind === "cash" || prize.kind === "gift";

    switch (prize.kind) {
      case "xp_boost": {
        const amount = prize.xpAmount ?? 0;
        if (amount > 0) {
          await awardCustomXp(session.id, storeId, amount, "SPIN_XP_BOOST", { prizeOptionId: prize.id });
        }
        effectSummary = `+${amount} XP added to your bar!`;
        break;
      }
      case "streak_shield": {
        await prisma.rushProfile.update({
          where: { id: profile.id },
          data: { streakShieldActive: true },
        });
        effectSummary = "Your streak is now protected — it'll survive your next missed day.";
        break;
      }
      case "badge": {
        const existingBadges = Array.isArray(profile.badges) ? (profile.badges as any[]) : [];
        const updatedBadges = [...existingBadges, { label: prize.label, wonAt: new Date().toISOString() }];
        await prisma.rushProfile.update({
          where: { id: profile.id },
          data: { badges: updatedBadges },
        });
        effectSummary = "Added to your badges.";
        break;
      }
      case "cash": {
        effectSummary = `₦${(prize.cashAmount ?? 0).toLocaleString()} — pending. Your owner will settle this with you.`;
        break;
      }
      case "gift": {
        effectSummary = `${prize.giftDescription ?? "A prize"} — pending. Your owner will settle this with you.`;
        break;
      }
    }

    await prisma.rewardSpin.update({
      where: { rushProfileId_spinDate: { rushProfileId: profile.id, spinDate: questDate } },
      data: {
        prizeLabel: prize.label,
        prizeOptionId: prize.id,
        prizeKind: prize.kind,
        requiresSettlement,
      },
    });

    revalidatePath("/staff/rush");
    revalidatePath("/owner/rush");
    revalidatePath("/staff/rush/wins");
    revalidatePath("/owner/rush/settlements");

    return {
      success: true,
      prizeLabel: prize.label,
      prizeKind: prize.kind,
      prizeOptionId: prize.id,
      effectSummary,
      requiresSettlement,
    };
  } catch (error) {
    console.error("claimSpin failed:", error);
    return { success: false };
  }
}