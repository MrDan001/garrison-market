import { describe, expect, it } from "vitest";
import { checkStoreAssistantStage3 } from "./store-assistant-stage3";

describe("Ask Me Stage 3 staff access policy", () => {
  it.each([
    "What is our revenue this month?",
    "Show me the cash position.",
    "How much profit did the business make?",
    "What are the expenses?",
    "Give me the gross margin.",
    "How much do customers owe?",
  ])("blocks rephrased owner financial request: %s", (question) => {
    const access = checkStoreAssistantStage3("staff", question);
    expect(access.allowed).toBe(false);
  });

  it("allows a staff member to ask about their own sales", () => {
    expect(checkStoreAssistantStage3("staff", "How did I perform this week?").allowed).toBe(true);
    expect(checkStoreAssistantStage3("staff", "What were my sales today?").allowed).toBe(true);
  });

  it.each([
    "Who is our best staff?",
    "Which staff member sold the most?",
    "Rank the team by performance.",
    "Compare staff attendance.",
  ])("blocks private peer-staff request: %s", (question) => {
    const access = checkStoreAssistantStage3("staff", question);
    expect(access.allowed).toBe(false);
  });

  it("allows owners to access store-wide financial questions", () => {
    expect(checkStoreAssistantStage3("owner", "What is our revenue this month?").allowed).toBe(true);
    expect(checkStoreAssistantStage3("owner", "How much do customers owe?").allowed).toBe(true);
  });
});
