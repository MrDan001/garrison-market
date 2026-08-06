// FILE: apps/frontend/app/api/dev-assistant/upload-project/route.ts

import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs"; // adm-zip needs Node, not the Edge runtime

// ── Limits ──────────────────────────────────────────────────────────────
// Keeps ingestion — and later, what gets sent to the model in Stage 3 —
// bounded. A whole node_modules or a stray video file in the zip
// shouldn't be able to blow up the database or the eventual AI request.
const MAX_ZIP_BYTES = 25 * 1024 * 1024; // 25MB zip
const MAX_FILE_BYTES = 250 * 1024; // 250KB per ingested file
const MAX_TOTAL_FILES = 600;
const MAX_TOTAL_CONTENT_BYTES = 8 * 1024 * 1024; // 8MB combined across all files

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".turbo",
  "coverage", ".vercel", ".cache", "out", ".idea", ".vscode",
]);

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "css", "scss", "sass",
  "html", "md", "mdx", "txt", "yml", "yaml", "toml", "prisma", "sql",
  "graphql", "gql", "py", "rb", "go", "java", "kt", "c", "cpp", "h", "hpp",
  "php", "sh", "env", "gitignore", "nvmrc", "editorconfig", "xml",
]);

function isSkippedPath(path: string): boolean {
  return path.split("/").some((seg) => SKIP_DIR_SEGMENTS.has(seg));
}

function isTextFile(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : name.toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("zip");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No zip file received." }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `Zip is too large — max ${MAX_ZIP_BYTES / 1024 / 1024}MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid zip file." }, { status: 400 });
  }

  const entries = zip.getEntries();
  const ingested: { path: string; content: string; sizeBytes: number }[] = [];
  let totalContentBytes = 0;
  let skippedBinary = 0;
  let skippedTooLarge = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Strip the top-level folder zips commonly wrap everything in (e.g.
    // "my-repo-main/src/x.ts" -> "src/x.ts") for cleaner display paths.
    const rawPath = entry.entryName.replace(/\\/g, "/");
    const path = rawPath.includes("/") ? rawPath.slice(rawPath.indexOf("/") + 1) : rawPath;

    if (!path || isSkippedPath(rawPath)) continue;
    if (!isTextFile(path)) {
      skippedBinary++;
      continue;
    }

    const data = entry.getData();
    if (data.length > MAX_FILE_BYTES) {
      skippedTooLarge++;
      continue;
    }
    if (totalContentBytes + data.length > MAX_TOTAL_CONTENT_BYTES) break;
    if (ingested.length >= MAX_TOTAL_FILES) break;

    ingested.push({ path, content: data.toString("utf-8"), sizeBytes: data.length });
    totalContentBytes += data.length;
  }

  if (ingested.length === 0) {
    return NextResponse.json(
      { error: "No readable source files found in that zip (after skipping node_modules, binaries, etc.)." },
      { status: 400 }
    );
  }

  // Replace the admin's existing workspace, if any — one active project at
  // a time, same pattern as the single DevAssistantThread per admin.
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
    await tx.devAssistantFile.createMany({
      data: ingested.map((f) => ({ projectId: proj.id, ...f })),
    });

    return proj;
  });

  return NextResponse.json({
    success: true,
    project: { id: project.id, name: project.name, fileCount: ingested.length },
    skippedBinary,
    skippedTooLarge,
  });
}