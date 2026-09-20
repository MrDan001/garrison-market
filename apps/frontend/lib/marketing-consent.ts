import prisma from "@/lib/prisma";

/**
 * Compatibility bridge for the existing registration flow.
 *
 * The previous marketing provider integration has been retired so the
 * marketing/social layer can be rebuilt cleanly. Registration itself must
 * remain untouched, so these functions intentionally perform no external
 * marketing sync and never modify user records.
 */
export async function syncMarketingConsentForUser(userId: number) {
  // Keep the parameter in the public contract for the existing caller.
  void userId;
  return { synced: false, skipped: true, reason: "marketing_layer_reset" as const };
}

export async function syncPendingMarketingConsents(limit = 100) {
  void limit;
  return {
    configured: false,
    attempted: 0,
    synced: 0,
    failed: 0,
    reason: "marketing_layer_reset" as const,
  };
}
