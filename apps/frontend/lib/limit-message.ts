// Deliberately has ZERO imports from lib/prisma or any other server-only
// module. subscription-guard.ts (server) and UpgradeLimitModal.tsx (client)
// both import from here — keeping it dependency-free is what stops Prisma/pg
// (and its Node-only "dns" import) from being pulled into the browser bundle.

/**
 * Marker prefix on LimitCheckResult.reason so the frontend can tell "plan
 * limit reached" apart from other, unrelated error strings and render the
 * dedicated upgrade modal instead of a plain inline error banner. Frontend
 * call sites should check `reason.startsWith(LIMIT_REACHED_PREFIX)` and
 * strip it before display.
 */
export const LIMIT_REACHED_PREFIX = "LIMIT_REACHED::";

/**
 * The single, shared "you've hit your plan limit" message shown across
 * stores/staff/products. Kept in one place so the wording never drifts
 * between the three call sites.
 */
export function formatLimitReachedMessage(fullName: string | null | undefined): string {
  const name = fullName?.trim() || "there";
  return `*Subject:* Action Required: Upgrade to Continue

Dear ${name},
You've reached your subscription limit.
To continue enjoying uninterrupted access to this service, please upgrade to our *Premium Plan*.

Thank you,
The Garrison Market Team`;
}