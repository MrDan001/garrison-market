// FILE: apps/frontend/app/api/cron/rush-streak-reset/route.ts (NEW FILE)

import { NextResponse } from "next/server";
import { runNightlyRushStreakReset } from "@/lib/rush-streak-reset";
import { isValidCronAuthHeader } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Same auth pattern as /api/cron/scale-consignment-reset — Vercel Cron
// sends "Authorization: Bearer $CRON_SECRET" automatically on scheduled
// invocations, so this stays locked to Vercel's own scheduler.
export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNightlyRushStreakReset();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Nightly Rush streak reset failed:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}