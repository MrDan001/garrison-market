import { NextResponse } from "next/server";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import { marketingQueryOne } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireMarketingAdmin();
    const { id } = await context.params;
    const payload = await request.json();

    const row = await marketingQueryOne(
      "update marketing.campaigns set " +
        "name=coalesce($1,name), description=coalesce($2,description), objective=coalesce($3,objective), " +
        "status=coalesce($4,status), start_at=coalesce($5,start_at), end_at=coalesce($6,end_at), " +
        "settings=coalesce($7::jsonb,settings), updated_at=now() " +
        "where id=$8 returning id, name, description, objective, status, start_at, end_at, settings, updated_at",
      [
        typeof payload?.name === "string" ? payload.name.trim().slice(0, 140) : null,
        typeof payload?.description === "string" ? payload.description.trim().slice(0, 1000) : null,
        typeof payload?.objective === "string" ? payload.objective.trim().slice(0, 500) : null,
        ["draft", "active", "paused", "completed", "archived"].includes(payload?.status) ? payload.status : null,
        payload?.startAt ? new Date(payload.startAt).toISOString() : null,
        payload?.endAt ? new Date(payload.endAt).toISOString() : null,
        payload?.settings && typeof payload.settings === "object" ? JSON.stringify(payload.settings) : null,
        id,
      ],
    );

    if (!row) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ ok: true, campaign: row });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[marketing/campaigns/:id]", error);
    return NextResponse.json({ error: "Unable to update campaign." }, { status: 500 });
  }
}
