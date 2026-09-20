import prisma from "@/lib/prisma";
import {
  getMarketingSegmentId,
  isResendMarketingConfigured,
  syncResendMarketingContact,
} from "@/lib/resend-marketing";

// The existing database field is retained for backward-compatible data.
// Its value now means "marketing contact synchronized with Resend".
export async function syncMarketingConsentForUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      marketingConsent: true,
      marketingBrevoSyncedAt: true,
    },
  });

  if (!user || !isResendMarketingConfigured() || !getMarketingSegmentId()) {
    return { synced: false, skipped: true, reason: "resend_not_configured" };
  }

  try {
    await syncResendMarketingContact(
      user.email,
      user.fullName || undefined,
      getMarketingSegmentId() || undefined,
      Boolean(user.marketingConsent),
    );

    if (user.marketingConsent && !user.marketingBrevoSyncedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { marketingBrevoSyncedAt: new Date() },
      });
    }

    return {
      synced: true,
      skipped: false,
      subscribed: Boolean(user.marketingConsent),
    };
  } catch (error) {
    console.error("[marketing-consent] Resend sync failed", { userId, error });
    throw error;
  }
}

export async function syncPendingMarketingConsents(limit = 100) {
  if (!isResendMarketingConfigured() || !getMarketingSegmentId()) {
    return { configured: false, attempted: 0, synced: 0, failed: 0 };
  }

  const pending = await prisma.user.findMany({
    where: {
      marketingConsent: true,
      marketingBrevoSyncedAt: null,
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  let synced = 0;
  let failed = 0;

  for (const user of pending) {
    try {
      const result = await syncMarketingConsentForUser(user.id);
      if (result.synced) synced += 1;
    } catch (error) {
      failed += 1;
      console.error("[marketing-consent] pending Resend sync failed", { userId: user.id, error });
    }
  }

  return {
    configured: true,
    attempted: pending.length,
    synced,
    failed,
  };
}
