// FILE: apps/frontend/lib/cron-auth.ts
//
// Shared, timing-safe verification for CRON_SECRET. All three /api/cron/*
// routes, plus autoSettleScaleConsignmentForCron, previously compared the
// secret with a plain `!==`, which leaks timing information proportional
// to how many leading characters match. CRON_SECRET is long and this
// endpoint isn't a realistic target for a timing attack today, but the
// codebase already uses crypto.timingSafeEqual for the Paystack webhook
// signature (see lib/paystack.ts) — this brings cron auth to the same
// standard for free.

import crypto from "crypto";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on mismatched lengths rather than returning
  // false, and comparing against a length-mismatched buffer would itself
  // leak length info via the exception path — so pad the shorter side
  // before comparing rather than short-circuiting on a length check.
  const len = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.alloc(len);
  const paddedB = Buffer.alloc(len);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

/** For the three /api/cron/* route handlers: checks the `Authorization`
 * header against `Bearer ${CRON_SECRET}`. Returns false (never throws) if
 * CRON_SECRET isn't configured or the header is missing/wrong. */
export function isValidCronAuthHeader(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  return timingSafeEqualStrings(authHeader, `Bearer ${secret}`);
}

/** For autoSettleScaleConsignmentForCron, which receives the raw secret as
 * a function argument rather than a header. */
export function isValidCronSecret(providedSecret: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !providedSecret) return false;
  return timingSafeEqualStrings(providedSecret, secret);
}