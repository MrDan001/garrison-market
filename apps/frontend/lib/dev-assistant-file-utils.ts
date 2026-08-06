// FILE: apps/frontend/lib/dev-assistant-file-utils.ts

/**
 * Pure parsing helpers — deliberately zero server-only imports (no
 * Prisma, no 'e2b', no env vars) so this file is safe to import from
 * BOTH server code (dev-assistant-sandbox.ts, download-zip/route.ts) and
 * the client component (dev-assistant-client.tsx, for the per-file
 * download buttons). Importing dev-assistant-sandbox.ts directly from
 * the client would have pulled the 'e2b' package into the browser
 * bundle — this split avoids that.
 */

export type ExtractedFile = { path: string; content: string };

// Parses the "// FILE: path" fenced-block convention (see
// DEV_ASSISTANT_IDENTITY in dev-assistant-knowledge.ts) out of an AI
// reply. Best-effort: a reply whose file content itself contains triple
// backticks could confuse this, but that's rare for real source files.
export function extractFilesFromReply(content: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const regex = /```[a-zA-Z0-9]*\n\/\/ FILE: (.+?)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].replace(/\s+$/, "") });
  }
  return files;
}