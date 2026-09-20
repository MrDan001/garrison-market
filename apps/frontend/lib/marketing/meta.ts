import crypto from "crypto";
import { marketingQuery, marketingQueryOne } from "@/lib/marketing/db";
import { encryptMarketingToken } from "@/lib/marketing/token-crypto";

const DEFAULT_GRAPH_VERSION = "v26.0";
const META_GRAPH_HOST = "https://graph.facebook.com";

export const META_PUBLISH_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "read_insights",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "business_management",
] as const;

type MetaApiResponse<T> = T & {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type MetaPage = {
  id: string;
  name: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
  } | null;
};

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

function getGraphVersion() {
  return process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
}

function getMetaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be configured.");
  }

  return { appId, appSecret, graphVersion: getGraphVersion() };
}

function assertMetaOk<T>(response: MetaApiResponse<T>): T {
  if (response.error) {
    const details = [
      response.error.message,
      response.error.code != null ? `code=${response.error.code}` : null,
      response.error.error_subcode != null ? `subcode=${response.error.error_subcode}` : null,
      response.error.fbtrace_id ? `trace=${response.error.fbtrace_id}` : null,
    ].filter(Boolean).join(" | ");

    throw new Error(`Meta API error: ${details || "Unknown error"}`);
  }

  return response as T;
}

async function metaGet<T>(path: string, params: Record<string, string | undefined>) {
  const { graphVersion } = getMetaConfig();
  const url = new URL(`${META_GRAPH_HOST}/${graphVersion}/${path.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json()) as MetaApiResponse<T>;

  if (!response.ok && !payload.error) {
    throw new Error(`Meta API request failed with HTTP ${response.status}.`);
  }

  return assertMetaOk(payload);
}

export function generateOAuthState() {
  return crypto.randomBytes(32).toString("base64url");
}

export function buildMetaOAuthUrl(input: {
  state: string;
  redirectUri: string;
}) {
  const { appId, graphVersion } = getMetaConfig();
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);

  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_PUBLISH_SCOPES.join(","));
  url.searchParams.set("state", input.state);

  const configId = process.env.META_FACEBOOK_LOGIN_CONFIG_ID;
  if (configId) {
    url.searchParams.set("config_id", configId);
    url.searchParams.set("override_default_response_type", "true");
  }

  return url.toString();
}

export async function exchangeMetaCode(input: {
  code: string;
  redirectUri: string;
}) {
  const { appId, appSecret } = getMetaConfig();

  const shortLived = await metaGet<MetaTokenResponse>("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const longLived = await metaGet<MetaTokenResponse>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });

  return {
    accessToken: longLived.access_token,
    expiresInSeconds: longLived.expires_in ?? shortLived.expires_in ?? null,
  };
}

export async function getMetaUser(accessToken: string) {
  return metaGet<{ id: string; name?: string }>("me", {
    fields: "id,name",
    access_token: accessToken,
  });
}

export async function getManagedPages(accessToken: string) {
  const response = await metaGet<{ data: MetaPage[] }>("me/accounts", {
    fields: "id,name,access_token,tasks,instagram_business_account",
    access_token: accessToken,
  });

  return response.data ?? [];
}

export async function storeMetaPageConnections(input: {
  adminUserId: number;
  metaUserId: string;
  userAccessTokenExpiresAt: string | null;
  pages: MetaPage[];
}) {
  const created: Array<{
    provider: "facebook" | "instagram";
    accountId: string;
    accountName: string | null;
  }> = [];

  for (const page of input.pages) {
    if (!page.id || !page.access_token) continue;

    const commonMetadata = {
      metaUserId: input.metaUserId,
      pageTasks: page.tasks ?? [],
      userAccessTokenExpiresAt: input.userAccessTokenExpiresAt,
    };

    const encryptedPageToken = encryptMarketingToken(page.access_token);

    const facebook = await marketingQueryOne<{
      id: string;
      provider: "facebook";
      provider_account_id: string;
      account_name: string | null;
    }>(
      `
        insert into marketing.social_connections (
          provider,
          provider_account_id,
          account_name,
          page_id,
          instagram_business_account_id,
          access_token_ciphertext,
          token_expires_at,
          scopes,
          status,
          metadata,
          connected_by_user_id,
          updated_at
        )
        values (
          'facebook',
          $1,
          $2,
          $1,
          $3,
          $4,
          $5,
          $6,
          'active',
          $7::jsonb,
          $8,
          now()
        )
        on conflict (provider, provider_account_id)
        do update set
          account_name = excluded.account_name,
          page_id = excluded.page_id,
          instagram_business_account_id = excluded.instagram_business_account_id,
          access_token_ciphertext = excluded.access_token_ciphertext,
          token_expires_at = excluded.token_expires_at,
          scopes = excluded.scopes,
          status = 'active',
          metadata = excluded.metadata,
          connected_by_user_id = excluded.connected_by_user_id,
          updated_at = now()
        returning id, provider, provider_account_id, account_name
      `,
      [
        page.id,
        page.name || null,
        page.instagram_business_account?.id ?? null,
        encryptedPageToken,
        input.userAccessTokenExpiresAt,
        [...META_PUBLISH_SCOPES],
        JSON.stringify(commonMetadata),
        input.adminUserId,
      ],
    );

    if (facebook) {
      created.push({
        provider: "facebook",
        accountId: facebook.provider_account_id,
        accountName: facebook.account_name,
      });
    }

    const instagramId = page.instagram_business_account?.id;
    if (instagramId) {
      const instagram = await marketingQueryOne<{
        provider_account_id: string;
        account_name: string | null;
      }>(
        `
          insert into marketing.social_connections (
            provider,
            provider_account_id,
            account_name,
            page_id,
            instagram_business_account_id,
            access_token_ciphertext,
            token_expires_at,
            scopes,
            status,
            metadata,
            connected_by_user_id,
            updated_at
          )
          values (
            'instagram',
            $1,
            $2,
            $3,
            $1,
            $4,
            $5,
            $6,
            'active',
            $7::jsonb,
            $8,
            now()
          )
          on conflict (provider, provider_account_id)
          do update set
            account_name = excluded.account_name,
            page_id = excluded.page_id,
            instagram_business_account_id = excluded.instagram_business_account_id,
            access_token_ciphertext = excluded.access_token_ciphertext,
            token_expires_at = excluded.token_expires_at,
            scopes = excluded.scopes,
            status = 'active',
            metadata = excluded.metadata,
            connected_by_user_id = excluded.connected_by_user_id,
            updated_at = now()
          returning provider_account_id, account_name
        `,
        [
          instagramId,
          page.name || null,
          page.id,
          encryptedPageToken,
          input.userAccessTokenExpiresAt,
          [...META_PUBLISH_SCOPES],
          JSON.stringify(commonMetadata),
          input.adminUserId,
        ],
      );

      if (instagram) {
        created.push({
          provider: "instagram",
          accountId: instagram.provider_account_id,
          accountName: instagram.account_name,
        });
      }
    }
  }

  return created;
}

export async function listMetaConnections() {
  return marketingQuery<{
    id: string;
    provider: "facebook" | "instagram";
    provider_account_id: string;
    account_name: string | null;
    page_id: string | null;
    instagram_business_account_id: string | null;
    token_expires_at: string | null;
    scopes: string[];
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `
      select
        id,
        provider,
        provider_account_id,
        account_name,
        page_id,
        instagram_business_account_id,
        token_expires_at,
        scopes,
        status,
        created_at,
        updated_at
      from marketing.social_connections
      order by provider, account_name nulls last
    `,
  );
}
