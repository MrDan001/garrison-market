import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQuery } from "@/lib/marketing/db";
import { generateMarketingContent } from "@/lib/marketing/ai";
import {
  getMarketingFeature,
  GARRISON_MARKET_MARKETING_FEATURES,
} from "@/lib/marketing/feature-catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizePlatform(value: unknown) {
  return value === "facebook" || value === "instagram" || value === "both" ? value : "both";
}

function safeText(value: unknown, fallback: string, max = 1000) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

export async function POST(request: Request) {
  try {
    const session = await requireMarketingAdmin();
    const payload = await request.json();

    const platform = normalizePlatform(payload?.platform);
    const goal = safeText(payload?.goal, "Increase awareness, engagement, and qualified visits from business owners.", 500);
    const audience = safeText(payload?.audience, "Small and growing business owners in Nigeria.", 500);
    const requestedFeature = typeof payload?.featureFocus === "string" ? payload.featureFocus.trim() : "";

    if (requestedFeature && !getMarketingFeature(requestedFeature)) {
      return NextResponse.json(
        {
          error: "Unknown Garrison Market marketing feature.",
          availableFeatures: GARRISON_MARKET_MARKETING_FEATURES.map((feature) => ({
            id: feature.id,
            name: feature.name,
          })),
        },
        { status: 400 },
      );
    }

    const recentDrafts = await marketingQuery<{ platform: string; body: string; created_at: string }>(
      "select platform, body, created_at from marketing.content_drafts " +
        "where created_at >= now() - interval '45 days' order by created_at desc limit 20",
    );

    const recentPosts = await marketingQuery<{ platform: string; caption: string | null; created_at: string }>(
      "select platform, caption, created_at from marketing.posts " +
        "where created_at >= now() - interval '45 days' and caption is not null " +
        "order by created_at desc limit 20",
    );

    const recentContent = [
      ...recentDrafts.map((item) => "[" + item.platform + "] " + item.body),
      ...recentPosts.map((item) => "[" + item.platform + "] " + (item.caption || "")),
    ].slice(0, 30);

    const performanceRows = await marketingQuery<{
      platform: string;
      impressions: string;
      reach: string;
      likes: string;
      comments: string;
      shares: string;
      saves: string;
      clicks: string;
      video_views: string;
    }>(
      "select platform, sum(impressions)::text as impressions, sum(reach)::text as reach, " +
        "sum(likes)::text as likes, sum(comments)::text as comments, sum(shares)::text as shares, " +
        "sum(saves)::text as saves, sum(clicks)::text as clicks, sum(video_views)::text as video_views " +
        "from marketing.analytics_snapshots where metric_date >= current_date - 14 group by platform",
    );

    const performanceSignals = performanceRows.map(
      (row) =>
        row.platform +
        ": views/impressions=" +
        row.impressions +
        ", reach=" +
        row.reach +
        ", likes=" +
        row.likes +
        ", comments=" +
        row.comments +
        ", shares=" +
        row.shares +
        ", saves=" +
        row.saves +
        ", clicks=" +
        row.clicks +
        ", video views=" +
        row.video_views,
    );

    const generation = await generateMarketingContent({
      platform,
      goal,
      audience,
      featureFocus: requestedFeature || undefined,
      recentContent,
      performanceSignals,
    });

    const selectedFeature = getMarketingFeature(generation.featureFocus);

    if (!selectedFeature) {
      return NextResponse.json({ error: "The marketing brain selected an unverified feature." }, { status: 502 });
    }

    const targets =
      platform === "both"
        ? [["facebook", generation.facebook], ["instagram", generation.instagram]]
        : [[platform, platform === "facebook" ? generation.facebook : generation.instagram]];

    const created: any[] = [];

    for (const pair of targets) {
      const targetPlatform = pair[0] as "facebook" | "instagram";
      const content = pair[1] as typeof generation.facebook;

      const rows = await marketingQuery(
        "insert into marketing.content_drafts (" +
          "title, platform, content_type, body, hashtags, call_to_action, feature_focus, " +
          "generation_prompt, generation_metadata, status, created_by_user_id" +
          ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'draft',$10) returning " +
          "id, title, platform, content_type, body, hashtags, call_to_action, feature_focus, status, created_at",
        [
          content.title,
          targetPlatform,
          generation.contentType || "post",
          content.body,
          content.hashtags,
          content.callToAction || null,
          selectedFeature.id,
          JSON.stringify({
            strategy: generation.strategy,
            visualIdea: generation.visualIdea,
            model: generation.model,
            provider: generation.provider,
            requestedPlatform: platform,
            goal,
            audience,
            recentContentCount: recentContent.length,
            performanceSignalCount: performanceSignals.length,
          }),
          session.id,
        ],
      );

      created.push(rows[0]);
    }

    return NextResponse.json({
      ok: true,
      feature: selectedFeature,
      strategy: generation.strategy,
      visualIdea: generation.visualIdea,
      drafts: created,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[marketing/generate]", error);
    const message = error instanceof Error ? error.message : "Unable to generate marketing content.";

    if (
      message === "GEMINI_API_KEY is not configured." ||
      message.startsWith("GEMINI_API_KEY is not configured.") ||
      message.includes("marketing brain")
    ) {
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ error: "Unable to generate marketing content." }, { status: 500 });
  }
}
