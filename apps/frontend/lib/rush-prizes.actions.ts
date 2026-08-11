// FILE: apps/frontend/lib/rush-prizes.actions.ts (NEW FILE — Fix C3)
//
// Owner-only management of a store's spin prize pool. Every prize —
// default or custom — lives in the same SpinPrizeOption table (see
// Fix C1), so "editing a default" and "adding a custom prize" are the
// same update/create action, just against different rows.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { ensurePrizePoolSeeded } from "./rush-rewards.actions";
import type { SpinPrizeKind } from "./rush-config";

const VALID_KINDS: SpinPrizeKind[] = ["xp_boost", "badge", "streak_shield", "cash", "gift"];
const MAX_LABEL_LENGTH = 60;
const MAX_GIFT_DESCRIPTION_LENGTH = 120;

export type PrizeOptionInput = {
  label: string;
  kind: SpinPrizeKind;
  xpAmount?: number | null;
  cashAmount?: number | null;
  giftDescription?: string | null;
  weight: number;
  active: boolean;
};

// Trims and rejects an input that doesn't make sense for its kind, so a
// bad save can't leave a "cash" prize with no amount, or a label so long
// it breaks the wheel UI. Returns null (valid) or an error message.
function validatePrizeInput(input: PrizeOptionInput): string | null {
  const label = input.label.trim();
  if (!label) return "Prize needs a name.";
  if (label.length > MAX_LABEL_LENGTH) return `Name must be under ${MAX_LABEL_LENGTH} characters.`;

  if (!VALID_KINDS.includes(input.kind)) return "Unknown prize type.";

  if (!Number.isFinite(input.weight) || input.weight < 1) return "Odds weight must be at least 1.";

  if (input.kind === "xp_boost") {
    if (!input.xpAmount || input.xpAmount < 1) return "XP boost needs an amount greater than 0.";
  }
  if (input.kind === "cash") {
    if (!input.cashAmount || input.cashAmount < 1) return "Cash prize needs an amount greater than ₦0.";
  }
  if (input.kind === "gift") {
    const desc = (input.giftDescription ?? "").trim();
    if (!desc) return "Gift prize needs a description.";
    if (desc.length > MAX_GIFT_DESCRIPTION_LENGTH) return `Gift description must be under ${MAX_GIFT_DESCRIPTION_LENGTH} characters.`;
  }

  return null;
}

// Shared ownership check — verifies the caller is an owner and returns
// their active store's id, or null if either check fails.
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

// --- List -------------------------------------------------------------------

export async function listPrizeOptions() {
  try {
    const storeId = await requireOwnerStoreId();
    if (!storeId) return null;

    await ensurePrizePoolSeeded(storeId);

    return await prisma.spinPrizeOption.findMany({
      where: { storeId },
      orderBy: [{ active: "desc" }, { id: "asc" }],
    });
  } catch (error) {
    console.error("listPrizeOptions failed:", error);
    return null;
  }
}

// --- Create -----------------------------------------------------------------

export async function createPrizeOption(input: PrizeOptionInput): Promise<{ success: boolean; error?: string }> {
  try {
    const storeId = await requireOwnerStoreId();
    if (!storeId) return { success: false, error: "Not authorized." };

    const validationError = validatePrizeInput(input);
    if (validationError) return { success: false, error: validationError };

    await prisma.spinPrizeOption.create({
      data: {
        storeId,
        label: input.label.trim(),
        kind: input.kind,
        xpAmount: input.kind === "xp_boost" ? input.xpAmount : null,
        cashAmount: input.kind === "cash" ? input.cashAmount : null,
        giftDescription: input.kind === "gift" ? input.giftDescription?.trim() : null,
        weight: Math.round(input.weight),
        active: input.active,
        isDefault: false,
      },
    });

    revalidatePath("/owner/rush/prizes");
    revalidatePath("/owner/rush");
    revalidatePath("/staff/rush");

    return { success: true };
  } catch (error) {
    console.error("createPrizeOption failed:", error);
    return { success: false, error: "Something went wrong saving that prize." };
  }
}

// --- Update -----------------------------------------------------------------

export async function updatePrizeOption(
  id: number,
  input: PrizeOptionInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const storeId = await requireOwnerStoreId();
    if (!storeId) return { success: false, error: "Not authorized." };

    const validationError = validatePrizeInput(input);
    if (validationError) return { success: false, error: validationError };

    const existing = await prisma.spinPrizeOption.findFirst({ where: { id, storeId } });
    if (!existing) return { success: false, error: "Prize not found." };

    await prisma.spinPrizeOption.update({
      where: { id },
      data: {
        label: input.label.trim(),
        kind: input.kind,
        xpAmount: input.kind === "xp_boost" ? input.xpAmount : null,
        cashAmount: input.kind === "cash" ? input.cashAmount : null,
        giftDescription: input.kind === "gift" ? input.giftDescription?.trim() : null,
        weight: Math.round(input.weight),
        active: input.active,
      },
    });

    revalidatePath("/owner/rush/prizes");
    revalidatePath("/owner/rush");
    revalidatePath("/staff/rush");

    return { success: true };
  } catch (error) {
    console.error("updatePrizeOption failed:", error);
    return { success: false, error: "Something went wrong saving that prize." };
  }
}

// --- Delete -----------------------------------------------------------------

export async function deletePrizeOption(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const storeId = await requireOwnerStoreId();
    if (!storeId) return { success: false, error: "Not authorized." };

    const existing = await prisma.spinPrizeOption.findFirst({ where: { id, storeId } });
    if (!existing) return { success: false, error: "Prize not found." };

    // Safe even if staff have already won this prize — RewardSpin keeps
    // its own snapshot (prizeLabel/prizeKind) and prizeOptionId is set
    // null on delete (see the relation's onDelete: SetNull), so past
    // wins still display correctly.
    await prisma.spinPrizeOption.delete({ where: { id } });

    revalidatePath("/owner/rush/prizes");
    revalidatePath("/owner/rush");
    revalidatePath("/staff/rush");

    return { success: true };
  } catch (error) {
    console.error("deletePrizeOption failed:", error);
    return { success: false, error: "Something went wrong deleting that prize." };
  }
}