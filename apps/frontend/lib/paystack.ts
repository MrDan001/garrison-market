// lib/paystack.ts
// Thin wrapper around Paystack's REST API. Uses the secret key server-side
// only — never expose PAYSTACK_SECRET_KEY to the client.
//
// Setup required:
// 1. Add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to your env.
// 2. In your Paystack dashboard, set the webhook URL to:
//    https://yourdomain.com/api/paystack/webhook

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

interface InitializeParams {
  email: string;
  amountNaira: number; // whole Naira, converted to kobo internally
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, any>;
}

export async function initializeTransaction({
  email,
  amountNaira,
  reference,
  callbackUrl,
  metadata,
}: InitializeParams) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100), // Naira -> kobo
      reference,
      callback_url: callbackUrl,
      currency: "NGN",
      metadata,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Failed to initialize Paystack transaction.");
  }
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` },
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Failed to verify Paystack transaction.");
  }
  return data.data as {
    status: string; // "success" | "failed" | "abandoned"
    reference: string;
    amount: number; // kobo
    customer: { email: string; customer_code: string };
    authorization: { authorization_code: string };
    metadata: Record<string, any>;
  };
}

/**
 * Verifies the X-Paystack-Signature header on incoming webhooks using
 * HMAC-SHA512 of the raw request body, as required by Paystack.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const crypto = require("crypto") as typeof import("crypto");
  const hash = crypto.createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");

  const hashBuffer = Buffer.from(hash, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (hashBuffer.length !== signatureBuffer.length) return false;

  return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
}