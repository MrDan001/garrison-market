import { NextResponse } from "next/server";
import { isValidCronAuthHeader } from "@/lib/cron-auth";
import { syncMarketingAnalytics } from "@/lib/marketing/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncMarketingAnalytics();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[marketing/analytics sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics sync failed." },
      { status: 500 },
    );
  }
}
