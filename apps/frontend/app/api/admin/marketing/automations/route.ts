import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireMarketingAdmin();
    const rows = await marketingQuery(
      "select id, name, description, trigger_type, action_type, schedule, enabled, config, last_run_at, next_run_at, created_at, updated_at " +
        "from marketing.automations order by created_at desc",
    );
    return NextResponse.json({ ok: true, automations: rows });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/automations GET]", error);
    return NextResponse.json({ error: "Unable to load marketing automations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireMarketingAdmin();
    const payload = await request.json();

    const name = typeof payload?.name === "string" ? payload.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Automation name is required." }, { status: 400 });

    const config = payload?.config && typeof payload.config === "object" ? payload.config : {};
    const intervalHours = Math.max(1, Math.min(Number(config.intervalHours || 24), 168));
    const nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString();

    const row = await marketingQueryOne(
      "insert into marketing.automations " +
        "(name, description, trigger_type, action_type, schedule, enabled, config, next_run_at, created_by_user_id) " +
        "values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) " +
        "returning id, name, description, trigger_type, action_type, schedule, enabled, config, next_run_at, created_at",
      [
        name,
        typeof payload?.description === "string" ? payload.description.trim().slice(0, 500) : null,
        "schedule",
        "generate_draft",
        "interval",
        payload?.enabled !== false,
        JSON.stringify({ ...config, intervalHours }),
        nextRunAt,
        session.id,
      ],
    );

    return NextResponse.json({ ok: true, automation: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/automations POST]", error);
    return NextResponse.json({ error: "Unable to create marketing automation." }, { status: 500 });
  }
}
