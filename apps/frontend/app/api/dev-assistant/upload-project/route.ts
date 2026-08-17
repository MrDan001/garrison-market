// FILE: apps/frontend/app/api/dev-assistant/upload-project/route.ts

import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { put } from "@vercel/blob";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs"; // adm-zip needs Node, not the Edge runtime

/**
 * Stage 6 update: this route now accepts EITHER a .zip archive (unpacked
 * as before) OR a single loose file (stored as-is, no unzipping needed).
 * It also no longer restricts by extension — instead it sniffs each
 * file's actual bytes for a null byte, which is a reliable, well-known
 * signal that a file is NOT text (real text files essentially never
 * contain a null byte; binary formats almost always do somewhere in
 * their header). Extension whitelists always end up either too strict
 * (rejecting a legitimate file type nobody thought to list) or too loose
 * — sniffing the actual bytes avoids both problems.
 *
 * Binary files (images, PDFs, fonts, etc.) are stored in Vercel Blob —
 * the same storage already used elsewhere in this app — rather than the
 * database, since a text column can't hold binary data without
 * corrupting it. Text files are stored directly as before.
 */

// ── Limits ──────────────────────────────────────────────────────────────
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB for the whole upload (zip or single file)
const MAX_TEXT_FILE_BYTES = 250 * 1024; // 250KB per text file stored in the DB
const MAX_BINARY_FILE_BYTES = 15 * 1024 * 1024; // 15MB per binary file stored in Blob
const MAX_TOTAL_FILES = 600;
const MAX_TOTAL_TEXT_CONTENT_BYTES = 8 * 1024 * 1024; // 8MB combined across all text files

// SECURITY: adm-zip 0.6.0 (pinned in package.json) already fixes
// CVE-2026-39244, the unbounded Buffer.alloc() from a forged size header —
// it now bounds allocation to the compressed bytes actually present. That
// closes the "tiny file declares 4GB" case, but a *real* high-ratio
// DEFLATE entry (highly repetitive content can compress well over
// 1000:1) can still legitimately decompress far past what this app ever
// needs, and the existing MAX_BINARY_FILE_BYTES/MAX_TEXT_FILE_BYTES checks
// below only run on `data.length` *after* entry.getData() has already
// decompressed the whole thing into memory. Reading the entry's declared
// uncompressed size from the central directory header — before calling
// getData() — lets an oversized entry be skipped without ever paying for
// the decompression. A generous combined ceiling across all entries in
// the archive guards against many entries that each pass the per-entry
// check individually but would sum to an excessive total.
const MAX_DECLARED_ENTRY_BYTES = MAX_BINARY_FILE_BYTES; // 15MB — the larger of the two post-decompression caps
const MAX_TOTAL_DECLARED_BYTES = 200 * 1024 * 1024; // 200MB combined declared size across the whole archive — well above any realistic codebase-context upload, just a hard ceiling on worst-case memory use

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".turbo",
  "coverage", ".vercel", ".cache", "out", ".idea", ".vscode",
]);

// Archive formats are skipped outright rather than treated as binary
// blobs to store — a zip-inside-a-zip isn't useful project context, and
// nesting AdmZip recursively is more complexity than this needs.
const SKIP_EXTENSIONS = new Set(["zip", "tar", "gz", "rar", "7z"]);

function isSkippedPath(path: string): boolean {
  return path.split("/").some((seg) => SKIP_DIR_SEGMENTS.has(seg));
}

function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

// The actual binary/text decision — checks the first chunk of real bytes
// for a null byte rather than trusting the filename. See file header.
function looksBinary(buf: Buffer): boolean {
  const sampleLength = Math.min(buf.length, 8000);
  for (let i = 0; i < sampleLength; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp",
    pdf: "application/pdf",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
    mp3: "audio/mpeg", mp4: "video/mp4", wav: "audio/wav", webm: "video/webm",
  };
  return map[ext] ?? "application/octet-stream";
}

