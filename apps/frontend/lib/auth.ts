import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import prisma from "@/lib/prisma";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

// --- Token Helpers ---

export async function signToken(userId: number, role: string) {
  return await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: number; role: string };
  } catch {
    return null;
  }
}

// --- Session Helpers ---

// cache() memoizes this per request (not globally, not across users) — so
// when both a layout and its page call getSessionUser() during the same
// render, the second call reuses the first's result instead of re-hitting
// the database. Safe: the cache is scoped to a single request's render pass.
export const getSessionUser = cache(async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        ownerId: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
      },
    });

    if (!user) return null;

    // Convert raw JavaScript Date instances to plain ISO strings before leaving the server
    return {
      ...user,
      currentPeriodEnd: user.currentPeriodEnd ? user.currentPeriodEnd.toISOString() : null,
    };
  } catch {
    return null;
  }
});

export async function auth() {
  return await getSessionUser();
}