import { NextResponse } from "next/server";
import { isValidCronAuthHeader } from "@/lib/cron-auth";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";
import { generateMarketingContent } from "@/lib/marketing/ai";
import { getMarketingFeature } from "@/lib/marketing/feature-catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const automations = await marketingQuery<{
    id: string;
    name: string;
    config: Record<string, any>;
  }>(
    "select id, name, config from marketing.automations " +
      "where enabled=true and next_run_at is not null and next_run_at <= now() " +
      "order by next_run_at asc limit 5",
  );

  const results = [];

  for (const automation of automations) {
    const config = automation.config || {};
    const platform =
      config.platform === "facebook" || config.platform === "instagram" || config.platform === "both"
        ? config.platform
        : "both";

    const goal =
      typeof config.goal === "string" && config.goal.trim()
        ? config.goal.trim()
        : "Create useful content that increases interest in Garrison Market among business owners.";

    const audience =
      typeof config.audience === "string" && config.audience.trim()
        ? config.audience.trim()
        : "Small and growing business owners in Nigeria.";

    const featureFocus =
      typeof config.featureFocus === "string" && getMarketingFeature(config.featureFocus)
        ? config.featureFocus
        : undefined;

    try {
      const recent = await marketingQuery<{ platform: string; body: string }>(
        "select platform, body from marketing.content_drafts " +
          "where created_at >= now() - interval '60 days' order by created_at desc limit 25",
      );

      const performance = await marketingQuery<{
        platform: string;
        impressions: string;
        reach: string;
        likes: string;
        comments: string;
        shares: string;
        saves: string;
        clicks: string;
      }>(
        "select platform, sum(impressions)::text as impressions, sum(reach)::text as reach, " +
          "sum(likes)::text as likes, sum(comments)::text as comments, sum(shares)::text as shares, " +
          "sum(saves)::text as saves, sum(clicks)::text as clicks " +
          "from marketing.analytics_snapshots where metric_date >= current_date - 14 group by platform",
      );

      const generated = await generateMarketingContent({
        platform,
        goal,
        audience,
        featureFocus,
        recentContent: recent.map((item) => "[" + item.platform + "] " + item.body),
        performanceSignals: performance.map(
          (item) =>
            item.platform +
            ": impressions=" + item.impressions +
            ", reach=" + item.reach +
            ", likes=" + item.likes +
            ", comments=" + item.comments +
            ", shares=" + item.shares +
            ", saves=" + item.saves +
            ", clicks=" + item.clicks,
        ),
      });

      const feature = getMarketingFeature(generated.featureFocus);
      if (!feature) throw new Error("Automation selected an unverified marketing feature.");

      const targets =
        platform === "both"
          ? [["facebook", generated.facebook], ["instagram", generated.instagram]]
          : [[platform, platform === "facebook" ? generated.facebook : generated.instagram]];

      let createdCount = 0;

      for (const pair of targets) {
        const targetPlatform = pair[0] as "facebook" | "instagram";
        const content = pair[1] as typeof generated.facebook;

        await marketingQueryOne(
          "insert into marketing.content_drafts (" +
            "title, platform, content_type, body, hashtags, call_to_action, feature_focus, " +
            "generation_prompt, generation_metadata, status, created_by_user_id" +
            ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'draft',$10) returning id",
          [
            content.title,
            targetPlatform,
            generated.contentType || "post",
            content.body,
            content.hashtags,
            content.callToAction || null,
            feature.id,
            "Scheduled automation: " + automation.name,
            JSON.stringify({
              strategy: generated.strategy,
              visualIdea: generated.visualIdea,
              model: generated.model,
              automationId: automation.id,
            }),
            null,
          ],
        );
        createdCount++;
      }

      const intervalHours = Math.max(1, Math.min(Number(config.intervalHours || 24), 168));
      const nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString();

      await marketingQueryOne(
        "update marketing.automations set last_run_at=now(), next_run_at=$1, updated_at=now() " +
          "where id=$2 returning id",
        [nextRunAt, automation.id],
      );

      results.push({ id: automation.id, status: "generated", drafts: createdCount, nextRunAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Automation failed.";
      const nextRunAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      await marketingQueryOne(
        "update marketing.automations set last_run_at=now(), next_run_at=$1, updated_at=now(), " +
          "config = coalesce(config,'{}'::jsonb) || jsonb_build_object('lastError', $2::text) where id=$3 returning id",
        [nextRunAt, message.slice(0, 500), automation.id],
      );

      results.push({ id: automation.id, status: "failed", error: message, nextRunAt });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
