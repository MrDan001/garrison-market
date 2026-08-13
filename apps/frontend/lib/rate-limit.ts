// FILE: apps/frontend/lib/rate-limit.ts
//
// Simple fixed-window rate limiter backed by the RateLimitBucket table
// (see prisma/schema/base.prisma). DB-backed rather than in-memory because
// the app runs on Vercel serverless — an in-memory Map (like the one the
// Dev Assistant chat uses for its low-stakes admin-only throttle) resets
// on every cold start and isn't shared across instances, so it can't
// actually stop a real brute-force attempt spread across requests.
//
// Usage:
//   const result = await checkRateLimit(`login:email:${email}`, { max: 5, windowMs: 15 * 60 * 1000 });
//   if (!result.allowed) return { error: `Too many attempts. Try again in ${result.retryAfterSeconds}s.` };

import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): Promise<RateLimitResult> {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

      if (!existing || now.getTime() - existing.windowStart.getTime() >= opts.windowMs) {
        // No bucket yet, or the previous window has fully expired — start fresh.
        await tx.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, windowStart: now },
          update: { count: 1, windowStart: now },
        });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (existing.count >= opts.max) {
        const retryAfterMs = opts.windowMs - (now.getTime() - existing.windowStart.getTime());
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      await tx.rateLimitBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      return { allowed: true, retryAfterSeconds: 0 };
    });
  } catch (error) {
    // Fail open: if the rate-limit table/query has a problem, don't take
    // down login or password reset over it — just let the request through.
    console.error("Rate limit check failed (failing open):", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// Clears a bucket entirely — call this on a successful login so a user
// who mistypes their password a couple of times isn't left sitting closer
// to the limit than they should be once they actually get in.
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  } catch (error) {
    console.error("Rate limit reset failed (non-fatal):", error);
  }
}

// Best-effort client IP extraction behind Vercel's proxy. Not spoof-proof
// (a client could set its own x-forwarded-for if not behind Vercel), but
// on Vercel this header is set by the platform's edge network, and IP is
// only ever used here as a second, coarser bucket alongside an
// email-keyed one — never as the sole gate on something sensitive.
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = headerList.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}