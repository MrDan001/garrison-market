import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { runDueMarketingPosts } from "@/lib/marketing/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    await requireMarketingAdmin();
    return NextResponse.json(await runDueMarketingPosts());
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[marketing/admin/publisher/run]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Marketing publisher failed." },
      { status: 500 },
    );
  }
}
