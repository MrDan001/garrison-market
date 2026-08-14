// FILE: apps/frontend/lib/affiliate-internal.ts (NEW FILE — security fix)
//
// Server-only helpers for affiliate attribution and commission, called
// exclusively from other server-side code (the Paystack webhook route,
// and the owner-registration action) — never directly from a client
// component or form. They previously lived in affiliate.actions.ts, but
// that file has a file-level "use server" directive, which makes EVERY
// export in it a public, directly-invokable Server Action regardless of
// whether any UI actually calls it. That meant anyone who found the
// action's internal ID (visible in the client bundle) could call
// creditAffiliateCommission(), reverseAffiliateCommission(),
// resolveAffiliateAttribution(), or markAffiliateClickConverted()
// directly, with arbitrary parameters, completely bypassing the actual
// UI and any session it would normally require.
//
// This file deliberately has NO "use server" directive. Plain exported
// functions from an ordinary .ts file can still be imported and called
// freely by any other server-side code (route handlers, Server
// Components, other Server Actions) — they're just no longer reachable
// as a public RPC endpoint from the browser. That's the entire fix: no
// logic changed, just where the line between "internal" and "public"
// actually gets enforced.

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { AFFILIATE_COOKIE_NAME, AFFILIATE_COOKIE_MAX_AGE } from "@/lib/affiliate-constants";

function sanitizeToReferralToken(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Called at owner-registration time to attribute the signup to an
// affiliate, via the click-tracking cookie or (fallback) a manually
// entered code.
export async function resolveAffiliateAttribution(
  newOwnerEmail: string,
  manualCodeInput?: string | null
): Promise<{ affiliateId: number; clickId: number | null } | null> {
  try {
    let affiliateCode: string | null = null;
    let clickId: number | null = null;

    const cookieStore = await cookies();
    const raw = cookieStore.get(AFFILIATE_COOKIE_NAME)?.value;
    if (raw) {
      // Cookie value is "CODE:clickId"
      const [code, clickIdStr] = raw.split(":");
      affiliateCode = code || null;
      clickId = clickIdStr ? parseInt(clickIdStr, 10) : null;
    }

    if (!affiliateCode && manualCodeInput && manualCodeInput.trim() !== "") {
      affiliateCode = sanitizeToReferralToken(manualCodeInput.trim());
    }

    if (!affiliateCode) return null;

    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode: affiliateCode },
      select: { id: true, email: true, status: true },
    });

    if (!affiliate || affiliate.status === "suspended") return null;

    // Self-referral block: affiliate cannot earn commission by signing
    // their own shop up under their own link.
    if (affiliate.email.toLowerCase() === newOwnerEmail.toLowerCase()) {
      console.warn(`Blocked self-referral attempt: affiliate ${affiliate.id} tried to refer own email.`);
      return null;
    }

    // Defense-in-depth on the 30-day window: the cookie itself expires
    // after 30 days (see AFFILIATE_COOKIE_MAX_AGE), so this should rarely
    // trigger, but a click row lets us double-check server-side too.
    if (clickId) {
      const click = await prisma.affiliateClick.findUnique({ where: { id: clickId } });
      if (click) {
        const ageMs = Date.now() - click.clickedAt.getTime();
        if (ageMs > AFFILIATE_COOKIE_MAX_AGE * 1000) return null;
      }
    }

    return { affiliateId: affiliate.id, clickId };
  } catch (error) {
    console.error("resolveAffiliateAttribution error:", error);
    return null;
  }
}

// Called right after a new owner row is created, if attribution resolved.
// Marks the originating click as converted (for the Promote-page
// conversion stat) — best-effort, never blocks registration.
export async function markAffiliateClickConverted(clickId: number | null, newOwnerId: number) {
  if (!clickId) return;
  try {
    await prisma.affiliateClick.update({
      where: { id: clickId },
      data: { converted: true, convertedOwnerId: newOwnerId },
    });
  } catch (error) {
    console.error("markAffiliateClickConverted error:", error);
  }
}

