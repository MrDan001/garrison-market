// Client-safe constants for wastage reasons — kept separate from
// scale-wastage.actions.ts because that file has "use server" at the
// top, and Next.js only allows async function exports from such files
// (plain consts/objects are rejected at build time).

export const WASTAGE_REASONS = ["trimming", "spillage", "spoilage", "sample", "other"] as const;
export type WastageReason = (typeof WASTAGE_REASONS)[number];

export const WASTAGE_REASON_LABELS: Record<WastageReason, string> = {
  trimming: "Trimming",
  spillage: "Spillage",
  spoilage: "Spoilage",
  sample: "Sample / Taste Test",
  other: "Other",
};