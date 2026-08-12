// FILE: apps/frontend/lib/affiliate-constants.ts
//
// Split out of affiliate.actions.ts — a "use server" file may only export
// async functions, so this plain constant (needed by both
// affiliate.actions.ts and app/ref/[code]/route.ts) lives here instead.

export const AFFILIATE_COOKIE_NAME = "gm_aff_ref";
export const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — the link-expiry rule