import { getMarketingFeature } from "@/lib/marketing/feature-catalog";

export const MARKETING_PLATFORMS = ["facebook", "instagram", "both"] as const;

export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export function validateDraftInput(input: {
  title?: unknown;
  platform?: unknown;
  contentType?: unknown;
  body?: unknown;
  hashtags?: unknown;
  callToAction?: unknown;
  featureFocus?: unknown;
  mediaUrls?: unknown;
}) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const platform = typeof input.platform === "string" ? input.platform.trim().toLowerCase() : "";
  const contentType = typeof input.contentType === "string" ? input.contentType.trim().toLowerCase() : "post";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const callToAction = typeof input.callToAction === "string" ? input.callToAction.trim() : "";
  const featureFocus = typeof input.featureFocus === "string" ? input.featureFocus.trim() : "";

  if (!MARKETING_PLATFORMS.includes(platform as MarketingPlatform)) {
    throw new Error("Invalid platform. Use facebook, instagram, or both.");
  }

  if (!body) {
    throw new Error("Draft body is required.");
  }

  const hashtags = Array.isArray(input.hashtags)
    ? input.hashtags.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 30)
    : [];

  const mediaUrls = Array.isArray(input.mediaUrls)
    ? input.mediaUrls.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 20)
    : [];

  if (featureFocus && !getMarketingFeature(featureFocus)) {
    throw new Error("Unknown Garrison Market marketing feature.");
  }

  return {
    title: title || null,
    platform: platform as MarketingPlatform,
    contentType: contentType || "post",
    body,
    hashtags,
    callToAction: callToAction || null,
    featureFocus: featureFocus || null,
    mediaUrls,
  };
}
