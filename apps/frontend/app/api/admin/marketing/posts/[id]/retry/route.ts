import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireMarketingAdmin();
    const { id } = await context.params;

    const row = await marketingQueryOne<{ attempts: number }>(
      "select coalesce(max(attempt_number),0) as attempts from marketing.publishing_logs where post_id = $1",
      [id],
    );

    if (!row) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    if (Number(row.attempts) >= 3) {
      return NextResponse.json(
        { error: "Retry limit reached. Create a new scheduled post instead." },
        { status: 409 },
      );
    }

    const updated = await marketingQueryOne(
      "update marketing.posts set status='queued', failure_code=null, failure_message=null, updated_at=now() " +
        "where id=$1 and status='failed' returning id, status, updated_at",
      [id],
    );

    if (!updated) return NextResponse.json({ error: "Post is not in a retryable state." }, { status: 409 });

    return NextResponse.json({ ok: true, post: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/posts retry]", error);
    return NextResponse.json({ error: "Unable to retry post." }, { status: 500 });
  }
}
