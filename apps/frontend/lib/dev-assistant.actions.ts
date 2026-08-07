// FILE: apps/frontend/lib/dev-assistant.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEV_ASSISTANT_IDENTITY } from "@/lib/dev-assistant-knowledge";
import { getDevAssistantFilesContent } from "@/lib/dev-assistant-project.actions";

/**
 * Stage 3 — the Dev Assistant is now live on Groq, same account/model as
 * "Ask Me" (see store-assistant.actions.ts) but a completely separate
 * code path, system prompt, and database table. Nothing here can leak
 * into or read from the owner/staff assistant.
 *
 * SETUP: uses the same GROQ_API_KEY env var store-assistant.actions.ts
 * already requires — no second key needed. qwen/qwen3.6-27b (the same
 * model already in use) is vision-capable, so Stage 5's image support
 * needed no new provider or key.
 *
 * CONTEXT STRATEGY ("never forget a single thing" vs. the model's context
 * window — see chat explanation): every message is stored forever in
 * DevAssistantMessage (Stage 1) and never deleted. What gets SENT to the
 * model each turn is bounded: the last MAX_HISTORY_MESSAGES verbatim,
 * plus a running summary of anything older than that (see
 * maybeSummarizeOlderMessages below). Attached file content (Stage 2's
 * uploaded project, explicitly selected by the admin per message — see
 * DEV_ASSISTANT_IDENTITY) is added on top, also capped.
 *
 * IMAGES (Stage 5): attached images are sent to the model for the current
 * turn only and are NOT persisted as image data — only a short text note
 * ("📷 attached: name.png") is saved to the message, same as the
 * attached-files note below. Storing raw image bytes in every message
 * forever would bloat the database for no lasting benefit; the code the
 * AI produces FROM the image is what's actually kept, same as everything
 * else in this file.
 */

const GROQ_MODEL = "qwen/qwen3.6-27b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000; // code-heavy messages need more room than the store assistant's 2000

// Attached files (Stage 2 project files the admin explicitly selects for
// this message) — capped so one huge attachment can't blow the request.
const MAX_SINGLE_ATTACHED_FILE_CHARS = 20_000;
const MAX_TOTAL_ATTACHED_CHARS = 45_000;
const MAX_ATTACHED_FILES_PER_MESSAGE = 8;

// Attached images (Stage 5) — Groq's vision docs cap requests at 5
// images; we cap lower since a UI screenshot rarely needs more than a
// couple to make the point, and each one adds real request size (base64
// inflates a file's byte size by roughly a third).
const MAX_IMAGES_PER_MESSAGE = 3;

// Summarization: once the thread has grown past the verbatim window,
// fold the next batch of older messages into thread.summary via a small
// extra Groq call, so a long-running conversation doesn't grow the prompt
// forever. Storage is untouched either way — see file header.
const SUMMARY_BATCH_SIZE = 10;

// ── Rate limiting ──────────────────────────────────────────────────────
// Same in-memory sliding-window pattern as store-assistant.actions.ts,
// separate map so the two features' quotas never interact.
const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestLog = new Map<number, number[]>();

function isRateLimited(adminId: number): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(adminId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(adminId, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(adminId, timestamps);
  return false;
}

export type DevAssistantChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

// Base64 data URL (e.g. "data:image/png;base64,...") plus a display name
// — never persisted, used only for the current request. See file header.
export type DevAssistantImage = {
  name: string;
  dataUrl: string;
};

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    throw new Error("Not authorized.");
  }
  return session;
}

// Finds this admin's thread, or creates it on first visit — unchanged
// from Stage 1. Same function powers "resume where I left off."
export async function getOrCreateDevAssistantThread(): Promise<{
  threadId: number;
  messages: DevAssistantChatMessage[];
}> {
  const session = await requireAdmin();

  let thread = await prisma.devAssistantThread.findUnique({
    where: { adminId: session.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!thread) {
    thread = await prisma.devAssistantThread.create({
      data: { adminId: session.id },
      include: { messages: true },
    });
  }

  return {
    threadId: thread.id,
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

// Folds older messages into thread.summary once the thread outgrows the
// verbatim window. Runs after a normal exchange, only when there's
// actually a full batch of un-summarized old messages to fold — so most
// turns skip this entirely (one cheap count query).
async function maybeSummarizeOlderMessages(threadId: number): Promise<void> {
  const thread = await prisma.devAssistantThread.findUnique({ where: { id: threadId } });
  if (!thread) return;

  const allMessages = await prisma.devAssistantMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });

  if (allMessages.length <= MAX_HISTORY_MESSAGES) return;

  const outsideWindow = allMessages.slice(0, allMessages.length - MAX_HISTORY_MESSAGES);
  const notYetSummarized = outsideWindow.filter(
    (m) => !thread.summarizedUpToId || m.id > thread.summarizedUpToId
  );

  if (notYetSummarized.length < SUMMARY_BATCH_SIZE) return;

  const batch = notYetSummarized.slice(0, SUMMARY_BATCH_SIZE);
  const transcript = batch.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const summaryPrompt = `Update the running summary of an ongoing admin/AI coding conversation.
Keep it concise (a few sentences to a short paragraph) but preserve concrete
technical facts: file paths discussed, decisions made, bugs found, code
that was written or is still pending. Merge the new messages into the
existing summary rather than just appending.

EXISTING SUMMARY:
${thread.summary || "(none yet)"}

NEW MESSAGES TO FOLD IN:
${transcript}

Return ONLY the updated summary text, nothing else.`;

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: summaryPrompt }],
        temperature: 0.2,
        max_completion_tokens: 500,
        reasoning_effort: "none",
        reasoning_format: "hidden",
      }),
    });

    if (!res.ok) return; // best-effort — a failed summary pass just means we try again next batch

    const data = await res.json();
    const newSummary: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!newSummary) return;

    await prisma.devAssistantThread.update({
      where: { id: threadId },
      data: { summary: newSummary, summarizedUpToId: batch[batch.length - 1].id },
    });
  } catch (error) {
    console.error("maybeSummarizeOlderMessages error:", error);
    // Non-fatal — history is still intact in the DB either way, this just
    // means the next batch will be a bit bigger.
  }
}

