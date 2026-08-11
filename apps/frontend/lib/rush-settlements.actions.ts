// FILE: apps/frontend/lib/rush-settlements.actions.ts (NEW FILE — Fix C4)
//
// Owner-only. Cash/gift spin wins are recorded as pending (see Fix C2)
// until the owner physically hands over the money/gift and confirms it
// here. RewardSpin has no direct relation to User (RushProfile only
// stores a plain userId int, same pattern as everywhere else in Rush),
// so staff names are fetched separately and joined in application code
// rather than via a Prisma relation.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";

async function requireOwnerStoreId(): Promise<number | null> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return null;

  const storeId = await getActiveStoreId();
  if (!storeId) return null;

  const owned = await prisma.store.findFirst({
    where: { id: storeId, ownerId: session.id },
    select: { id: true },
  });
  return owned ? storeId : null;
}

export type SettlementEntry = {
  id: number;
  staffName: string;
  prizeLabel: string;
  prizeKind: string;
  wonAt: Date;
  settled: boolean;
  settledAt: Date | null;
};

// Returns both pending and already-settled cash/gift wins for the
// owner's active store, most recent first — pending ones bubble to the
// top since those are what the owner actually needs to act on.
export async function listSettlements(): Promise<SettlementEntry[] | null> {
  try {
    const storeId = await requireOwnerStoreId();
    if (!storeId) return null;

    const spins = await prisma.rewardSpin.findMany({
      where: {
        requiresSettlement: true,
        rushProfile: { storeId },
      },
      orderBy: [{ settled: "asc" }, { claimedAt: "desc" }],
      select: {
        id: true,
        prizeLabel: true,
        prizeKind: true,
        claimedAt: true,
        settled: true,
        settledAt: true,
        rushProfile: { select: { userId: true } },
      },
    });

    if (spins.length === 0) return [];

    const userIds = [...new Set(spins.map((s) => s.rushProfile.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName || u.email]));

    return spins.map((s) => ({
      id: s.id,
      staffName: nameById.get(s.rushProfile.userId) ?? "Unknown staff",
      prizeLabel: s.prizeLabel ?? "Prize",
      prizeKind: s.prizeKind ?? "",
      wonAt: s.claimedAt ?? new Date(),
      settled: s.settled,
      settledAt: s.settledAt,
    }));
  } catch (error) {
    console.error("listSettlements failed:", error);
    return null;
  }
}

// Lightweight count for the world-screen badge — avoids fetching full
// settlement rows (with the staff-name join) just to show a number.
export async function getPendingSettlementsCount(): Promise<number> {
  try {
    const storeId = await requireOwnerStoreId();
    if (!storeId) return 0;

    return await prisma.rewardSpin.count({
      where: { requiresSettlement: true, settled: false, rushProfile: { storeId } },
    });
  } catch (error) {
    console.error("getPendingSettlementsCount failed:", error);
    return 0;
  }
}

export async function markSettled(rewardSpinId: number): Promise<{ success: boolean }> {
  try {
    const session = await getSessionUser();
    const storeId = await requireOwnerStoreId();
    if (!session || !storeId) return { success: false };

    // Verify the spin actually belongs to a profile in this owner's
    // store before touching it — requireOwnerStoreId confirms the
    // caller owns storeId, this confirms the specific row is theirs.
    const spin = await prisma.rewardSpin.findFirst({
      where: { id: rewardSpinId, requiresSettlement: true, rushProfile: { storeId } },
      select: { id: true },
    });
    if (!spin) return { success: false };

    await prisma.rewardSpin.update({
      where: { id: rewardSpinId },
      data: { settled: true, settledAt: new Date(), settledByOwnerId: session.id },
    });

    revalidatePath("/owner/rush/settlements");
    revalidatePath("/staff/rush");
    revalidatePath("/staff/rush/wins");

    return { success: true };
  } catch (error) {
    console.error("markSettled failed:", error);
    return { success: false };
  }
}