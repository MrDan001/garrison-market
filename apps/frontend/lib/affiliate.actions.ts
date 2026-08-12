// FILE: apps/frontend/lib/affiliate.actions.ts

"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { cookies } from "next/headers";
import { setAffiliateSessionCookie, clearAffiliateSessionCookie } from "@/lib/affiliate-auth";
import { AFFILIATE_COOKIE_NAME, AFFILIATE_COOKIE_MAX_AGE } from "@/lib/affiliate-constants";

// Cookie set by app/ref/[code]/route.ts when someone clicks an affiliate
// link. Read here at owner-registration time to attribute the signup.
// (Constants moved to affiliate-constants.ts — see that file's header
// for why.)

function sanitizeToReferralToken(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Same collision-avoidance pattern as generateUniqueReferralCode() in
// auth.actions.ts, but against the Affiliate table's referralCode column.
async function generateUniqueAffiliateCode(fullName: string): Promise<string> {
  const base = sanitizeToReferralToken(fullName || "");
  const root = base !== "" ? base : `AFF${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  let candidate = root;
  let suffix = 1;
  while (suffix < 1000) {
    const existing = await prisma.affiliate.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${root}${suffix}`;
  }
  return `${root}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

// --- SIGNUP / LOGIN ---

export async function registerAffiliateAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());

  try {
    const email = (data.email as string).toLowerCase().trim();

    const existing = await prisma.affiliate.findUnique({ where: { email } });
    if (existing) {
      return { error: "An affiliate account with this email already exists." };
    }

    const hashedPassword = await bcrypt.hash(data.password as string, 10);
    const referralCode = await generateUniqueAffiliateCode(data.fullName as string);

    const affiliate = await prisma.affiliate.create({
      data: {
        email,
        password: hashedPassword,
        fullName: data.fullName as string,
        phoneNumber: data.phoneNumber as string,
        bankName: (data.bankName as string) || null,
        bankAccountNumber: (data.bankAccountNumber as string) || null,
        bankAccountName: (data.bankAccountName as string) || null,
        referralCode,
        status: "active", // no approval queue for v1 — affiliates can promote immediately
      },
    });

    await setAffiliateSessionCookie(affiliate.id);

    return { redirectUrl: "/affiliate" };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "An affiliate account with these details already exists." };
    }
    console.error("Affiliate registration error:", error);
    return { error: "An unexpected error occurred." };
  }
}

export async function loginAffiliateAction(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { email } });
    if (!affiliate) {
      return { error: "Invalid email or password." };
    }

    const match = await bcrypt.compare(password, affiliate.password);
    if (!match) {
      return { error: "Invalid email or password." };
    }

    if (affiliate.status === "suspended") {
      return { error: "This affiliate account has been suspended. Contact support." };
    }

    await setAffiliateSessionCookie(affiliate.id);
    return { redirectUrl: "/affiliate" };
  } catch (error) {
    console.error("Affiliate login error:", error);
    return { error: "An unexpected error occurred." };
  }
}

export async function logoutAffiliateAction() {
  await clearAffiliateSessionCookie();
  return { redirectUrl: "/affiliate/login" };
}

// --- ATTRIBUTION (called from registerOwnerAction in auth.actions.ts) ---

// Reads the affiliate-click cookie (set by app/ref/[code]/route.ts) and
// returns the affiliateId + clickId to attribute a new owner signup to,
// or null if there's no cookie, it's expired, or it fails the
// self-referral check (an affiliate can't earn commission on their own
// shop). Call this from registerOwnerAction BEFORE creating the owner,
// then pass the result into the User.create() data.
//
// Also accepts an optional manually-typed code (the "offline
// registration" path from the spec — someone hands a shop owner a
// printed code instead of a link) as a fallback when there's no cookie.
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
// Wrap every call to this in a try/catch, same as creditReferralReward —
// a commission-calculation problem must never block a real payment from
// completing.
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

// Single query surface for the Overview page — one call instead of the
// page assembling several itself.
export async function getAffiliateDashboardData(affiliateId: number) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const [
    totalEarnedAgg,
    thisMonthAgg,
    lastMonthAgg,
    recentCommissions,
    clickCount,
    signupCount,
    activeReferralCount,
  ] = await Promise.all([
    prisma.affiliateCommission.aggregate({
      where: { affiliateId },
      _sum: { amountNaira: true },
    }),
    prisma.affiliateCommission.aggregate({
      where: { affiliateId, createdAt: { gte: startOfMonth } },
      _sum: { amountNaira: true },
    }),
    prisma.affiliateCommission.aggregate({
      where: { affiliateId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      _sum: { amountNaira: true },
    }),
    prisma.affiliateCommission.findMany({
      where: { affiliateId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateClick.count({ where: { affiliateId, converted: true } }),
    // "Active" = referred owner currently on an active, non-cancelled subscription.
    prisma.user.count({
      where: { affiliateId, subscriptionStatus: "active" },
    }),
  ]);

  const totalEarned = Number(totalEarnedAgg._sum.amountNaira || 0);
  const thisMonth = Number(thisMonthAgg._sum.amountNaira || 0);
  const lastMonth = Number(lastMonthAgg._sum.amountNaira || 0);
  const monthOverMonthPct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  return {
    totalEarned,
    thisMonth,
    monthOverMonthPct,
    activeReferralCount,
    clickCount,
    signupCount,
    conversionPct: clickCount > 0 ? Math.round((signupCount / clickCount) * 1000) / 10 : 0,
    recentCommissions,
  };
}

export async function requestPayoutAction(affiliateId: number) {
  try {
    const unpaid = await prisma.affiliateCommission.aggregate({
      where: { affiliateId, status: "unpaid" },
      _sum: { amountNaira: true },
    });
    const amount = Number(unpaid._sum.amountNaira || 0);

    if (amount < 5000) {
      return { error: "Minimum payout is ₦5,000. Keep earning and check back." };
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate?.bankAccountNumber || !affiliate?.bankName) {
      return { error: "Add your bank details in Settings before requesting a payout." };
    }

    // Block duplicate open requests — one at a time keeps the admin
    // approval queue simple.
    const existingOpen = await prisma.affiliatePayout.findFirst({
      where: { affiliateId, status: { in: ["requested", "approved"] } },
    });
    if (existingOpen) {
      return { error: "You already have a payout request in progress." };
    }

    await prisma.affiliatePayout.create({
      data: {
        affiliateId,
        amountNaira: amount,
        status: "requested",
        bankName: affiliate.bankName,
        bankAccountNumber: affiliate.bankAccountNumber,
        bankAccountName: affiliate.bankAccountName,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("requestPayoutAction error:", error);
    return { error: "An unexpected error occurred." };
  }
}

export async function getAffiliatePayoutData(affiliateId: number) {
  const [unpaidAgg, paidAgg, payouts] = await Promise.all([
    prisma.affiliateCommission.aggregate({
      where: { affiliateId, status: "unpaid" },
      _sum: { amountNaira: true },
    }),
    prisma.affiliatePayout.aggregate({
      where: { affiliateId, status: "paid" },
      _sum: { amountNaira: true },
    }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  return {
    available: Number(unpaidAgg._sum.amountNaira || 0),
    totalPaid: Number(paidAgg._sum.amountNaira || 0),
    pendingRequest: payouts.find((p) => p.status === "requested" || p.status === "approved") || null,
    payouts,
  };
}

export async function updateAffiliateSettingsAction(affiliateId: number, formData: FormData) {
  try {
    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        phoneNumber: (formData.get("phoneNumber") as string) || undefined,
        bankName: (formData.get("bankName") as string) || null,
        bankAccountNumber: (formData.get("bankAccountNumber") as string) || null,
        bankAccountName: (formData.get("bankAccountName") as string) || null,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("updateAffiliateSettingsAction error:", error);
    return { error: "Could not save changes." };
  }
}

export async function getAffiliateReferrals(affiliateId: number) {
  const owners = await prisma.user.findMany({
    where: { affiliateId },
    select: {
      id: true,
      storeName: true,
      email: true,
      subscriptionStatus: true,
      plan: true,
      affiliateReferredAt: true,
    },
    orderBy: { affiliateReferredAt: "desc" },
  });

  const ownerIds = owners.map((o) => o.id);
  const commissionTotals = await prisma.affiliateCommission.groupBy({
    by: ["ownerId"],
    where: { affiliateId, ownerId: { in: ownerIds } },
    _sum: { amountNaira: true },
  });
  const totalsByOwner = new Map(commissionTotals.map((c) => [c.ownerId, Number(c._sum.amountNaira || 0)]));

  return owners.map((owner) => ({
    ...owner,
    commissionEarned: totalsByOwner.get(owner.id) || 0,
  }));
}

// --- ADMIN-SIDE MANAGEMENT ---
// Every function below assumes the caller has already checked
// session.role === "admin" (same guard pattern as every other
// app/admin/*/page.tsx in this codebase) — these do not re-check.

export async function listAffiliatesForAdmin() {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { referredOwners: true } },
    },
  });

  const earnedTotals = await prisma.affiliateCommission.groupBy({
    by: ["affiliateId"],
    _sum: { amountNaira: true },
  });
  const totalsMap = new Map(earnedTotals.map((e) => [e.affiliateId, Number(e._sum.amountNaira || 0)]));

  return affiliates.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    email: a.email,
    status: a.status,
    referralCode: a.referralCode,
    referredCount: a._count.referredOwners,
    totalEarned: totalsMap.get(a.id) || 0,
    createdAt: a.createdAt,
  }));
}

export async function updateAffiliateStatusAction(affiliateId: number, status: "active" | "suspended") {
  try {
    await prisma.affiliate.update({ where: { id: affiliateId }, data: { status } });
    return { success: true };
  } catch (error) {
    console.error("updateAffiliateStatusAction error:", error);
    return { error: "Could not update affiliate status." };
  }
}

export async function listPayoutRequestsForAdmin() {
  const payouts = await prisma.affiliatePayout.findMany({
    where: { status: { in: ["requested", "approved"] } },
    orderBy: { requestedAt: "asc" }, // oldest first — first come, first sent
    include: { affiliate: { select: { fullName: true, email: true } } },
  });
  return payouts;
}

// Admin has sent the transfer by hand (v1 = manual payout) and confirms
// it here. Flips the payout to "paid" and marks every unpaid commission
// row this affiliate had at request time as "paid" too, so the ledger
// and the payout total stay in sync.
export async function markPayoutPaidAction(payoutId: number, adminEmail: string) {
  try {
    const payout = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
    if (!payout) return { error: "Payout not found." };

    await prisma.$transaction([
      prisma.affiliatePayout.update({
        where: { id: payoutId },
        data: { status: "paid", processedAt: new Date(), processedBy: adminEmail },
      }),
      prisma.affiliateCommission.updateMany({
        where: { affiliateId: payout.affiliateId, status: "unpaid" },
        data: { status: "paid" },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("markPayoutPaidAction error:", error);
    return { error: "Could not mark payout as paid." };
  }
}

export async function rejectPayoutAction(payoutId: number, adminEmail: string, note: string) {
  try {
    await prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: "rejected", processedAt: new Date(), processedBy: adminEmail, note },
    });
    return { success: true };
  } catch (error) {
    console.error("rejectPayoutAction error:", error);
    return { error: "Could not reject payout." };
  }
}

// Last-6-months earnings series for the Overview chart.
export async function getAffiliateEarningsSeries(affiliateId: number) {
  const months: { label: string; total: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const agg = await prisma.affiliateCommission.aggregate({
      where: { affiliateId, createdAt: { gte: start, lt: end } },
      _sum: { amountNaira: true },
    });
    months.push({
      label: start.toLocaleDateString("en-NG", { month: "short" }),
      total: Number(agg._sum.amountNaira || 0),
    });
  }

  return months;
}