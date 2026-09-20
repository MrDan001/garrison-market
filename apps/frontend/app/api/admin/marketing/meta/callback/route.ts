import { NextResponse } from "next/server";
import { marketingQueryOne } from "@/lib/marketing/db";
import {
  exchangeMetaCode,
  getManagedPages,
  getMetaUser,
  storeMetaPageConnections,
} from "@/lib/marketing/meta";

export const dynamic = "force-dynamic";

function buildAbsoluteRedirect(request: Request, returnTo: string, params: Record<string, string>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const target = new URL(returnTo, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return NextResponse.redirect(target);
}

function isSafeReturnTo(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    const row = state
      ? await marketingQueryOne<{ metadata: Record<string, unknown> }>(
          `select metadata from marketing.oauth_states where state = $1 and consumed_at is null and expires_at > now()`,
          [state],
        )
      : null;
    const returnTo = isSafeReturnTo(row?.metadata?.returnTo) ? row!.metadata!.returnTo as string : "/admin/marketing";
    return buildAbsoluteRedirect(request, returnTo, {
      meta: "error",
      message: url.searchParams.get("error_description") || oauthError,
    });
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing OAuth code or state." }, { status: 400 });
  }

  const oauthState = await marketingQueryOne<{
    id: string;
    initiated_by_user_id: number;
    redirect_uri: string;
    metadata: Record<string, unknown>;
  }>(
    `
      select id, initiated_by_user_id, redirect_uri, metadata
      from marketing.oauth_states
      where state = $1
        and consumed_at is null
        and expires_at > now()
      limit 1
    `,
    [state],
  );

  if (!oauthState) {
    return NextResponse.json({ error: "OAuth state is invalid or expired." }, { status: 400 });
  }

  try {
    await marketingQueryOne(
      `update marketing.oauth_states set consumed_at = now() where id = $1 and consumed_at is null returning id`,
      [oauthState.id],
    );

    const exchanged = await exchangeMetaCode({
      code,
      redirectUri: oauthState.redirect_uri,
    });

    const metaUser = await getMetaUser(exchanged.accessToken);
    const pages = await getManagedPages(exchanged.accessToken);

    const expiresAt = exchanged.expiresInSeconds
      ? new Date(Date.now() + exchanged.expiresInSeconds * 1000).toISOString()
      : null;

    const connections = await storeMetaPageConnections({
      adminUserId: oauthState.initiated_by_user_id,
      metaUserId: metaUser.id,
      userAccessTokenExpiresAt: expiresAt,
      pages,
    });

    const returnTo = isSafeReturnTo(oauthState.metadata?.returnTo)
      ? oauthState.metadata!.returnTo as string
      : "/admin/marketing";

    return buildAbsoluteRedirect(request, returnTo, {
      meta: "connected",
      connected: String(connections.length),
    });
  } catch (error) {
    console.error("[marketing/meta/callback]", error);

    const returnTo = isSafeReturnTo(oauthState.metadata?.returnTo)
      ? oauthState.metadata!.returnTo as string
      : "/admin/marketing";

    return buildAbsoluteRedirect(request, returnTo, {
      meta: "error",
      message: error instanceof Error ? error.message : "Meta connection failed.",
    });
  }
}
