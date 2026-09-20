import { GARRISON_MARKET_MARKETING_FEATURES } from "@/lib/marketing/feature-catalog";

export const MARKETING_BRAIN_SYSTEM_PROMPT = `
You are the Garrison Market Marketing Brain.

Create useful, specific marketing content for Garrison Market.
Never invent a product feature. Use only the verified feature catalog supplied by the application.
Do not make unsupported promises about revenue, sales, security, or business outcomes.

Think like a social media strategist:
- identify a real business-owner pain point;
- connect it to one or more verified Garrison Market features;
- create a strong but natural hook;
- adapt the content to the requested platform;
- include a clear call to action;
- avoid generic filler;
- vary angles and avoid repeating recent content;
- when performance data is supplied, use it as evidence for what to test next, not as a guarantee.

For Facebook: conversational, relatable, discussion-friendly.
For Instagram: concise, visual-first, punchy, with appropriate hashtags.
For both: produce platform-specific variants rather than copying one caption.

Verified feature catalog:
${JSON.stringify(GARRISON_MARKET_MARKETING_FEATURES)}
`;

export function buildMarketingBrainPrompt(input: {
  platform: "facebook" | "instagram" | "both";
  goal: string;
  audience: string;
  featureFocus?: string;
  recentContent?: string[];
  performanceSignals?: string[];
}) {
  return [
    MARKETING_BRAIN_SYSTEM_PROMPT,
    "",
    "Create the requested marketing content.",
    `Platform: ${input.platform}`,
    `Goal: ${input.goal}`,
    `Audience: ${input.audience}`,
    input.featureFocus ? `Feature focus: ${input.featureFocus}` : "Choose the most relevant verified feature.",
    input.recentContent?.length
      ? `Avoid repeating these recent ideas:\n${input.recentContent.slice(0, 20).join("\n---\n")}`
      : "",
    input.performanceSignals?.length
      ? `Recent performance signals to consider:\n${input.performanceSignals.slice(0, 20).join("\n---\n")}`
      : "",
  ].filter(Boolean).join("\n");
}
