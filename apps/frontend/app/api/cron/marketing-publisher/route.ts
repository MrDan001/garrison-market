import { NextResponse } from "next/server";
import { isValidCronAuthHeader } from "@/lib/cron-auth";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";
import { publishMarketingPost } from "@/lib/marketing/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duePosts = await marketingQuery<{
    id: string;
    connection_id: string;
    caption: string | null;
    media_urls: string[];
  }>(
    "select id, connection_id, caption, media_urls from marketing.posts " +
      "where status = 'queued' or (status = 'scheduled' and scheduled_for <= now()) " +
      "order by coalesce(scheduled_for, created_at) asc limit 10",
  );

  const results = [];

  for (const post of duePosts) {
    const claimed = await marketingQueryOne<{
      id: string;
      connection_id: string;
      caption: string | null;
      media_urls: string[];
    }>(
      "update marketing.posts set status = 'publishing', updated_at = now() " +
        "where id = $1 and status in ('queued','scheduled') " +
        "returning id, connection_id, caption, media_urls",
      [post.id],
    );

    if (!claimed) continue;

    const connection = await marketingQueryOne<{
      id: string;
      provider: "facebook" | "instagram";
      provider_account_id: string;
      page_id: string | null;
      instagram_business_account_id: string | null;
      access_token_ciphertext: string | null;
    }>(
      "select id, provider, provider_account_id, page_id, instagram_business_account_id, access_token_ciphertext, status " +
        "from marketing.social_connections where id = $1 limit 1",
      [claimed.connection_id],
    );

    const attempt = await marketingQueryOne<{ attempt: number }>(
      "select coalesce(max(attempt_number),0)+1 as attempt from marketing.publishing_logs where post_id = $1",
      [claimed.id],
    );
    const attemptNumber = Number(attempt?.attempt ?? 1);

    await marketingQueryOne(
      "insert into marketing.publishing_logs " +
        "(post_id, connection_id, attempt_number, action, status) values ($1,$2,$3,'publish','started') returning id",
      [claimed.id, claimed.connection_id, attemptNumber],
    );

    try {
      if (!connection) throw new Error("Social connection not found.");
      if (connection.status === "expired") throw new Error("Social connection has expired.");
      if (!claimed.caption?.trim()) throw new Error("Post caption is empty.");

      const published = await publishMarketingPost({
        connection,
        caption: claimed.caption,
        mediaUrls: claimed.media_urls ?? [],
      });

      await marketingQueryOne(
        "update marketing.posts set status='published', external_post_id=$1, published_at=now(), " +
          "updated_at=now(), failure_code=null, failure_message=null, metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb " +
          "where id=$3 returning id",
        [
          published.externalPostId,
          JSON.stringify(published.metadata ?? {}),
          claimed.id,
        ],
      );

      await marketingQueryOne(
        "update marketing.publishing_logs set status='success', external_post_id=$1 " +
          "where post_id=$2 and attempt_number=$3 returning id",
        [published.externalPostId, claimed.id, attemptNumber],
      );

      results.push({ id: claimed.id, status: "published", externalPostId: published.externalPostId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publishing error.";
      const failureCode = message.includes("Meta publish error") ? "META_API_ERROR" : "PUBLISH_FAILED";

      await marketingQueryOne(
        "update marketing.posts set status='failed', failure_code=$1, failure_message=$2, updated_at=now() " +
          "where id=$3 returning id",
        [failureCode, message.slice(0, 1000), claimed.id],
      );

      await marketingQueryOne(
        "update marketing.publishing_logs set status='failed', error_code=$1, error_message=$2 " +
          "where post_id=$3 and attempt_number=$4 returning id",
        [failureCode, message.slice(0, 1000), claimed.id, attemptNumber],
      );

      results.push({ id: claimed.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
