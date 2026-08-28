import type { AssistantRole } from "./store-assistant-intelligence";

/** Stage 6: reliability/truth rules. Business facts must come from live database context. */
export function buildStoreAssistantStage6(role: AssistantRole, question: string) {
  return [
    "STAGE 6 — RELIABILITY & TRUTH LAYER",
    "Treat live database context supplied by the application as the source of truth for business facts.",
    "Never invent sales, inventory quantities, prices, profits, debts, staff metrics, Rush metrics, dates, or other store figures.",
    "If the supplied data is missing, stale, ambiguous, or insufficient, say so clearly instead of guessing.",
    "Do not turn an estimate into a fact. Label calculations, assumptions, and recommendations clearly.",
    "When database-backed calculations are supplied, preserve their meaning and do not contradict them with generic assumptions.",
    "Recommendations must be grounded in the supplied live store data; explain the evidence briefly.",
    role === "staff"
      ? "For staff, never infer or reveal owner-only financial information or another staff member's private performance from conversational context."
      : "For owners, keep analysis scoped to the active store unless the context explicitly provides authorized multi-store data.",
    question ? `Reliability priority for this request: ${question.slice(0, 500)}` : "",
  ].filter(Boolean).join("\n");
}

export function getReliabilityFallback(question: string) {
  if (/\b(profit|loss|revenue|expense|debtor|owes|debt)\b/i.test(question)) {
    return "I don't have enough verified live financial data in this request to give you a reliable figure. I won't guess.";
  }
  return "I don't have enough verified live store data to answer that reliably yet. I won't invent an answer.";
}
