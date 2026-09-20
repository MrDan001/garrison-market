import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";
import { validateDraftInput } from "@/lib/marketing/content";
import { getMarketingFeature } from "@/lib/marketing/feature-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionUser();

  if (!session?.email || session.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "50"), 1), 100);
    const status = url.searchParams.get("status");
    const platform = url.searchParams.get("platform");

    const values: unknown[] = [];
    const filters: string[] = [];

    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }

    if (platform) {
      values.push(platform);
      filters.push(`platform = $${values.length}`);
    }

    values.push(limit);

    const rows = await marketingQuery(
      `
        select
          id,
          title,
          platform,
          content_type,
          body,
          media_urls,
          hashtags,
          call_to_action,
          feature_focus,
          generation_prompt,
          generation_metadata,
          status,
          created_by_user_id,
          created_at,
          updated_at
        from marketing.content_drafts
        ${filters.length ? `where ${filters.join(" and ")}` : ""}
        order by updated_at desc
        limit $${values.length}
      `,
      values,
    );

    return NextResponse.json({
      ok: true,
      drafts: rows.map((row: any) => ({
        ...row,
        feature: row.feature_focus ? getMarketingFeature(row.feature_focus) : null,
      })),
    });
  } catch (error) {
    console.error("[marketing/drafts GET]", error);
    return NextResponse.json({ error: "Unable to load marketing drafts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionUser();

  if (!session?.email || session.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const input = validateDraftInput(payload);

    const row = await marketingQueryOne(
      `
        insert into marketing.content_drafts (
          title,
          platform,
          content_type,
          body,
          media_urls,
          hashtags,
          call_to_action,
          feature_focus,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning
          id,
          title,
          platform,
          content_type,
          body,
          media_urls,
          hashtags,
          call_to_action,
          feature_focus,
          status,
          created_by_user_id,
          created_at,
          updated_at
      `,
      [
        input.title,
        input.platform,
        input.contentType,
        input.body,
        input.mediaUrls,
        input.hashtags,
        input.callToAction,
        input.featureFocus,
        session.id,
      ],
    );

    return NextResponse.json(
      {
        ok: true,
        draft: row,
        feature: input.featureFocus ? getMarketingFeature(input.featureFocus) : null,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create marketing draft.";

    if (
      message.startsWith("Invalid platform.") ||
      message === "Draft body is required." ||
      message === "Unknown Garrison Market marketing feature."
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[marketing/drafts POST]", error);
    return NextResponse.json({ error: "Unable to create marketing draft." }, { status: 500 });
  }
}
