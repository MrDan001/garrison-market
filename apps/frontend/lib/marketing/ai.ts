import { buildMarketingBrainPrompt } from "@/lib/marketing/brain";

export type MarketingPlatform = "facebook" | "instagram" | "both";

export type MarketingGenerationInput = {
  platform: MarketingPlatform;
  goal: string;
  audience: string;
  featureFocus?: string;
  recentContent?: string[];
};

export type GeneratedPlatformContent = {
  title: string;
  body: string;
  hashtags: string[];
  callToAction: string;
};

export type GeneratedMarketingContent = {
  strategy: string;
  featureFocus: string;
  contentType: string;
  facebook: GeneratedPlatformContent;
  instagram: GeneratedPlatformContent;
  visualIdea: string;
};

const MARKETING_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    strategy: { type: "string" },
    featureFocus: { type: "string" },
    contentType: { type: "string" },
    facebook: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        callToAction: { type: "string" },
      },
      required: ["title", "body", "hashtags", "callToAction"],
    },
    instagram: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        callToAction: { type: "string" },
      },
      required: ["title", "body", "hashtags", "callToAction"],
    },
    visualIdea: { type: "string" },
  },
  required: ["strategy", "featureFocus", "contentType", "facebook", "instagram", "visualIdea"],
} as const;

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return { apiKey, model };
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const chunks: string[] = [];

  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") chunks.push(content.text);
      else if (typeof content?.text?.value === "string") chunks.push(content.text.value);
    }
  }

  return chunks.join("\n").trim();
}

export async function generateMarketingContent(input: MarketingGenerationInput) {
  const { apiKey, model } = getOpenAIConfig();
  const prompt = buildMarketingBrainPrompt(input);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Return only the requested structured marketing object. " +
                "Every feature reference must be a verified feature id from the supplied catalog. " +
                "Do not invent prices, discounts, customer counts, guarantees, integrations, or outcomes.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "garrison_market_marketing_content",
          description: "Structured Garrison Market marketing content for Facebook and Instagram.",
          strict: true,
          schema: MARKETING_OUTPUT_SCHEMA,
        },
      },
    }),
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.code ||
      "OpenAI request failed with HTTP " + response.status + ".";
    throw new Error(String(message));
  }

  const raw = extractOutputText(payload);

  if (!raw) throw new Error("The marketing brain returned no text output.");

  let parsed: GeneratedMarketingContent;
  try {
    parsed = JSON.parse(raw) as GeneratedMarketingContent;
  } catch {
    throw new Error("The marketing brain returned invalid structured output.");
  }

  if (
    !parsed?.featureFocus ||
    !parsed.facebook?.body ||
    !parsed.instagram?.body ||
    !Array.isArray(parsed.facebook.hashtags) ||
    !Array.isArray(parsed.instagram.hashtags)
  ) {
    throw new Error("The marketing brain returned incomplete content.");
  }

  return { ...parsed, model };
}
