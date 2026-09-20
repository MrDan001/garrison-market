import { Resend } from "resend";

const RESEND_API_URL = "https://api.resend.com";
const DEFAULT_SEGMENT_NAME = "Garrison Market Marketing Subscribers";

function getConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || "Garrison Market <no-reply@gmstock.co>",
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    segmentId: process.env.RESEND_MARKETING_SEGMENT_ID || "94fd6b6b-2701-4ad2-b981-df314107d076",
  };
}

function requireConfig() {
  const config = getConfig();
  if (!config.apiKey) throw new Error("Resend is not configured: RESEND_API_KEY is missing.");
  if (!config.from) throw new Error("Resend is not configured: EMAIL_FROM is missing.");
  if (!config.segmentId) throw new Error("Resend marketing is not configured: RESEND_MARKETING_SEGMENT_ID is missing.");
  return { ...config, apiKey: config.apiKey, segmentId: config.segmentId };
}

function getClient() {
  const { apiKey } = requireConfig();
  return new Resend(apiKey);
}

export function getResendMarketingSetupStatus() {
  const config = getConfig();
  return {
    apiKey: Boolean(config.apiKey),
    senderEmail: Boolean(config.from),
    segmentId: Boolean(config.segmentId),
  };
}

export function isResendMarketingConfigured() {
  const config = getConfig();
  return Boolean(config.apiKey && config.from && config.segmentId);
}

export function getMarketingSegmentId() {
  return getConfig().segmentId || null;
}

export function getMarketingSegmentName() {
  return DEFAULT_SEGMENT_NAME;
}

type ResendApiError = { message?: string; name?: string };

async function resendRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = requireConfig();
  const response = await fetch(`${RESEND_API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Resend API request failed.";
    try {
      const body = (await response.json()) as ResendApiError;
      detail = body.message || body.name || detail;
    } catch {
      // Keep the generic message.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type ResendSegment = {
  id: string;
  name: string;
  created_at?: string;
};

export type ResendBroadcast = {
  id: string;
  name: string;
  status: string;
  segment_id?: string;
  subject?: string;
  created_at?: string;
  scheduled_at?: string | null;
  sent_at?: string | null;
};

export async function getResendSegments(): Promise<ResendSegment[]> {
  const data = await resendRequest<{ data?: ResendSegment[] }>("/segments?limit=100");
  return data.data || [];
}

export async function getResendBroadcasts(): Promise<ResendBroadcast[]> {
  const data = await resendRequest<{ data?: ResendBroadcast[] }>("/broadcasts?limit=20");
  return data.data || [];
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || undefined,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

export async function addResendMarketingContact(email: string, fullName?: string, segmentId?: string) {
  const config = requireConfig();
  const targetSegmentId = segmentId || config.segmentId;
  const { firstName, lastName } = splitName(fullName || "");
  const client = getClient();

  const { data, error } = await client.contacts.create({
    email,
    firstName,
    lastName,
    unsubscribed: false,
    segmentIds: [targetSegmentId],
  });

  if (error) throw new Error(error.message || "Could not add the Resend marketing contact.");
  return data;
}

export async function syncResendMarketingContact(
  email: string,
  fullName: string | undefined,
  segmentId?: string,
  subscribed = true,
) {
  const config = requireConfig();
  const targetSegmentId = segmentId || config.segmentId;
  const { firstName, lastName } = splitName(fullName || "");
  const client = getClient();

  const { data: existing } = await client.contacts.get({ email });
  if (existing?.id) {
    const { data, error } = await client.contacts.update({
      id: existing.id,
      firstName,
      lastName,
      unsubscribed: !subscribed,
    });
    if (error) throw new Error(error.message || "Could not update the Resend marketing contact.");
    return data;
  }

  if (!subscribed) return null;

  const { data, error } = await client.contacts.create({
    email,
    firstName,
    lastName,
    unsubscribed: false,
    segmentIds: [targetSegmentId],
  });
  if (error) throw new Error(error.message || "Could not create the Resend marketing contact.");
  return data;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainText(body: string, cta?: { label: string; url: string }) {
  return [
    body.trim(),
    cta ? `${cta.label}: ${cta.url}` : "",
    "You’re receiving this because you subscribed to Garrison Market marketing emails.",
    "Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}",
  ].filter(Boolean).join("\n\n");
}

export function buildMarketingHtml(body: string, cta?: { label: string; url: string }) {
  const safeBody = body
    .trim()
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2f3440;padding-bottom:16px;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</td></tr>`,
    )
    .join("");

  const ctaHtml = cta
    ? `<tr><td style="padding-top:8px;padding-bottom:24px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding-top:12px;padding-right:20px;padding-bottom:12px;padding-left:20px;background-color:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">${escapeHtml(cta.label)}</a></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Garrison Market</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f4f5f7;">
<tr><td align="center" style="padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;">
<tr><td style="background-color:#0f1117;padding-top:24px;padding-right:28px;padding-bottom:24px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.4;color:#ffffff;font-weight:800;">Garrison Market</td></tr>
<tr><td style="padding-top:28px;padding-right:28px;padding-bottom:28px;padding-left:28px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2f3440;padding-bottom:18px;">Hi {{{FIRST_NAME|there}}},</td></tr>
${safeBody}
${ctaHtml}
<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9aa0a6;padding-top:4px;">You’re receiving this because you subscribed to Garrison Market marketing emails.</td></tr>
<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;padding-top:8px;"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#6b7280;">Unsubscribe from Garrison Market marketing emails</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export type CreateResendBroadcastParams = {
  campaignName: string;
  subject: string;
  body: string;
  segmentId: string;
  ctaLabel?: string;
  ctaUrl?: string;
  previewText?: string;
};

export async function createResendBroadcast(params: CreateResendBroadcastParams) {
  const config = requireConfig();
  if (!params.segmentId) throw new Error("A Resend marketing segment is required.");

  return resendRequest<{ id: string }>("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      name: params.campaignName,
      segmentId: params.segmentId,
      subject: params.subject,
      from: config.from,
      replyTo: config.replyTo ? [config.replyTo] : undefined,
      previewText: params.previewText || undefined,
      html: buildMarketingHtml(
        params.body,
        params.ctaLabel && params.ctaUrl ? { label: params.ctaLabel, url: params.ctaUrl } : undefined,
      ),
      text: plainText(
        params.body,
        params.ctaLabel && params.ctaUrl ? { label: params.ctaLabel, url: params.ctaUrl } : undefined,
      ),
    }),
  });
}

export async function sendResendBroadcastNow(broadcastId: string) {
  if (!broadcastId) throw new Error("A valid Resend broadcast ID is required.");
  await resendRequest<void>(`/broadcasts/${encodeURIComponent(broadcastId)}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function createAndSendResendBroadcast(params: CreateResendBroadcastParams) {
  const broadcast = await createResendBroadcast(params);
  await sendResendBroadcastNow(broadcast.id);
  return { broadcastId: broadcast.id };
}
