// FILE: apps/frontend/app/api/cron/scale-consignment-reset/route.ts (NEW FILE)

import { NextResponse } from "next/server";
import { runMidnightScaleConsignmentReset } from "@/lib/scale-consignment-reset";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json — scheduled for 23:00 UTC /
// 00:00 WAT). Vercel automatically sends "Authorization: Bearer
// $CRON_SECRET" on scheduled invocations, so this route stays locked to
// Vercel's own scheduler and can't be hit by anyone who finds the URL.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMidnightScaleConsignmentReset();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Midnight scale consignment reset failed:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}