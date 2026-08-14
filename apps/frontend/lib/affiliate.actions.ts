// FILE: apps/frontend/lib/affiliate.actions.ts

"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { setAffiliateSessionCookie, clearAffiliateSessionCookie, getAffiliateSession } from "@/lib/affiliate-auth";
import { getSessionUser } from "@/lib/auth.actions";

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
// resolveAffiliateAttribution, markAffiliateClickConverted,
// creditAffiliateCommission, and reverseAffiliateCommission moved to
// lib/affiliate-internal.ts (security fix — see that file's header
// comment). This file has a file-level "use server" directive, which
// makes every export in it a public, directly-callable Server Action;
// those four are only ever meant to be called from other server code
// (the Paystack webhook, the registration action), never from client
// UI, so they don't belong in a "use server" file at all.

// Single query surface for the Overview page — one call instead of the
// page assembling several itself.
export async function getAffiliateDashboardData(affiliateId: number) {
  const session = await getAffiliateSession();
  if (!session || session.id !== affiliateId) {
    throw new Error("Unauthorized");
  }

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
  const session = await getAffiliateSession();
  if (!session || session.id !== affiliateId) {
    return { error: "Unauthorized" };
  }

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
  const session = await getAffiliateSession();
  if (!session || session.id !== affiliateId) {
    throw new Error("Unauthorized");
  }

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
  const session = await getAffiliateSession();
  if (!session || session.id !== affiliateId) {
    return { error: "Unauthorized" };
  }

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
  const session = await getAffiliateSession();
  if (!session || session.id !== affiliateId) {
    throw new Error("Unauthorized");
  }

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
// SECURITY FIX: this comment used to say every function below assumes
// the caller already checked session.role === "admin" on the page and
// doesn't re-check here. That assumption is wrong — this file has a
// file-level "use server" directive, so every export is a public,
// directly-invokable Server Action regardless of what any page does
// before rendering a button that calls it. Each function below now
// verifies admin status itself.

export async function listAffiliatesForAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    throw new Error("Unauthorized");
  }

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
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return { error: "Unauthorized" };
  }

  try {
    await prisma.affiliate.update({ where: { id: affiliateId }, data: { status } });
    return { success: true };
  } catch (error) {
    console.error("updateAffiliateStatusAction error:", error);
    return { error: "Could not update affiliate status." };
  }
}

export async function listPayoutRequestsForAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    throw new Error("Unauthorized");
  }

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
//
// SECURITY FIX: the `adminEmail` parameter is still accepted (so the
// existing client component doesn't need to change) but is no longer
// trusted or written to the audit trail — it's client-supplied and was
// previously stored verbatim as `processedBy` with no verification it
// was even a real admin's email. `processedBy` now comes from the
// verified session instead.
export async function markPayoutPaidAction(payoutId: number, _adminEmail: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return { error: "Unauthorized" };
  }

  try {
    const payout = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
    if (!payout) return { error: "Payout not found." };

    await prisma.$transaction([
      prisma.affiliatePayout.update({
        where: { id: payoutId },
        data: { status: "paid", processedAt: new Date(), processedBy: session.email },
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

// SECURITY FIX: same as markPayoutPaidAction above — `adminEmail` is
// accepted but ignored; `processedBy` comes from the verified session.
export async function rejectPayoutAction(payoutId: number, _adminEmail: string, note: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return { error: "Unauthorized" };
  }

  try {
    await prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: "rejected", processedAt: new Date(), processedBy: session.email, note },
    });
    return { success: true };
  } catch (error) {
    console.error("rejectPayoutAction error:", error);
    return { error: "Could not reject payout." };
  }
}

// Last-6-months earnings series for the Overview chart.
export async function getAffiliateEarningsSeries(affiliateId: number) {
  const session = await getAffiliateSession();
  if (!session || session.id !== affiliateId) {
    throw new Error("Unauthorized");
  }

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