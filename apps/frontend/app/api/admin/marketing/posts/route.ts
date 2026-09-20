import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQuery } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireMarketingAdmin();
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "50"), 1), 100);

    const posts = await marketingQuery(
      "select p.id, p.platform, p.caption, p.media_urls, p.status, p.scheduled_for, p.published_at, " +
        "p.external_post_id, p.failure_code, p.failure_message, p.metadata, p.created_at, " +
        "d.title as draft_title, c.account_name as account_name " +
        "from marketing.posts p " +
        "left join marketing.content_drafts d on d.id = p.draft_id " +
        "left join marketing.social_connections c on c.id = p.connection_id " +
        "order by coalesce(p.scheduled_for, p.created_at) desc limit $1",
      [limit],
    );

    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/posts GET]", error);
    return NextResponse.json({ error: "Unable to load marketing posts." }, { status: 500 });
  }
}