export async function sendDevAssistantMessage(
  threadId: number,
  content: string,
  attachedFileIds: number[] = [],
  images: DevAssistantImage[] = []
): Promise<
  | { success: true; reply: DevAssistantChatMessage }
  | { success: false; error: string }
> {
  const session = await requireAdmin();

  if (isRateLimited(session.id)) {
    return { success: false, error: "Too many requests — please wait a moment before sending another." };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { success: false, error: "Message can't be empty." };
  }

  const thread = await prisma.devAssistantThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.adminId !== session.id) {
    return { success: false, error: "Thread not found." };
  }

  const boundedImages = images.slice(0, MAX_IMAGES_PER_MESSAGE);

  // What actually gets stored forever — the note keeps resumed history
  // readable about what was attached, without persisting the image bytes
  // themselves or duplicating the full attached-file content in storage.
  let storedContent = trimmed.slice(0, MAX_MESSAGE_CHARS);
  if (boundedImages.length > 0) {
    storedContent += `\n\n📷 Attached image(s): ${boundedImages.map((i) => i.name).join(", ")}`;
  }

  await prisma.devAssistantMessage.create({
    data: { threadId, role: "user", content: storedContent },
  });

  // --- Build system prompt: identity + summary + attached files ---
  let systemPrompt = DEV_ASSISTANT_IDENTITY;

  if (thread.summary) {
    systemPrompt += `\n\n# Summary of earlier conversation (older messages, condensed)\n${thread.summary}`;
  }

  if (attachedFileIds.length > 0) {
    const files = await getDevAssistantFilesContent(attachedFileIds.slice(0, MAX_ATTACHED_FILES_PER_MESSAGE));
    let totalChars = 0;
    const blocks: string[] = [];
    let omitted = 0;

    for (const f of files) {
      let fileContent = f.content;
      let truncatedNote = "";
      if (fileContent.length > MAX_SINGLE_ATTACHED_FILE_CHARS) {
        fileContent = fileContent.slice(0, MAX_SINGLE_ATTACHED_FILE_CHARS);
        truncatedNote = "\n... (truncated — file is longer than the per-file limit)";
      }
      if (totalChars + fileContent.length > MAX_TOTAL_ATTACHED_CHARS) {
        omitted++;
        continue;
      }
      totalChars += fileContent.length;
      blocks.push(`// FILE: ${f.path}\n${fileContent}${truncatedNote}`);
    }

    if (blocks.length > 0) {
      systemPrompt += `\n\n# Attached files (${blocks.length})\n${blocks.join("\n\n---\n\n")}`;
    }
    if (omitted > 0) {
      systemPrompt += `\n\n(${omitted} additional attached file(s) were left out — total attached content exceeded the per-message limit. Mention this to the admin if relevant.)`;
    }
  }

  // --- Recent verbatim history (bounded window) ---
  const recentMessages = await prisma.devAssistantMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
  });
  const orderedHistory = recentMessages.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // The current turn's user message is always the last entry in
  // orderedHistory (it was stored above, before this fetch). If images
  // are attached, replace just that entry's content with the
  // OpenAI-compatible multimodal array format — text plus one or more
  // image_url blocks — instead of the plain string every other message
  // uses. Only the CURRENT turn ever includes images; past turns in
  // history are always plain text, matching what's actually stored.
  const requestMessages: { role: string; content: any }[] = [
    { role: "system", content: systemPrompt },
    ...orderedHistory,
  ];

  if (boundedImages.length > 0 && requestMessages.length > 1) {
    const lastIndex = requestMessages.length - 1;
    requestMessages[lastIndex] = {
      role: "user",
      content: [
        { type: "text", text: trimmed },
        ...boundedImages.map((img) => ({ type: "image_url", image_url: { url: img.dataUrl } })),
      ],
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000); // longer than Ask Me's 20s — code replies run longer

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: requestMessages,
        temperature: 0.2, // lower than Ask Me's 0.3 — code answers should be consistent, not chatty
        max_completion_tokens: 3000, // generous — full-file rewrites need room
        reasoning_effort: "none",
        reasoning_format: "hidden",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Groq API error (dev assistant):", res.status, errText);
      return { success: false, error: "Dev Assistant is temporarily unavailable — please try again in a moment." };
    }

    const data = await res.json();
    let reply: string | undefined = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return { success: false, error: "Dev Assistant didn't return a reply — please try rephrasing." };
    }

    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!reply) {
      return { success: false, error: "Dev Assistant didn't return a reply — please try rephrasing." };
    }

    const saved = await prisma.devAssistantMessage.create({
      data: { threadId, role: "assistant", content: reply },
    });

    await prisma.devAssistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

    // Best-effort, non-blocking-if-it-fails maintenance step. Awaited
    // (not fire-and-forget) so it still runs reliably in a serverless
    // environment, but it only does real work every SUMMARY_BATCH_SIZE
    // messages — most turns return almost immediately from the count check.
    await maybeSummarizeOlderMessages(threadId);

    return {
      success: true,
      reply: {
        id: saved.id,
        role: "assistant",
        content: saved.content,
        createdAt: saved.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("sendDevAssistantMessage error:", error);
    return { success: false, error: "Dev Assistant is temporarily unavailable — please try again in a moment." };
  }
}