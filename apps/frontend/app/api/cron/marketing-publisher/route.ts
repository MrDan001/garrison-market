import { NextResponse } from "next/server";
import { isValidCronAuthHeader } from "@/lib/cron-auth";
import { runDueMarketingPosts } from "@/lib/marketing/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runDueMarketingPosts());
  } catch (error) {
    console.error("[marketing/publisher]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Marketing publisher failed." },
      { status: 500 },
    );
  }
}
