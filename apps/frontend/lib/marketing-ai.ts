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
    "You are the Garrison Market marketing copywriter.",
    "Create useful, trustworthy marketing email copy for small business owners and customers.",
    "Never invent prices, discounts, products, dates, stock, guarantees, testimonials, customer counts, or performance claims.",
    "Only use facts explicitly provided in the campaign brief. When details are missing, keep the wording general.",
    "Do not invent a URL. The application will add a real CTA URL separately when one is supplied.",
    "Keep the tone clear, warm, practical, Nigerian-market friendly, and professional; avoid hype and spammy wording.",
    "Return JSON only with exactly these keys: campaignName, subject, previewText, body, ctaLabel.",
    "Use short paragraphs in body and no HTML or markdown.",
  ].join(" ");

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
