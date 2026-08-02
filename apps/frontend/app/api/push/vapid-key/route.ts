// FILE: apps/frontend/app/api/push/vapid-key/route.ts
//
// Plain fetch()-able endpoint for the service worker's pushsubscriptionchange
// handler (public/sw.js) — server actions aren't reachable from a service
// worker's fetch(), which is why this duplicates what getVapidPublicKey()
// in lib/push.actions.ts already exposes to normal client components.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null });
}