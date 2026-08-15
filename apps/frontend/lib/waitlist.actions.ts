// FILE: apps/frontend/lib/waitlist.actions.ts
//
// Stage 1 of the 100-day registration-gate waitlist. See
// prisma/schema/waitlist.prisma for the data model and why referral
// attribution is stored as a loose code+type pair instead of a strict
// foreign key.

"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import { sendWaitlistMilestoneEmail, sendWaitlistInviteEmail } from "@/lib/email";

function sanitizeToReferralToken(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Same collision-avoidance pattern used for owner/affiliate referral
// codes elsewhere in this codebase (see generateUniqueReferralCode in
// auth.actions.ts and generateUniqueAffiliateCode in affiliate.actions.ts) —
// duplicated locally rather than shared, matching how those two already
// don't share one either, since each checks a different table's column.
async function generateUniqueWaitlistCode(fullName: string): Promise<string> {
  const base = sanitizeToReferralToken(fullName || "");
  const root = base !== "" ? base : `GM${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  let candidate = root;
  let suffix = 1;
  while (suffix < 1000) {
    const existing = await prisma.waitlistSignup.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${root}${suffix}`;
  }
  return `${root}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

// Resolves an incoming ?ref= code against all three places a referrer
// could live — another waitlist signup, an existing owner, or an
// existing affiliate — rather than trusting a "type" the client might
// claim. Returns null if the code doesn't match anything real, so a
// bad/typo'd/expired code just results in an untracked signup instead
// of a broken one.
async function resolveReferrer(rawCode: string | null | undefined): Promise<{ code: string; type: "waitlist" | "owner" | "affiliate" } | null> {
  if (!rawCode) return null;
  const code = sanitizeToReferralToken(rawCode.trim());
  if (!code) return null;

  const waitlistMatch = await prisma.waitlistSignup.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (waitlistMatch) return { code, type: "waitlist" };

  const ownerMatch = await prisma.user.findFirst({
    where: { referralCode: code, role: "owner" },
    select: { id: true },
  });
  if (ownerMatch) return { code, type: "owner" };

  const affiliateMatch = await prisma.affiliate.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (affiliateMatch) return { code, type: "affiliate" };

  return null;
}

export async function joinWaitlistAction(formData: FormData) {
  const fullName = (formData.get("fullName") as string || "").trim();
  const email = (formData.get("email") as string || "").trim().toLowerCase();
  const phone = (formData.get("phone") as string || "").trim();
  const state = (formData.get("state") as string || "").trim() || null;
  const lga = (formData.get("lga") as string || "").trim() || null;
  const sells = (formData.get("sells") as string || "").trim() || null;
  const rawRef = (formData.get("ref") as string) || null;

  if (!fullName || !email || !phone) {
    return { error: "Name, email, and phone are required." };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    const referrer = await resolveReferrer(rawRef);
    const referralCode = await generateUniqueWaitlistCode(fullName);

    const signup = await prisma.waitlistSignup.create({
      data: {
        fullName,
        email,
        phone,
        state,
        lga,
        sells,
        referralCode,
        referredByCode: referrer?.code ?? null,
        referredByType: referrer?.type ?? null,
      },
      select: { id: true, referralCode: true },
    });

    // Queue-position boost only makes sense when the referrer is
    // themselves on the waitlist and competing for position — an
    // owner or affiliate referrer isn't in this queue, so there's
    // nothing to boost for them (their own reward system, wired up in
    // a later stage, is separate and untouched by this).
    if (referrer?.type === "waitlist") {
      await prisma.waitlistSignup.update({
        where: { referralCode: referrer.code },
        data: { referralBoost: { increment: 1 } },
      });
    }

    return { success: true, referralCode: signup.referralCode };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { error: "That email is already on the waitlist." };
    }
    console.error("joinWaitlistAction error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

// Total signups — powers the live counter on the landing page.
export async function getWaitlistCount(): Promise<number> {
  return prisma.waitlistSignup.count();
}

// Used by the thank-you/confirmation page to show someone their own
// referral link and where they currently stand in line.
export async function getWaitlistSignupByReferralCode(code: string) {
  const signup = await prisma.waitlistSignup.findUnique({
    where: { referralCode: sanitizeToReferralToken(code) },
    select: { id: true, fullName: true, referralCode: true, referralBoost: true, createdAt: true },
  });
  if (!signup) return null;

  // Rank by referralBoost first (more referrals = further up the
  // line), then by signup time as the tiebreaker.
  const ahead = await prisma.waitlistSignup.count({
    where: {
      OR: [
        { referralBoost: { gt: signup.referralBoost } },
        { referralBoost: signup.referralBoost, createdAt: { lt: signup.createdAt } },
      ],
    },
  });

  return { ...signup, position: ahead + 1 };
}

// =====================================================================
// ADMIN
// =====================================================================

// ---- Admin: dashboard stats ----
export async function getWaitlistAdminStats(): Promise<{ total: number; last24h: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total, last24h] = await Promise.all([
    prisma.waitlistSignup.count(),
    prisma.waitlistSignup.count({ where: { createdAt: { gte: since } } }),
  ]);
  return { total, last24h };
}

// ---- Admin: referral leaderboard ----
export async function getWaitlistLeaderboard(limit: number = 10) {
  return prisma.waitlistSignup.findMany({
    where: { referralBoost: { gt: 0 } },
    orderBy: [{ referralBoost: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, fullName: true, email: true, referralBoost: true },
  });
}

// ---- Admin: full signup list ----
export async function listWaitlistForAdmin(limit: number = 200) {
  return prisma.waitlistSignup.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      state: true,
      lga: true,
      sells: true,
      referredByType: true,
      status: true,
      createdAt: true,
    },
  });
}

// ---- Admin: how many are still waiting to be invited ----
export async function getPendingReleaseCount(): Promise<number> {
  return prisma.waitlistSignup.count({ where: { status: "waiting" } });
}

// ---- Admin: broadcast a milestone update to everyone on the list ----
export async function sendWaitlistMilestoneAction(
  subject: string,
  body: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  const recipients = await prisma.waitlistSignup.findMany({
    select: { email: true, fullName: true },
  });

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendWaitlistMilestoneEmail(r.email, r.fullName, { subject, body })
    )
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.success) sent += 1;
    else failed += 1;
  }

  return { success: true, sent, failed };
}

// ---- Admin: release the waitlist — invite everyone still "waiting" ----
export async function releaseWaitlistAction(): Promise<{
  error?: string;
  released?: number;
  failed?: number;
}> {
  const { isRegistrationOpen } = await import("@/lib/system-settings.actions");
  const open = await isRegistrationOpen();
  if (!open) {
    return { error: "Registration is closed. Open the gate before releasing the waitlist." };
  }

  const pending = await prisma.waitlistSignup.findMany({
    where: { status: "waiting" },
    select: { id: true, email: true, fullName: true, referralCode: true },
  });

  const appUrl = process.env.APP_URL || "https://gmstock.co";  let released = 0;
  let failed = 0;

  for (const p of pending) {
    const registerUrl = `${appUrl}/register?ref=${p.referralCode}`;
    const result = await sendWaitlistInviteEmail(p.email, p.fullName, registerUrl);
    if (result.success) {
      await prisma.waitlistSignup.update({
        where: { id: p.id },
        data: { status: "invited", invitedAt: new Date() },
      });
      released += 1;
    } else {
      failed += 1;
    }
  }

  return { released, failed };
}