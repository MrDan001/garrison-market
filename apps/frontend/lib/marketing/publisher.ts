import { decryptMarketingToken } from "@/lib/marketing/token-crypto";

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