type IngestedFile =
  | { path: string; isBinary: false; content: string; sizeBytes: number }
  | { path: string; isBinary: true; buffer: Buffer; mimeType: string; sizeBytes: number };

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("zip"); // field name kept for compatibility with the existing client — holds either a zip or a single loose file now

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Upload is too large — max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isZip = file.name.toLowerCase().endsWith(".zip");

  // Collect raw (path, bytes) pairs first — from either the zip's entries
  // or the single uploaded file — before deciding binary vs. text so both
  // paths share the same downstream logic.
  const rawEntries: { path: string; data: Buffer }[] = [];
  let skippedDeclaredTooLarge = 0;

  if (isZip) {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: "That doesn't look like a valid zip file." }, { status: 400 });
    }
    let totalDeclaredBytes = 0;
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const rawPath = entry.entryName.replace(/\\/g, "/");
      // Strip the top-level folder zips commonly wrap everything in.
      const path = rawPath.includes("/") ? rawPath.slice(rawPath.indexOf("/") + 1) : rawPath;
      if (!path || isSkippedPath(rawPath)) continue;

      // SECURITY: check the declared uncompressed size BEFORE decompressing
      // — see the MAX_DECLARED_ENTRY_BYTES comment above.
      const declaredSize = entry.header.size;
      if (declaredSize > MAX_DECLARED_ENTRY_BYTES) {
        skippedDeclaredTooLarge++;
        continue;
      }
      totalDeclaredBytes += declaredSize;
      if (totalDeclaredBytes > MAX_TOTAL_DECLARED_BYTES) {
        return NextResponse.json(
          { error: "This archive's contents are too large once decompressed. Try a smaller project." },
          { status: 400 }
        );
      }

      rawEntries.push({ path, data: entry.getData() });
    }
  } else {
    // Single loose file — no unzipping, just the file itself at the root.
    rawEntries.push({ path: file.name, data: buffer });
  }

  const ingested: IngestedFile[] = [];
  let totalTextBytes = 0;
  let skippedArchive = 0;
  let skippedTooLarge = 0;

  for (const { path, data } of rawEntries) {
    if (ingested.length >= MAX_TOTAL_FILES) break;

    const ext = extensionOf(path);
    if (SKIP_EXTENSIONS.has(ext)) {
      skippedArchive++;
      continue;
    }

    if (looksBinary(data)) {
      if (data.length > MAX_BINARY_FILE_BYTES) {
        skippedTooLarge++;
        continue;
      }
      ingested.push({ path, isBinary: true, buffer: data, mimeType: guessMimeType(ext), sizeBytes: data.length });
    } else {
      if (data.length > MAX_TEXT_FILE_BYTES) {
        skippedTooLarge++;
        continue;
      }
      if (totalTextBytes + data.length > MAX_TOTAL_TEXT_CONTENT_BYTES) continue;
      totalTextBytes += data.length;
      ingested.push({ path, isBinary: false, content: data.toString("utf-8"), sizeBytes: data.length });
    }
  }

  if (ingested.length === 0) {
    return NextResponse.json(
      { error: "No usable files found in that upload after filtering." },
      { status: 400 }
    );
  }

  // Replace the admin's existing workspace, if any — one active project
  // at a time, same pattern as the single DevAssistantThread per admin.
  const project = await prisma.$transaction(async (tx) => {
    const existing = await tx.devAssistantProject.findUnique({ where: { adminId: session.id } });
    const proj = existing
      ? await tx.devAssistantProject.update({
          where: { id: existing.id },
          data: { name: file.name, fileCount: ingested.length, updatedAt: new Date() },
        })
      : await tx.devAssistantProject.create({
          data: { adminId: session.id, name: file.name, fileCount: ingested.length },
        });
    await tx.devAssistantFile.deleteMany({ where: { projectId: proj.id } });
    return proj;
  });

  // Binary files upload to Blob outside the transaction (network calls
  // don't belong inside a DB transaction), then all rows are written
  // together at the end.
  const rows: {
    projectId: number;
    path: string;
    content: string | null;
    isBinary: boolean;
    blobUrl: string | null;
    mimeType: string | null;
    sizeBytes: number;
  }[] = [];

  for (const f of ingested) {
    if (f.isBinary) {
      const blob = await put(`dev-assistant-uploads/${project.id}/${f.path}`, f.buffer, {
        access: "public",
        contentType: f.mimeType,
      });
      rows.push({
        projectId: project.id,
        path: f.path,
        content: null,
        isBinary: true,
        blobUrl: blob.url,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
      });
    } else {
      rows.push({
        projectId: project.id,
        path: f.path,
        content: f.content,
        isBinary: false,
        blobUrl: null,
        mimeType: null,
        sizeBytes: f.sizeBytes,
      });
    }
  }

  await prisma.devAssistantFile.createMany({ data: rows });

  return NextResponse.json({
    success: true,
    project: { id: project.id, name: project.name, fileCount: ingested.length },
    binaryCount: ingested.filter((f) => f.isBinary).length,
    textCount: ingested.filter((f) => !f.isBinary).length,
    skippedArchive,
    skippedTooLarge: skippedTooLarge + skippedDeclaredTooLarge,
  });
}