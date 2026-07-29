"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type SubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

// Called right after the browser's pushManager.subscribe() resolves.
// Keyed on endpoint (unique per browser subscription) so re-subscribing
// on the same device — e.g. after a permission reset — updates the row
// instead of creating a duplicate, and correctly reassigns it if a
// different user later logs in on that same browser.
export async function saveSubscription(subscription: SubscriptionJSON, userAgent?: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("Invalid push subscription");
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId: session.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
    create: {
      userId: session.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
  });

  return { success: true };
}

// Called when the user disables notifications, or when the service
// worker reports the browser expired the subscription on its own.
export async function removeSubscription(endpoint: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.id },
  });

  return { success: true };
}

export async function isSubscribedOnServer(endpoint: string) {
  const session = await getSessionUser();
  if (!session) return false;

  const existing = await prisma.pushSubscription.findFirst({
    where: { endpoint, userId: session.id },
    select: { id: true },
  });
  return !!existing;
}