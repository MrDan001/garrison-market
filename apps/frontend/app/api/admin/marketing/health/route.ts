import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireMarketingAdmin();

    const result = await marketingQueryOne<{
      social_connections: string;
      drafts: string;
      scheduled_posts: string;
      active_campaigns: string;
      enabled_automations: string;
    }>(`
      select
        (select count(*) from marketing.social_connections) as social_connections,
        (select count(*) from marketing.content_drafts where status <> 'archived') as drafts,
        (select count(*) from marketing.posts where status in ('queued','scheduled')) as scheduled_posts,
        (select count(*) from marketing.campaigns where status = 'active') as active_campaigns,
        (select count(*) from marketing.automations where enabled = true) as enabled_automations
    `);

    return NextResponse.json({
      ok: true,
      subsystem: "marketing",
      status: "foundation-ready",
      counts: {
        socialConnections: Number(result?.social_connections ?? 0),
        drafts: Number(result?.drafts ?? 0),
        scheduledPosts: Number(result?.scheduled_posts ?? 0),
        activeCampaigns: Number(result?.active_campaigns ?? 0),
        enabledAutomations: Number(result?.enabled_automations ?? 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[marketing/health]", error);
    return NextResponse.json({ error: "Marketing subsystem unavailable." }, { status: 500 });
  }
}
