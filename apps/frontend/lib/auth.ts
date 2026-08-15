import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { INACTIVITY_LIMIT_MS } from "@/lib/session-config";

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

// What counts as "active" differs by role because that's how the rest of
// the app already treats it, not a rule invented here: owner/admin only
// ever treat "approved" as active (see app/pending/page.tsx and
// prisma/seed.ts), while staff blocks specifically "suspended"/"pending"
// and lets everything else — in practice "active" — through (see
// app/staff/dashboard/page.tsx). Those two conventions already disagree
// with each other; this mirrors both as-is rather than unifying them.
//
// Pulled out as a shared export so proxy.ts (the live per-request check)
// and any server action that wants the same rule (e.g. lib/debt.actions.ts,
// lib/business.actions.ts) use one definition instead of two copies that
// can quietly drift out of sync with each other over time.
export function isActiveForRole(role: string | null | undefined, status: string | null | undefined): boolean {
  const r = (role ?? "").toLowerCase().trim();
  const s = (status ?? "").toLowerCase().trim();
  if (r === "staff") {
    return s !== "suspended" && s !== "pending";
  }
  return s === "approved";
}

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
        lastActivityAt: true,
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

    // Server-side inactivity enforcement. This is the authoritative check
    // — deliberately independent of SessionTimeoutGuard's client-side JS
    // timer, which cannot be trusted to run: a locked screen or
    // backgrounded/fully-closed tab suspends or discards it, and a copied
    // cookie replayed straight against a server action never runs it at
    // all. lastActivityAt is wall-clock time written by the server itself,
    // so none of that matters — if too much real time has passed since the
    // last request this session made, it's dead, full stop.
    const now = Date.now();
    const lastActive = user.lastActivityAt?.getTime() ?? 0;
    if (!user.lastActivityAt || now - lastActive > INACTIVITY_LIMIT_MS) {
      // Revoke server-side so the cookie can't be replayed later, exactly
      // like an explicit/timeout logout does.
      await prisma.user
        .update({ where: { id: user.id }, data: { currentSessionToken: null } })
        .catch(() => {});
      return null;
    }

    // Refresh the activity clock, throttled to once a minute so normal
    // browsing doesn't turn into an UPDATE on every single request.
    if (now - lastActive > 60 * 1000) {
      await prisma.user
        .update({ where: { id: user.id }, data: { lastActivityAt: new Date(now) } })
        .catch(() => {});
    }

    const { currentSessionToken, lastActivityAt, ...safeUser } = user;

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