// --- COMMISSION (called from the Paystack webhook) ---

// Resolves the 50%/30% rate for a given "referral month" of a referred
// owner's subscription (month 1-3 = 50%, month 4+ = 30%), per the
// commission structure you locked in.
function rateForMonth(monthNumber: number): number {
  return monthNumber <= 3 ? 50 : 30;
}

// Creates commission for a successful subscription payment by a referred
// owner. Your billing is upfront in multi-month blocks (quarterly/
// biannual/annual — see lib/plans.ts), not literally monthly, so this
// prorates: it works out which "referral month" each month of the block
// falls on (based on how many months have already been commissioned for
// this owner) and creates one ledger row per month, applying that
// month's own rate. A quarterly payment landing on months 2-4 correctly
// splits into two months at 50% and one at 30%.
//
// Wrap every call to this in a try/catch — a commission-calculation
// problem must never block a real payment from completing.
export async function creditAffiliateCommission(params: {
  ownerId: number;
  paymentId: number;
  amountNaira: number; // total amount paid for this billing block
  monthsCovered: number; // how many months this payment's block covers
}) {
  const { ownerId, paymentId, amountNaira, monthsCovered } = params;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, affiliateId: true },
  });

  if (!owner || !owner.affiliateId) {
    return { success: false, reason: "Owner has no attributed affiliate." };
  }

  // Guard against double-crediting if the webhook somehow fires twice for
  // the same payment (Paystack can retry webhooks).
  const alreadyCredited = await prisma.affiliateCommission.findFirst({
    where: { paymentId },
    select: { id: true },
  });
  if (alreadyCredited) {
    return { success: false, reason: "Already credited for this payment." };
  }

  const monthsAlreadyCommissioned = await prisma.affiliateCommission.count({
    where: { affiliateId: owner.affiliateId, ownerId, kind: "earned" },
  });

  const perMonthValue = amountNaira / monthsCovered;

  const rows = Array.from({ length: monthsCovered }, (_, i) => {
    const monthNumber = monthsAlreadyCommissioned + i + 1;
    const ratePercent = rateForMonth(monthNumber);
    return {
      affiliateId: owner.affiliateId as number,
      ownerId,
      paymentId,
      monthNumber,
      ratePercent,
      amountNaira: Math.round(perMonthValue * (ratePercent / 100)),
      kind: "earned",
      status: "unpaid",
    };
  });

  await prisma.affiliateCommission.createMany({ data: rows });

  return { success: true, monthsCredited: monthsCovered };
}

// Called when an owner's payment is refunded/charged back. Creates
// reversal rows (negative amount) for whatever commission that payment
// generated, rather than deleting the original rows — keeps the ledger
// an honest audit trail. Deduct-next-month happens naturally: an unpaid
// reversal row just nets against future unpaid commission when payouts
// are totaled.
export async function reverseAffiliateCommission(paymentId: number) {
  try {
    const original = await prisma.affiliateCommission.findMany({
      where: { paymentId, kind: "earned" },
    });
    if (original.length === 0) return { success: false, reason: "No commission found for this payment." };

    await prisma.affiliateCommission.createMany({
      data: original.map((row) => ({
        affiliateId: row.affiliateId,
        ownerId: row.ownerId,
        paymentId: row.paymentId,
        monthNumber: row.monthNumber,
        ratePercent: row.ratePercent,
        // row.amountNaira comes back as a Prisma.Decimal — .negated() flips
        // its sign without the float-precision risk of casting to Number.
        amountNaira: row.amountNaira.negated(),
        kind: "reversal",
        status: "unpaid",
      })),
    });

    return { success: true };
  } catch (error) {
    console.error("reverseAffiliateCommission error:", error);
    return { success: false, reason: "Internal error." };
  }
}