import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import crypto from "crypto";
import prisma from "@/lib/prisma";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

// --- Token Helpers ---

// A fresh, cryptographically random session token (32 bytes — unguessable,
// not a sequential/lookup ID) minted on every login. Stored on
// User.currentSessionToken and embedded in the JWT — see getSessionUser()
// below for how the two are compared to enforce a single active session
// per user.
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function signToken(userId: number, role: string, sessionToken?: string) {
  const claims: Record<string, unknown> = { userId, role };
  if (sessionToken) claims.sessionToken = sessionToken;

  return await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: number; role: string; sessionToken?: string };
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
        currentSessionToken: true,
      },
    });

    if (!user) return null;

    // Single-session enforcement: if this token's sessionToken doesn't
    // match what's currently on the user's row, a newer login (on another
    // device) has replaced it, or an explicit/timeout logout cleared it.
    // Either way, this session is stale — treat the caller as logged out.
    if (!payload.sessionToken || payload.sessionToken !== user.currentSessionToken) {
      return null;
    }

    const { currentSessionToken, ...safeUser } = user;

    // Convert raw JavaScript Date instances to plain ISO strings before leaving the server
    return {
      ...safeUser,
      currentPeriodEnd: user.currentPeriodEnd ? user.currentPeriodEnd.toISOString() : null,
    };
  } catch {
    return null;
  }
});

export async function auth() {
  return await getSessionUser();
}
