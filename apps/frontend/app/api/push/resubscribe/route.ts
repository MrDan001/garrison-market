// FILE: apps/frontend/app/api/push/resubscribe/route.ts
//
// The one piece that was missing: browsers (Chrome/FCM in particular) can
// rotate or expire a push subscription on their own, without any action
// from the user or the app. When that happens they fire
// 'pushsubscriptionchange' at the service worker (see public/sw.js) — but
// only if something is listening. Nothing was, so the old subscription
// just went stale, the next push got a 404/410 from the push service,
// sendPushToUser (lib/push.ts) correctly deleted the dead row... and
// nothing ever created a new one. That's the "worked for two days, then
// just stopped" bug: it wasn't broken, it was silently orphaned.
//
// This is a plain Route Handler rather than a server action because a
// service worker's fetch() can't invoke a Next.js server action (those
// rely on an encoded action id from the page bundle, which the SW never
// has). Session auth still works the normal way — fetch() from a service
// worker sends same-origin cookies by default, so the httpOnly
// session-token cookie is included automatically.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { oldEndpoint, subscription, userAgent } = await req.json().catch(() => ({}));

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // The old row is very likely already gone (deleted the moment a push to
  // it 404/410'd), but if the browser fired pushsubscriptionchange for a
  // subscription that just hasn't failed a send yet, clear it out too.
  if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: oldEndpoint } });
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

  return NextResponse.json({ success: true });
}