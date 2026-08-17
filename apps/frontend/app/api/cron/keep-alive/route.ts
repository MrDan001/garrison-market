// FILE: apps/frontend/app/api/cron/keep-alive/route.ts (NEW FILE)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidCronAuthHeader } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json). Vercel automatically sends
// "Authorization: Bearer $CRON_SECRET" on scheduled invocations, so this
// route stays locked to Vercel's own scheduler and can't be hit by anyone
// who finds the URL — same pattern as scale-consignment-reset.
//
// Purpose: run a trivial real query against Supabase so the project never
// crosses the 7-day-inactivity threshold that triggers an auto-pause.
export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ success: true, pingedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("Supabase keep-alive ping failed:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}