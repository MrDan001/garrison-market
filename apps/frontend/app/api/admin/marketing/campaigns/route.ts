import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireMarketingAdmin();
    const campaigns = await marketingQuery(
      "select id, name, description, objective, status, start_at, end_at, settings, created_at, updated_at " +
        "from marketing.campaigns order by updated_at desc",
    );
    return NextResponse.json({ ok: true, campaigns });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/campaigns GET]", error);
    return NextResponse.json({ error: "Unable to load campaigns." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireMarketingAdmin();
    const payload = await request.json();

    const name = typeof payload?.name === "string" ? payload.name.trim().slice(0, 140) : "";
    if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });

    const row = await marketingQueryOne(
      "insert into marketing.campaigns (" +
        "name, description, objective, status, start_at, end_at, settings, created_by_user_id" +
        ") values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) " +
        "returning id, name, description, objective, status, start_at, end_at, settings, created_at",
      [
        name,
        typeof payload?.description === "string" ? payload.description.trim().slice(0, 1000) : null,
        typeof payload?.objective === "string" ? payload.objective.trim().slice(0, 500) : null,
        payload?.status === "active" ? "active" : "draft",
        payload?.startAt ? new Date(payload.startAt).toISOString() : null,
        payload?.endAt ? new Date(payload.endAt).toISOString() : null,
        JSON.stringify(payload?.settings && typeof payload.settings === "object" ? payload.settings : {}),
        session.id,
      ],
    );

    return NextResponse.json({ ok: true, campaign: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/campaigns POST]", error);
    return NextResponse.json({ error: "Unable to create campaign." }, { status: 500 });
  }
}
