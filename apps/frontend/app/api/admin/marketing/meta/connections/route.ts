import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listMetaConnections } from "@/lib/marketing/meta";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();

  if (!session?.email || session.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await listMetaConnections();

    return NextResponse.json({
      ok: true,
      connections,
    });
  } catch (error) {
    console.error("[marketing/meta/connections]", error);
    return NextResponse.json(
      { error: "Unable to load social connections." },
      { status: 500 },
    );
  }
}
