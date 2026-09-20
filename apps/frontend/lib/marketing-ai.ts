const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openrouter/free";

export type GeneratedMarketingContent = {
  campaignName: string;
  subject: string;
  previewText: string;
  body: string;
  ctaLabel: string;
};

function extractText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part: any) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

function extractJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
    throw new Error("The AI returned an invalid campaign format.");
  }
}

function normalizeContent(raw: any): GeneratedMarketingContent {
  const campaignName = String(raw?.campaignName ?? "Garrison Market Campaign").trim();
  const subject = String(raw?.subject ?? "").trim();
  const previewText = String(raw?.previewText ?? "").trim();
  const body = String(raw?.body ?? "").trim();
  const ctaLabel = String(raw?.ctaLabel ?? "").trim();
  if (!subject || !body) throw new Error("The AI did not generate usable campaign content.");
  return {
    campaignName: campaignName.slice(0, 120),
    subject: subject.slice(0, 150),
    previewText: previewText.slice(0, 160),
    body: body.slice(0, 12000),
    ctaLabel: ctaLabel.slice(0, 60),
  };
}

export function isMarketingAiConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function generateMarketingContent(prompt: string): Promise<GeneratedMarketingContent> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI campaign generation is not configured: OPENROUTER_API_KEY is missing.");

  const system = [
    "You are the Garrison Market marketing copywriter. The product definition below is the source of truth for what Garrison Market is and does.",
    "",
    "GARRISON MARKET — CANONICAL PRODUCT DEFINITION:",
    "Garrison Market is an all-in-one inventory and sales management app for shop and market owners in Nigeria. Its purpose is to help a business owner stay in control of stock, sales, staff, stores, and day-to-day business records from a phone-friendly dashboard.",
    "Core positioning: one dashboard for stock, staff, and sales — so an owner can know what is in stock, what sold, who sold it, and what is running low.",
    "Core capabilities supported by the product include: inventory tracking with cost price, selling price, categories, restock thresholds and low/out-of-stock alerts; inventory measured by piece and, where applicable, by weight/volume such as kg, g, L and ml; staff logins and role-based access with sales attribution and the ability to suspend staff access; multiple-store management; checkout and sales processing; daily/end-of-day staff reports; sales and business summary reporting; expenses; invoices; customer records/features; debtors and part-payments with history; consignments; wastage reporting; notifications and operational business tools.",
    "Some capabilities are plan- or account-dependent. Do not imply that every customer has access to every feature unless the campaign brief explicitly provides that context.",
    "",
    "CRITICAL POSITIONING BOUNDARIES:",
    "Garrison Market is NOT a marketplace, seller directory, customer-discovery platform, social network, online bazaar, or platform whose primary purpose is connecting businesses with customers.",
    "Do not describe Garrison Market as a place where businesses list products for customers to discover, a place where businesses meet customers, a platform for expanding customer reach, or a marketplace for buying and selling between users.",
    "Do not invent a marketplace, storefront, delivery network, payment gateway, advertising network, customer-acquisition service, or e-commerce feature that is not explicitly supplied in the campaign brief.",
    "When introducing Garrison Market, explain it as business/inventory/sales management software for shop and market owners.",
    "",
    "AUDIENCE:",
    "The marketing audience is generally shop owners, market owners, and business operators who need better control of inventory, sales, staff, stores, and business records. Do not automatically describe the audience as generic entrepreneurs or consumers.",
    "",
    "COPY RULES:",
    "Create useful, trustworthy marketing email copy. Never invent prices, discounts, products, dates, stock levels, guarantees, testimonials, customer counts, or performance claims.",
    "Use only factual product capabilities from this product definition or facts explicitly provided in the campaign brief. When details are missing, keep wording general.",
    "Treat the campaign brief as the request for topic and angle, not as permission to redefine what Garrison Market is.",
    "For an introduction campaign, clearly state the inventory-and-sales-management positioning before discussing any individual feature.",
    "Keep the tone clear, warm, practical, Nigerian-market friendly, and professional; avoid hype and spammy wording.",
    "Do not invent a URL. The application will add a real CTA URL separately when one is supplied.",
    "Return JSON only with exactly these keys: campaignName, subject, previewText, body, ctaLabel.",
    "Use short paragraphs in body and no HTML or markdown.",
  ].join("\n");

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://garrison-market.vercel.app",
      "X-Title": "Garrison Market Marketing AI",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt.trim() },
      ],
      max_tokens: 1400,
      stream: false,
      provider: { allow_fallbacks: true },
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Keep the response body for a useful error below.
  }

  if (!response.ok) {
    console.error("MARKETING_AI_ERROR", response.status, raw.slice(0, 3000));
    if (response.status === 401) throw new Error("AI authentication failed. Check OPENROUTER_API_KEY in Vercel.");
    if (response.status === 429) throw new Error("The AI provider is temporarily rate-limited. Please try again shortly.");
    if (response.status === 402) throw new Error("The available free AI model pool could not serve the request right now.");
    throw new Error(`The AI provider returned an error (${response.status}).`);
  }

  const text = extractText(payload);
  if (!text) throw new Error("The AI provider returned no readable campaign content.");
  return normalizeContent(extractJson(text));
}
