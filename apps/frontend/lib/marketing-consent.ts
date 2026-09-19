import prisma from "@/lib/prisma";
import {
  addBrevoContact,
  getOrCreateBrevoMarketingList,
  isBrevoConfigured,
} from "@/lib/brevo";

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

  if (!user || !user.marketingConsent || user.marketingBrevoSyncedAt) {
    return { synced: false, skipped: true };
  }

  if (!isBrevoConfigured()) {
    return { synced: false, skipped: true, reason: "brevo_not_configured" };
  }

  const listId = await getOrCreateBrevoMarketingList();

  await addBrevoContact(user.email, user.fullName || undefined, listId);

  await prisma.user.update({
    where: { id: user.id },
    data: { marketingBrevoSyncedAt: new Date() },
  });

  return { synced: true, skipped: false, listId };
}

export async function syncPendingMarketingConsents(limit = 50) {
  if (!isBrevoConfigured()) {
    return {
      configured: false,
      attempted: 0,
      synced: 0,
      failed: 0,
    };
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
      console.error("[marketing-consent] Brevo sync failed", {
        userId: user.id,
        error,
      });
    }
  }

  return {
    configured: true,
    attempted: pending.length,
    synced,
    failed,
  };
}
