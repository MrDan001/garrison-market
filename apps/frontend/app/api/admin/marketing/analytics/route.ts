import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireMarketingAdmin();

    const statusCounts = await marketingQuery(
      "select status, count(*)::int as count from marketing.posts group by status order by status",
    );

    const daily = await marketingQuery(
      "select metric_date, platform, sum(impressions)::bigint as impressions, sum(reach)::bigint as reach, " +
        "sum(likes)::bigint as likes, sum(comments)::bigint as comments, sum(shares)::bigint as shares, " +
        "sum(saves)::bigint as saves, sum(clicks)::bigint as clicks, sum(video_views)::bigint as video_views " +
        "from marketing.analytics_snapshots " +
        "where metric_date >= current_date - 14 group by metric_date, platform order by metric_date desc, platform",
    );

    const totals = await marketingQueryOne(
      "select coalesce(sum(impressions),0)::bigint as impressions, coalesce(sum(reach),0)::bigint as reach, " +
        "coalesce(sum(likes),0)::bigint as likes, coalesce(sum(comments),0)::bigint as comments, " +
        "coalesce(sum(shares),0)::bigint as shares, coalesce(sum(saves),0)::bigint as saves, " +
        "coalesce(sum(clicks),0)::bigint as clicks, coalesce(sum(video_views),0)::bigint as video_views " +
        "from marketing.analytics_snapshots where metric_date >= current_date - 14",
    );

    return NextResponse.json({ ok: true, statusCounts, totals, daily });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/analytics]", error);
    return NextResponse.json({ error: "Unable to load marketing analytics." }, { status: 500 });
  }
}
