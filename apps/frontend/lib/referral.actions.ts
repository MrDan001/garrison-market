// FILE: apps/frontend/lib/referral.actions.ts
//
// SECURITY FIX: this file previously had a "use server" directive even
// though creditReferralReward() is only ever called from other
// server-side code (the Paystack webhook, lib/auth.actions.ts,
// lib/billing.actions.ts) — never from a client component or form.
// A file-level "use server" directive makes every export a public,
// directly-invokable Server Action regardless of whether any UI
// actually calls it, so this was reachable by anyone who found its
// action ID in the client bundle, with an arbitrary newOwnerId, letting
// them repeatedly grant free subscription extensions to referrers.
// Removing the directive keeps this callable from other server files
// exactly as before, just no longer exposed as a public RPC endpoint.

import prisma from "@/lib/prisma";

/**
 * Evaluates target account conversions and extends the upstream referrer's 
 * dynamic subscription plan window by exactly 7 days.
 */
export async function creditReferralReward(newOwnerId: number) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: newOwnerId },
      select: { id: true, referredById: true, hasTriggeredReferralReward: true, role: true }
    });

    if (!user || user.role !== "owner" || user.hasTriggeredReferralReward || !user.referredById) {
      return { success: false, message: "Account context ineligible for referral reward routing." };
    }

    const referrer = await tx.user.findUnique({
      where: { id: user.referredById },
      select: { id: true, currentPeriodEnd: true }
    });

    if (!referrer) {
      return { success: false, message: "Referencing system host node not identified." };
    }

    const now = new Date();
    let baselineTimestamp = new Date();

    if (referrer.currentPeriodEnd && referrer.currentPeriodEnd > now) {
      baselineTimestamp = new Date(referrer.currentPeriodEnd);
    }

    const extendedTimeline = new Date(baselineTimestamp.getTime() + 7 * 24 * 60 * 60 * 1000);

    await tx.user.update({
      where: { id: referrer.id },
      data: {
        currentPeriodEnd: extendedTimeline,
        subscriptionStatus: "active"
      }
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        hasTriggeredReferralReward: true
      }
    });

    return { 
      success: true, 
      newPeriodEnd: extendedTimeline 
    };
  });
}