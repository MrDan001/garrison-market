import { buildMarketingBrainPrompt } from "@/lib/marketing/brain";
import {
  GARRISON_MARKET_MARKETING_FEATURES,
  getMarketingFeature,
  type MarketingFeature,
} from "@/lib/marketing/feature-catalog";

export type MarketingPlatform = "facebook" | "instagram" | "both";

export type MarketingGenerationInput = {
  platform: MarketingPlatform;
  goal: string;
  audience: string;
  featureFocus?: string;
  recentContent?: string[];
  performanceSignals?: string[];
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

function validateGeneratedContent(parsed: GeneratedMarketingContent) {
  if (
    !parsed?.featureFocus ||
    !parsed.facebook?.body ||
    !parsed.instagram?.body ||
    !Array.isArray(parsed.facebook.hashtags) ||
    !Array.isArray(parsed.instagram.hashtags)
  ) {
    throw new Error("The marketing brain returned incomplete content.");
  }

  if (!getMarketingFeature(parsed.featureFocus)) {
    throw new Error("The marketing brain selected an unverified feature.");
  }

  return parsed;
}

function chooseLocalFeature(input: MarketingGenerationInput): MarketingFeature {
  if (input.featureFocus) {
    const explicit = getMarketingFeature(input.featureFocus);
    if (explicit) return explicit;
  }

  const haystack = (
    [input.goal, input.audience, ...(input.recentContent ?? [])].join(" ") + " "
  ).toLowerCase();

  const scored = GARRISON_MARKET_MARKETING_FEATURES.map((feature, index) => {
    const matches = [...feature.keywords, ...feature.angles].reduce(
      (score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 2 : 0),
      0,
    );
    return { feature, score: matches, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const recentFeatureIds = new Set(
    (input.recentContent ?? [])
      .flatMap((entry) =>
        GARRISON_MARKET_MARKETING_FEATURES.filter((feature) =>
          entry.toLowerCase().includes(feature.name.toLowerCase()),
        ).map((feature) => feature.id),
      ),
  );

  return (
    scored.find((item) => !recentFeatureIds.has(item.feature.id))?.feature ??
    scored[0]?.feature ??
    GARRISON_MARKET_MARKETING_FEATURES[0]
  );
}

function cleanHashtag(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9_]/g, "");
  return normalized ? "#" + normalized : "";
}

function buildLocalGeneration(input: MarketingGenerationInput): GeneratedMarketingContent {
  const feature = chooseLocalFeature(input);
  const angle = feature.angles[0] || feature.description;
  const featureName = feature.name;
  const goal = input.goal || "increase awareness and engagement";

  const facebook: GeneratedPlatformContent = {
    title: `${featureName}: make the everyday business work easier`,
    body:
      `Running a business should not mean guessing. ${featureName} helps business owners ${angle}. ` +
      `Garrison Market puts this into one practical system so you can spend less time chasing records and more time running the shop. ` +
      `The goal here is simple: ${goal.toLowerCase().replace(/[.]+$/, "")}.`,
    hashtags: [
      cleanHashtag("GarrisonMarket"),
      cleanHashtag(feature.category),
      cleanHashtag("BusinessOwners"),
      cleanHashtag("NigeriaBusiness"),
    ].filter(Boolean),
    callToAction: "See how Garrison Market can fit into your business and tell us what you would like to simplify first.",
  };

  const instagram: GeneratedPlatformContent = {
    title: `${featureName} without the guesswork.`,
    body:
      `${featureName} → ${angle}.\n\n` +
      `Less chasing records. More clarity for your business.\n\n` +
      `That is the kind of everyday problem Garrison Market is built to help with.`,
    hashtags: [
      cleanHashtag("GarrisonMarket"),
      cleanHashtag(featureName.replace(/&/g, "and")),
      cleanHashtag("SmallBusiness"),
      cleanHashtag("BusinessNigeria"),
      cleanHashtag("ShopManagement"),
    ].filter(Boolean),
    callToAction: "Tap through and explore Garrison Market.",
  };

  return {
    strategy:
      `Lead with the real business-owner pain point around ${featureName}, show the practical benefit, and invite the audience into the conversation.`,
    featureFocus: feature.id,
    contentType: input.platform === "instagram" ? "instagram-post" : "social-post",
    facebook,
    instagram,
    visualIdea:
      `Create a clean Garrison Market visual showing a business owner dealing with the pain point addressed by ${featureName}, then reveal the feature as the practical solution.`,
  };
}

async function generateWithGemini(input: MarketingGenerationInput, apiKey: string) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const prompt = buildMarketingBrainPrompt(input);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text:
                "Return only the requested JSON object. " +
                "Every feature reference must be a verified feature id from the supplied catalog. " +
                "Do not invent prices, discounts, customer counts, guarantees, integrations, or outcomes.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: MARKETING_OUTPUT_SCHEMA,
          temperature: 0.8,
        },
      }),
      cache: "no-store",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.status ||
      "Gemini request failed with HTTP " + response.status + ".";
    throw new Error(String(message));
  }

  const raw =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join("") || "";

  if (!raw) throw new Error("The marketing brain returned no text output.");

  let parsed: GeneratedMarketingContent;
  try {
    parsed = JSON.parse(raw) as GeneratedMarketingContent;
  } catch {
    throw new Error("The marketing brain returned invalid structured output.");
  }

  return {
    ...validateGeneratedContent(parsed),
    model,
    provider: "gemini",
  };
}

export async function generateMarketingContent(input: MarketingGenerationInput) {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

  if (geminiApiKey) {
    return generateWithGemini(input, geminiApiKey);
  }

  return {
    ...buildLocalGeneration(input),
    model: "local-marketing-brain",
    provider: "local",
  };
}
