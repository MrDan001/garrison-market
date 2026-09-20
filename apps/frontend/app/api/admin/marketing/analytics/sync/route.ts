import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { syncMarketingAnalytics } from "@/lib/marketing/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    await requireMarketingAdmin();
    const result = await syncMarketingAnalytics();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[marketing/admin/analytics/sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics sync failed." },
      { status: 500 },
    );
  }
}
