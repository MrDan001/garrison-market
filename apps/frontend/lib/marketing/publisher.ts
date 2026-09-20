import { decryptMarketingToken } from "@/lib/marketing/token-crypto";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";

const GRAPH_HOST = "https://graph.facebook.com";
const DEFAULT_GRAPH_VERSION = "v26.0";

type Connection = {
  id: string;
  provider: "facebook" | "instagram";
  provider_account_id: string;
  page_id: string | null;
  instagram_business_account_id: string | null;
  access_token_ciphertext: string | null;
};

type PublishResult = {
  externalPostId: string;
  metadata?: Record<string, unknown>;
};

function graphVersion() {
  return process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
}

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(GRAPH_HOST + "/" + graphVersion() + "/" + path.replace(/^\//, ""));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function graphRequest<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json()) as T & {
    error?: { message?: string; code?: number; error_subcode?: number; type?: string };
  };

  if (!response.ok || payload.error) {
    const err = payload.error;
    const detail = [
      err?.message,
      err?.code != null ? "code=" + err.code : "",
      err?.error_subcode != null ? "subcode=" + err.error_subcode : "",
    ].filter(Boolean).join(" | ");
    throw new Error("Meta publish error: " + (detail || "HTTP " + response.status));
  }

  return payload as T;
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v)(?:\?.*)?$/i.test(url);
}

async function publishFacebook(connection: Connection, caption: string, mediaUrls: string[]) {
  if (!connection.page_id) throw new Error("Facebook connection is missing its Page ID.");
  if (!connection.access_token_ciphertext) throw new Error("Facebook connection has no access token.");

  const token = decryptMarketingToken(connection.access_token_ciphertext);

  if (mediaUrls.length > 0) {
    const photo = await graphRequest<{ id: string }>(
      connection.page_id + "/photos",
      {
        url: mediaUrls[0],
        caption,
        access_token: token,
      },
    );
    return { externalPostId: photo.id, metadata: { mediaType: "image" } };
  }

  const post = await graphRequest<{ id: string }>(
    connection.page_id + "/feed",
    {
      message: caption,
      access_token: token,
    },
  );

  return { externalPostId: post.id, metadata: { mediaType: "text" } };
}

async function waitForInstagramContainer(containerId: string, token: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await graphRequest<{
      status_code?: string;
      status?: string;
      id: string;
    }>(
      containerId,
      { fields: "status_code,status", access_token: token },
      "GET",
    );

    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error("Instagram media processing failed: " + (status.status || "unknown error"));
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("Instagram media processing timed out.");
}

async function publishInstagram(connection: Connection, caption: string, mediaUrls: string[]) {
  const igUserId = connection.instagram_business_account_id || connection.provider_account_id;
  if (!igUserId) throw new Error("Instagram connection is missing its business account ID.");
  if (!connection.access_token_ciphertext) throw new Error("Instagram connection has no access token.");
  if (!mediaUrls[0]) throw new Error("Instagram publishing requires at least one public media URL.");

  const token = decryptMarketingToken(connection.access_token_ciphertext);
  const firstMediaUrl = mediaUrls[0];

  const container = isVideoUrl(firstMediaUrl)
    ? await graphRequest<{ id: string }>(igUserId + "/media", {
        media_type: "REELS",
        video_url: firstMediaUrl,
        caption,
        share_to_feed: "true",
        access_token: token,
      })
    : await graphRequest<{ id: string }>(igUserId + "/media", {
        image_url: firstMediaUrl,
        caption,
        access_token: token,
      });

  if (!container.id) throw new Error("Instagram did not return a media container ID.");

  if (isVideoUrl(firstMediaUrl)) {
    await waitForInstagramContainer(container.id, token);
  }

  const published = await graphRequest<{ id: string }>(
    igUserId + "/media_publish",
    {
      creation_id: container.id,
      access_token: token,
    },
  );

  return {
    externalPostId: published.id,
    metadata: {
      mediaType: isVideoUrl(firstMediaUrl) ? "reel" : "image",
      containerId: container.id,
    },
  };
}

export async function publishMarketingPost(input: {
  connection: Connection;
  caption: string;
  mediaUrls: string[];
}): Promise<PublishResult> {
  if (input.connection.provider === "facebook") {
    return publishFacebook(input.connection, input.caption, input.mediaUrls);
  }
  return publishInstagram(input.connection, input.caption, input.mediaUrls);
}


export async function runDueMarketingPosts() {
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

  const results: Array<Record<string, unknown>> = [];

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
      status: string;
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

  return { ok: true, processed: results.length, results };
}
