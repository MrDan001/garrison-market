import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";
import { decryptMarketingToken } from "@/lib/marketing/token-crypto";

const GRAPH_HOST = "https://graph.facebook.com";
const DEFAULT_GRAPH_VERSION = "v24.0";

type Connection = {
  id: string;
  provider: "facebook" | "instagram";
  page_id: string | null;
  instagram_business_account_id: string | null;
  access_token_ciphertext: string | null;
};

function graphVersion() {
  return process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
}

async function graphGet<T>(path: string, params: Record<string, string>) {
  const url = new URL(GRAPH_HOST + "/" + graphVersion() + "/" + path.replace(/^\//, ""));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const payload = await response.json() as T & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };

  if (!response.ok || payload.error) {
    const error = payload.error;
    throw new Error(
      [
        error?.message,
        error?.code != null ? "code=" + error.code : null,
        error?.error_subcode != null ? "subcode=" + error.error_subcode : null,
      ].filter(Boolean).join(" | ") || "Meta insights request failed.",
    );
  }

  return payload as T;
}

function numericMetric(data: any[], names: string[]) {
  const item = data.find((entry) => names.includes(entry?.name));
  if (!item) return 0;

  if (typeof item?.total_value?.value === "number") return item.total_value.value;
  if (Array.isArray(item?.values)) {
    const value = item.values.at(-1)?.value;
    return typeof value === "number" ? value : 0;
  }
  if (typeof item?.value === "number") return item.value;
  return 0;
}

export async function syncMarketingAnalytics() {
  const connections = await marketingQuery<Connection>(
    "select id, provider, page_id, instagram_business_account_id, access_token_ciphertext " +
      "from marketing.social_connections where status='active' and access_token_ciphertext is not null",
  );

  const metricDate = new Date().toISOString().slice(0, 10);
  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const until = Math.floor(Date.now() / 1000);

  const results = [];

  for (const connection of connections) {
    try {
      const token = decryptMarketingToken(connection.access_token_ciphertext!);

      if (connection.provider === "facebook") {
        if (!connection.page_id) throw new Error("Facebook Page ID is missing.");

        const pageInsights = await graphGet<{ data: any[] }>(
          connection.page_id + "/insights",
          {
            metric: "page_media_view,page_total_media_view_unique,page_views_total,page_video_views,page_post_engagements",
            period: "day",
            since: String(since),
            until: String(until),
            access_token: token,
          },
        );

        await marketingQueryOne(
          "insert into marketing.analytics_snapshots (" +
            "connection_id, platform, metric_date, impressions, reach, video_views, raw_metrics" +
            ") values ($1,'facebook',$2,$3,$4,$5,$6::jsonb) " +
            "on conflict do nothing returning id",
          [
            connection.id,
            metricDate,
            numericMetric(pageInsights.data, ["page_media_view", "page_views_total"]),
            numericMetric(pageInsights.data, ["page_total_media_view_unique"]),
            numericMetric(pageInsights.data, ["page_video_views"]),
            JSON.stringify(
              Object.fromEntries(
                (pageInsights.data || []).map((item: any) => [item.name, item.values ?? item.total_value ?? item.value]),
              ),
            ),
          ],
        );

        results.push({ connectionId: connection.id, provider: "facebook", status: "synced" });
      } else {
        const igUserId = connection.instagram_business_account_id;
        if (!igUserId) throw new Error("Instagram Business Account ID is missing.");

        const instagramInsights = await graphGet<{ data: any[] }>(
          igUserId + "/insights",
          {
            metric: "views,reach,likes,comments,shares,saves,total_interactions",
            period: "day",
            metric_type: "total_value",
            since: String(since),
            until: String(until),
            access_token: token,
          },
        );

        await marketingQueryOne(
          "insert into marketing.analytics_snapshots (" +
            "connection_id, platform, metric_date, impressions, reach, likes, comments, shares, saves, raw_metrics" +
            ") values ($1,'instagram',$2,$3,$4,$5,$6,$7,$8,$9::jsonb) " +
            "on conflict do nothing returning id",
          [
            connection.id,
            metricDate,
            numericMetric(instagramInsights.data, ["views"]),
            numericMetric(instagramInsights.data, ["reach"]),
            numericMetric(instagramInsights.data, ["likes"]),
            numericMetric(instagramInsights.data, ["comments"]),
            numericMetric(instagramInsights.data, ["shares"]),
            numericMetric(instagramInsights.data, ["saves"]),
            JSON.stringify(
              Object.fromEntries(
                (instagramInsights.data || []).map((item: any) => [item.name, item.total_value ?? item.values ?? item.value]),
              ),
            ),
          ],
        );

        results.push({ connectionId: connection.id, provider: "instagram", status: "synced" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analytics sync failed.";

      await marketingQueryOne(
        "update marketing.social_connections set status = case when $1 ilike '%OAuth%' then 'expired' else status end, " +
          "metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('lastAnalyticsError',$1::text,'lastAnalyticsSyncAttempt',now()) " +
          "where id=$2 returning id",
        [message.slice(0, 500), connection.id],
      );

      results.push({
        connectionId: connection.id,
        provider: connection.provider,
        status: "failed",
        error: message,
      });
    }
  }

  return { metricDate, processed: results.length, results };
}
