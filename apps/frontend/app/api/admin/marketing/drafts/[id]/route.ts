import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMarketingAdmin();
    const { id } = await context.params;

    if (!id) return NextResponse.json({ error: "Draft id is required." }, { status: 400 });

    const payload = await request.json().catch(() => ({}));
    const action = payload?.action === "archive" ? "archive" : "approve";

    const status = action === "archive" ? "archived" : "approved";

    const row = await marketingQueryOne(
      "update marketing.content_drafts set status = $1, updated_at = now() " +
        "where id = $2 and status <> 'archived' returning id, title, platform, content_type, body, " +
        "hashtags, call_to_action, feature_focus, status, updated_at",
      [status, id],
    );

    if (!row) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

    return NextResponse.json({ ok: true, draft: row, changedBy: session.id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/drafts/:id]", error);
    return NextResponse.json({ error: "Unable to update draft." }, { status: 500 });
  }
}
