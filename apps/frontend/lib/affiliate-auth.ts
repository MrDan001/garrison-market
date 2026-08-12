// FILE: apps/frontend/lib/affiliate-auth.ts
//
// Session handling for affiliates. Reuses the same signToken/verifyToken
// (jose HS256) as owner/staff auth, but on its own cookie
// ("affiliate-session-token") and its own table (Affiliate, not User) —
// so an affiliate and an owner/admin can be logged in side by side in the
// same browser without clashing.

import { cookies } from "next/headers";
import { cache } from "react";
import prisma from "@/lib/prisma";
import { signToken, verifyToken } from "@/lib/auth";

const COOKIE_NAME = "affiliate-session-token";

export async function setAffiliateSessionCookie(affiliateId: number) {
  const token = await signToken(affiliateId, "affiliate");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days, same as owner session
  });
}

export async function clearAffiliateSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// cache()-memoized per request, same pattern as getSessionUser() in
// lib/auth.ts.
export const getAffiliateSession = cache(async function getAffiliateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "affiliate") return null;

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        referralCode: true,
      },
    });
    return affiliate;
  } catch {
    return null;
  }
});