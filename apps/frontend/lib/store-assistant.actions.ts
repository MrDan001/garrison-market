// FILE: apps/frontend/lib/store-assistant.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import { ASK_ME_IDENTITY, OWNER_KNOWLEDGE, STAFF_KNOWLEDGE } from "@/lib/store-assistant-knowledge";

/**
 * "Ask Me" — the in-app AI assistant. Runs on Groq's free tier
 * (https://console.groq.com), not Anthropic — chosen specifically because
 * it requires no card on file and stays free at this app's expected volume.
 * It's OpenAI-compatible, so this is a plain fetch, no SDK dependency needed.
 *
 * SETUP REQUIRED: add to apps/frontend/.env
 *   GROQ_API_KEY=gsk_...
 * (Sign up at console.groq.com → API Keys → Create Key. No credit card.)
 * Until that's set, askStoreAssistant() returns a friendly "not configured
 * yet" message instead of erroring, so the UI never crashes for lack of it.
 */

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Keep the request small and bounded — this is a help widget, not an open
// chat: cap how much history we forward and how long any single message
// can be, so one long-winded exchange can't balloon token usage per call.
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;

export type AskMeChatMessage = { role: "user" | "assistant"; content: string };

export async function askStoreAssistant(history: AskMeChatMessage[]) {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) {
    return { success: false as const, error: "Unauthorized" };
  }

  if (!process.env.GROQ_API_KEY) {
    return {
      success: false as const,
      error:
        "Ask Me isn't set up yet — an admin needs to add a Groq API key before this assistant can answer questions.",
    };
  }

  if (!Array.isArray(history) || history.length === 0) {
    return { success: false as const, error: "No question provided." };
  }

  const knowledge = session.role === "owner" ? OWNER_KNOWLEDGE : STAFF_KNOWLEDGE;
  const systemPrompt = `${ASK_ME_IDENTITY}\n\n# Knowledge base (${session.role})\n${knowledge}`;

  // Trim to the last N messages and clamp each message's length — keeps
  // the request bounded regardless of how long the chat has run.
  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...trimmedHistory],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Groq API error:", res.status, errText);
      return {
        success: false as const,
        error: "Ask Me is temporarily unavailable — please try again in a moment, or use Support instead.",
      };
    }

    const data = await res.json();
    const reply: string | undefined = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return {
        success: false as const,
        error: "Ask Me didn't return an answer — please try rephrasing your question.",
      };
    }

    return { success: true as const, reply: reply.trim() };
  } catch (error) {
    console.error("askStoreAssistant error:", error);
    return {
      success: false as const,
      error: "Ask Me is temporarily unavailable — please try again in a moment, or use Support instead.",
    };
  }
}