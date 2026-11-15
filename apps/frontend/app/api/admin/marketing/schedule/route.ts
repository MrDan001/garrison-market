import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

function parseScheduledFor(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("scheduledFor must be an ISO date string.");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("scheduledFor is invalid.");

  if (date.getTime() <= Date.now()) {
    throw new Error("scheduledFor must be in the future.");
  }

  return date.toISOString();
}

export async function POST(request: Request) {
  try {
    const session = await requireMarketingAdmin();
    const payload = await request.json();

    const draftId = typeof payload?.draftId === "string" ? payload.draftId : "";
    const connectionId = typeof payload?.connectionId === "string" ? payload.connectionId : "";
    const scheduledFor = parseScheduledFor(payload?.scheduledFor);
    const mediaUrls = Array.isArray(payload?.mediaUrls)
      ? payload.mediaUrls.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 10)
      : draftId ? null : [];

    if (!draftId || !connectionId) {
      return NextResponse.json({ error: "draftId and connectionId are required." }, { status: 400 });
    }

    const draft = await marketingQueryOne<{
      id: string;
      platform: "facebook" | "instagram" | "both";
      body: string;
      media_urls: string[];
      status: string;
    }>(
      "select id, platform, body, media_urls, status from marketing.content_drafts where id = $1 limit 1",
      [draftId],
    );

    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    if (draft.status !== "approved") {
      return NextResponse.json({ error: "Draft must be approved before scheduling." }, { status: 409 });
    }
    if (draft.platform === "both") {
      return NextResponse.json(
        { error: "Choose a platform-specific draft before scheduling." },
        { status: 409 },
      );
    }

    const connection = await marketingQueryOne<{
      id: string;
      provider: "facebook" | "instagram";
      status: string;
    }>(
      "select id, provider, status from marketing.social_connections where id = $1 limit 1",
      [connectionId],
    );

    if (!connection) return NextResponse.json({ error: "Social connection not found." }, { status: 404 });
    if (connection.status !== "active") {
      return NextResponse.json({ error: "Social connection is not active." }, { status: 409 });
    }
    if (connection.provider !== draft.platform) {
      return NextResponse.json({ error: "Draft platform and connection platform do not match." }, { status: 409 });
    }

    const postMediaUrls = mediaUrls ?? draft.media_urls ?? [];
    if (draft.platform === "instagram" && postMediaUrls.length === 0) {
      return NextResponse.json(
        { error: "Instagram posts require at least one public image or video URL." },
        { status: 400 },
      );
    }

    const row = await marketingQueryOne(
      "insert into marketing.posts (" +
        "connection_id, draft_id, platform, caption, media_urls, status, scheduled_for, created_by_user_id" +
        ") values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, draft_id, platform, status, scheduled_for, created_at",
      [
        connectionId,
        draftId,
        draft.platform,
        draft.body,
        postMediaUrls,
        scheduledFor ? "scheduled" : "queued",
        scheduledFor,
        session.id,
      ],
    );

    return NextResponse.json({ ok: true, post: row }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to schedule post.";
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message.includes("scheduledFor")) return NextResponse.json({ error: message }, { status: 400 });
    console.error("[marketing/schedule]", error);
    return NextResponse.json({ error: "Unable to schedule post." }, { status: 500 });
  }
}
