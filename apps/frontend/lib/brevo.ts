// FILE: apps/frontend/lib/brevo.ts
// Brevo is used for MARKETING email only. Transactional/app email remains on Resend.
//
// Required environment variables:
// - BREVO_API_KEY
// - BREVO_SENDER_EMAIL
// Optional:
// - BREVO_SENDER_NAME
// - BREVO_REPLY_TO

const BREVO_API_URL = "https://api.brevo.com/v3";

type BrevoError = {
  code?: string;
  message?: string;
};

export type BrevoList = {
  id: number;
  name: string;
  totalSubscribers?: number;
  uniqueSubscribers?: number;
  folderId?: number;
};

export type BrevoCampaign = {
  id: number;
  name: string;
  status: string;
  subject?: string;
  sender?: { name?: string; email?: string };
  createdAt?: string;
  scheduledAt?: string;
  sentDate?: string;
};

function getConfig() {
  return {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME || "Garrison Market",
    replyTo: process.env.BREVO_REPLY_TO || undefined,
  };
}

export function getBrevoSetupStatus() {
  const { apiKey, senderEmail } = getConfig();
  return {
    apiKey: Boolean(apiKey),
    senderEmail: Boolean(senderEmail),
  };
}

export function isBrevoConfigured() {
  const { apiKey, senderEmail } = getConfig();
  return Boolean(apiKey && senderEmail);
}

function requireConfig() {
  const config = getConfig();
  if (!config.apiKey) throw new Error("Brevo is not configured: BREVO_API_KEY is missing.");
  if (!config.senderEmail) throw new Error("Brevo is not configured: BREVO_SENDER_EMAIL is missing.");
  return config as typeof config & { apiKey: string; senderEmail: string };
}

async function brevoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = requireConfig();

  const response = await fetch(`${BREVO_API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Brevo API request failed.";
    try {
      const body = (await response.json()) as BrevoError;
      detail = body.message || body.code || detail;
    } catch {
      // Keep the generic message when Brevo returns a non-JSON response.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getBrevoLists(): Promise<BrevoList[]> {
  const data = await brevoRequest<{ lists?: BrevoList[] }>("/contacts/lists?limit=50&offset=0&sort=desc");
  return data.lists || [];
}

export type BrevoFolder = {
  id: number;
  name: string;
};

export const AUTO_MARKETING_FOLDER_NAME = "Garrison Market";
export const AUTO_MARKETING_LIST_NAME = "Garrison Market Marketing Subscribers";

export async function getBrevoFolders(): Promise<BrevoFolder[]> {
  const data = await brevoRequest<{ folders?: BrevoFolder[] }>("/contacts/folders?limit=50&offset=0&sort=desc");
  return data.folders || [];
}

export async function getOrCreateBrevoMarketingList(): Promise<number> {
  const normalizedListName = AUTO_MARKETING_LIST_NAME.toLowerCase();

  const existingList = (await getBrevoLists()).find(
    (list) => list.name.trim().toLowerCase() === normalizedListName,
  );
  if (existingList) return existingList.id;

  const normalizedFolderName = AUTO_MARKETING_FOLDER_NAME.toLowerCase();
  let folder = (await getBrevoFolders()).find(
    (item) => item.name.trim().toLowerCase() === normalizedFolderName,
  );

  if (!folder) {
    try {
      folder = await brevoRequest<BrevoFolder>("/contacts/folders", {
        method: "POST",
        body: JSON.stringify({ name: AUTO_MARKETING_FOLDER_NAME }),
      });
    } catch {
      // Another request may have created the folder concurrently.
      folder = (await getBrevoFolders()).find(
        (item) => item.name.trim().toLowerCase() === normalizedFolderName,
      );
      if (!folder) throw new Error("Could not create the Garrison Market Brevo folder.");
    }
  }

  try {
    const created = await brevoRequest<{ id: number }>("/contacts/lists", {
      method: "POST",
      body: JSON.stringify({
        name: AUTO_MARKETING_LIST_NAME,
        folderId: folder.id,
      }),
    });
    return created.id;
  } catch {
    // Another request may have created the list concurrently.
    const retry = (await getBrevoLists()).find(
      (list) => list.name.trim().toLowerCase() === normalizedListName,
    );
    if (retry) return retry.id;
    throw new Error("Could not create the Garrison Market Brevo marketing list.");
  }
}

export async function getBrevoCampaigns(): Promise<BrevoCampaign[]> {
  const data = await brevoRequest<{ campaigns?: BrevoCampaign[] }>("/emailCampaigns?limit=20&offset=0&sort=desc");
  return data.campaigns || [];
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || undefined,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

export async function addBrevoContact(email: string, fullName: string | undefined, listId: number) {
  requireConfig();
  if (!Number.isInteger(listId) || listId <= 0) {
    throw new Error("A valid Brevo audience list is required.");
  }

  const { firstName, lastName } = splitName(fullName || "");

  return brevoRequest<{ id?: number }>("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      attributes: {
        ...(firstName ? { FNAME: firstName } : {}),
        ...(lastName ? { LNAME: lastName } : {}),
      },
      listIds: [listId],
      updateEnabled: true,
    }),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildMarketingHtml(body: string, cta?: { label: string; url: string }) {
  const safeBody = body
    .trim()
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#2f3440;font-size:15px;line-height:1.7;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  const ctaHtml = cta
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">${escapeHtml(cta.label)}</a></p>`
    : "";

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
        <div style="background:#0f1117;padding:24px 28px;color:#ffffff;font-size:18px;font-weight:800;">Garrison Market</div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;color:#2f3440;font-size:15px;line-height:1.7;">Hi {{ contact.FNAME | default : "there" }},</p>
          ${safeBody}
          ${ctaHtml}
          <p style="margin:26px 0 0;color:#9aa0a6;font-size:12px;line-height:1.6;">You’re receiving this because you subscribed to Garrison Market marketing emails.</p>
          <p style="margin:10px 0 0;font-size:12px;"><a href="{{ unsubscribe }}" style="color:#6b7280;">Unsubscribe from Garrison Market marketing emails</a></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export type CreateBrevoCampaignParams = {
  campaignName: string;
  subject: string;
  body: string;
  listId: number;
  ctaLabel?: string;
  ctaUrl?: string;
  previewText?: string;
};

export async function createBrevoCampaign(params: CreateBrevoCampaignParams) {
  const config = requireConfig();
  if (!Number.isInteger(params.listId) || params.listId <= 0) {
    throw new Error("A valid Brevo audience list is required.");
  }

  const htmlContent = buildMarketingHtml(
    params.body,
    params.ctaLabel && params.ctaUrl ? { label: params.ctaLabel, url: params.ctaUrl } : undefined,
  );

  return brevoRequest<{ id: number }>("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: params.campaignName,
      subject: params.subject,
      sender: {
        email: config.senderEmail,
        name: config.senderName,
      },
      replyTo: config.replyTo || config.senderEmail,
      previewText: params.previewText || undefined,
      type: "classic",
      htmlContent,
      recipients: {
        listIds: [params.listId],
      },
    }),
  });
}

export async function sendBrevoCampaignNow(campaignId: number) {
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    throw new Error("A valid Brevo campaign ID is required.");
  }
  await brevoRequest<void>(`/emailCampaigns/${campaignId}/sendNow`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function createAndSendBrevoCampaign(params: CreateBrevoCampaignParams) {
  const campaign = await createBrevoCampaign(params);
  await sendBrevoCampaignNow(campaign.id);
  return { campaignId: campaign.id };
}
