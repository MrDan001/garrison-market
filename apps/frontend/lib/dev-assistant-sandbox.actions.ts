// FILE: apps/frontend/lib/dev-assistant-sandbox.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { put } from "@vercel/blob";
import { DEV_ASSISTANT_IDENTITY } from "@/lib/dev-assistant-knowledge";
import { extractFilesFromReply, runFilesInSandbox, type SandboxFile } from "@/lib/dev-assistant-sandbox";
import { captureAppScreenshot } from "@/lib/dev-assistant-screenshot";

const GROQ_MODEL = "qwen/qwen3.6-27b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_ITERATIONS = 3; // generate -> run -> fix, capped so one bad loop can't burn unlimited E2B/Groq usage

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") throw new Error("Not authorized.");
  return session;
}

async function askGroqToFix(files: SandboxFile[], errorLog: string): Promise<string | null> {
  const filesBlock = files.map((f) => `// FILE: ${f.path}\n${f.content}`).join("\n\n---\n\n");
  const prompt = `The following files were just run in a sandbox and produced an error. Fix the code.
Output ONLY the corrected file(s) using the "// FILE: path" fenced-block format from your
instructions — full file content, not a diff. Include every file that needs a change; you don't
need to re-output files that don't need changes.

# Files
${filesBlock}

# Error output
${errorLog.slice(0, 6000)}`;

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: DEV_ASSISTANT_IDENTITY },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 3000,
      reasoning_effort: "none",
      reasoning_format: "hidden",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const reply: string | undefined = data?.choices?.[0]?.message?.content;
  return reply ? reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() : null;
}

export type SandboxLoopResult =
  | { success: true; iterations: number }
  | { success: false; error: string };

// Runs the "// FILE:" blocks from a specific assistant message through
// the sandbox, looping run -> (if failed) ask AI to fix -> run again, up
// to MAX_ITERATIONS times. Opt-in per message — triggered by the "Run in
// sandbox" button in the chat, never automatic — so E2B usage only
// happens when the admin actually asks for it. The outcome is appended
// to the thread as a new assistant message (so it's saved and resumes
// like everything else); the client re-fetches the thread afterward to
// display it.
export async function runDevAssistantSandbox(threadId: number, messageId: number): Promise<SandboxLoopResult> {
  const session = await requireAdmin();

  const thread = await prisma.devAssistantThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.adminId !== session.id) {
    return { success: false, error: "Thread not found." };
  }

  const message = await prisma.devAssistantMessage.findUnique({ where: { id: messageId } });
  if (!message || message.threadId !== threadId || message.role !== "assistant") {
    return { success: false, error: "That message isn't a Dev Assistant reply." };
  }

  let files = extractFilesFromReply(message.content);
  if (files.length === 0) {
    return { success: false, error: 'No "// FILE:" code blocks found in that reply to run.' };
  }

  let fullLog = "";
  let iterations = 0;
  let success = false;

  for (iterations = 1; iterations <= MAX_ITERATIONS; iterations++) {
    fullLog += `\n=== Attempt ${iterations} ===\n`;

    let outcome;
    try {
      outcome = await runFilesInSandbox(files);
    } catch (error: any) {
      fullLog += `Sandbox error: ${error?.message ?? error}\n`;
      break;
    }
    fullLog += outcome.exitLog;

    if (outcome.success) {
      success = true;
      break;
    }

    if (iterations === MAX_ITERATIONS) break;

    const fixed = await askGroqToFix(files, outcome.exitLog);
    if (!fixed) {
      fullLog += "\n(Could not get a fix from the AI — stopping.)\n";
      break;
    }
    const newFiles = extractFilesFromReply(fixed);
    if (newFiles.length === 0) {
      fullLog += "\n(AI reply had no parseable file blocks — stopping.)\n";
      break;
    }
    // Replace whichever files the AI touched, keep the rest as-is.
    const byPath = new Map<string, SandboxFile>(files.map((f: SandboxFile) => [f.path, f]));
    for (const nf of newFiles) byPath.set(nf.path, nf);
    files = Array.from(byPath.values());
  }

  const summary = success
    ? `✅ Ran successfully after ${iterations} attempt(s).\n\n${fullLog.slice(-3000)}`
    : `❌ Still failing after ${iterations} attempt(s) — here's the recent output:\n\n${fullLog.slice(-3000)}`;

  await prisma.devAssistantMessage.create({
    data: { threadId, role: "assistant", content: summary },
  });
  await prisma.devAssistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  if (success) {
    return { success: true, iterations };
  }
  return { success: false, error: `Still failing after ${iterations} attempt(s) — see the new message in chat for the full log.` };
}

export type ScreenshotLoopResult = { success: true } | { success: false; error: string };

// Boots the "// FILE:" blocks from a specific assistant message for real
// in a sandbox and captures an actual screenshot — see
// dev-assistant-screenshot.ts for the pipeline itself and its honesty
// notes. Opt-in per message, same as runDevAssistantSandbox above, since
// this spends real Daytona sandbox time (more than the build-check flow
// — installing a browser and booting a dev server takes longer). The
// screenshot is uploaded to Vercel Blob (not stored as image bytes in the
// database) and only its URL is saved in the thread, same "don't bloat
// storage with binary data" reasoning used for uploaded project files and
// attached chat images.
export async function runDevAssistantScreenshot(threadId: number, messageId: number): Promise<ScreenshotLoopResult> {
  const session = await requireAdmin();

  const thread = await prisma.devAssistantThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.adminId !== session.id) {
    return { success: false, error: "Thread not found." };
  }

  const message = await prisma.devAssistantMessage.findUnique({ where: { id: messageId } });
  if (!message || message.threadId !== threadId || message.role !== "assistant") {
    return { success: false, error: "That message isn't a Dev Assistant reply." };
  }

  const files = extractFilesFromReply(message.content);
  if (files.length === 0) {
    return { success: false, error: 'No "// FILE:" code blocks found in that reply to screenshot.' };
  }

  const outcome = await captureAppScreenshot(files);

  let summary: string;
  if (outcome.success) {
    const blob = await put(`dev-assistant-screenshots/${threadId}-${Date.now()}.png`, outcome.imageBuffer, {
      access: "public",
      contentType: "image/png",
    });
    summary = `📸 Screenshot captured (port ${outcome.port}):\n![screenshot](${blob.url})`;
  } else {
    summary = `❌ Couldn't capture a screenshot — here's what happened:\n\n${outcome.log.slice(-3000)}`;
  }

  await prisma.devAssistantMessage.create({ data: { threadId, role: "assistant", content: summary } });
  await prisma.devAssistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  return outcome.success
    ? { success: true }
    : { success: false, error: "Screenshot failed — see the new message in chat for the full log." };
}