import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { marketingQuery } from "@/lib/marketing/db";
import { buildMetaOAuthUrl, generateOAuthState } from "@/lib/marketing/meta";

export const dynamic = "force-dynamic";

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/marketing";
  }

  return value;
}

export async function GET(request: Request) {
  const session = await getSessionUser();

  if (!session?.email || session.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const redirectUri = `${getBaseUrl(request)}/api/admin/marketing/meta/callback`;
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    const state = generateOAuthState();

    await marketingQuery(
      `
        insert into marketing.oauth_states (
          state,
          provider,
          initiated_by_user_id,
          redirect_uri,
          expires_at,
          metadata
        )
        values ($1, 'facebook', $2, $3, now() + interval '10 minutes', $4::jsonb)
      `,
      [
        state,
        session.id,
        redirectUri,
        JSON.stringify({ returnTo }),
      ],
    );

    const oauthUrl = buildMetaOAuthUrl({ state, redirectUri });

    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error("[marketing/meta/connect]", error);
    return NextResponse.json(
      { error: "Unable to start Meta connection." },
      { status: 500 },
    );
  }
}
