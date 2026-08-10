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

// Alias so both dev-assistant-sandbox.ts and dev-assistant-screenshot.ts
// can import "SandboxFile" directly from this neutral file instead of
// through each other — avoids any risk of a circular/self-referential
// import between sandbox-related files.
export type SandboxFile = ExtractedFile;

// Parses the "// FILE: path" fenced-block convention (see
// DEV_ASSISTANT_IDENTITY in dev-assistant-knowledge.ts) out of an AI
// reply. Best-effort: a reply whose file content itself contains triple
// backticks could confuse this, but that's rare for real source files.
//
// Deliberately lenient about the exact spacing around "// FILE:" (some
// model replies emit "//FILE:" or a leading space/blank line before it),
// and about whether the model puts each file in its own fenced block or
// dumps several files inside one big fence — both patterns show up in
// practice, especially from smaller models on a "fix this error" prompt
// where the format instructions aren't reinforced as strongly as in the
// main system prompt.
export function extractFilesFromReply(content: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];

  // Matches a whole fenced block first, tolerating a little slack before
  // the first "// FILE:" marker (blank lines, stray whitespace) so a
  // fence isn't rejected outright just because it isn't the literal
  // first byte inside the block.
  const blockRegex = /```[a-zA-Z0-9]*\n([\s\S]*?)```/g;
  // Marks the start of one file WITHIN a block's content — tolerant of
  // "//FILE:" (no space), extra spaces, and leading whitespace/indent.
  const fileMarkerRegex = /^[ \t]*\/\/\s*FILE:\s*(.+?)\s*$/gm;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const blockBody = blockMatch[1];

    const markers: { path: string; index: number; markerEnd: number }[] = [];
    let markerMatch: RegExpExecArray | null;
    fileMarkerRegex.lastIndex = 0;
    while ((markerMatch = fileMarkerRegex.exec(blockBody)) !== null) {
      markers.push({
        path: markerMatch[1].trim(),
        index: markerMatch.index,
        markerEnd: markerMatch.index + markerMatch[0].length,
      });
    }

    // One block can contain one file (the common case) or several (a
    // smaller model dumping a whole scaffold in a single fence) — either
    // way, each marker's content runs until the next marker or the end
    // of the block.
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].markerEnd;
      const end = i + 1 < markers.length ? markers[i + 1].index : blockBody.length;
      const fileContent = blockBody.slice(start, end).replace(/^\n/, "").replace(/\s+$/, "");
      if (fileContent.length > 0) {
        files.push({ path: markers[i].path, content: fileContent });
      }
    }
  }

  return files;
}