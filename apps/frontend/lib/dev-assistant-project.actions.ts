// FILE: apps/frontend/lib/dev-assistant-project.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Stage 2 — read access to the admin's uploaded codebase. Ingestion itself
 * happens in app/api/dev-assistant/upload-project/route.ts (a regular API
 * route rather than a server action, since server actions default to a
 * 1MB body limit and uploads need more room). This file just lets the UI
 * list files and fetch one file's content on demand.
 *
 * Stage 6 update: files can now be binary (images, PDFs, etc. — stored in
 * Vercel Blob, see the upload route) as well as text. Summaries now
 * include isBinary/blobUrl/mimeType so the Files tab can render an image
 * preview or a download link instead of assuming everything is source
 * code.
 */

export type DevAssistantFileSummary = {
  id: number;
  path: string;
  sizeBytes: number;
  isBinary: boolean;
  blobUrl: string | null;
  mimeType: string | null;
};

export type DevAssistantProjectSummary = {
  id: number;
  name: string;
  fileCount: number;
  updatedAt: string;
  files: DevAssistantFileSummary[];
} | null;

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    throw new Error("Not authorized.");
  }
  return session;
}

export async function getDevAssistantProject(): Promise<DevAssistantProjectSummary> {
  const session = await requireAdmin();

  const project = await prisma.devAssistantProject.findUnique({
    where: { adminId: session.id },
    include: {
      files: {
        select: { id: true, path: true, sizeBytes: true, isBinary: true, blobUrl: true, mimeType: true },
        orderBy: { path: "asc" },
      },
    },
  });

  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    fileCount: project.fileCount,
    updatedAt: project.updatedAt.toISOString(),
    files: project.files,
  };
}

// Content is fetched lazily, per file, rather than shipping the entire
// codebase to the browser on page load. For binary files, "content" is
// never sent (it isn't stored here at all) — the caller gets isBinary +
// blobUrl instead and renders/download from Blob directly.
export async function getDevAssistantFileContent(fileId: number): Promise<
  | { success: true; path: string; isBinary: false; content: string }
  | { success: true; path: string; isBinary: true; blobUrl: string; mimeType: string | null }
  | { success: false; error: string }
> {
  const session = await requireAdmin();

  const file = await prisma.devAssistantFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  });

  if (!file || file.project.adminId !== session.id) {
    return { success: false, error: "File not found." };
  }

  if (file.isBinary) {
    return { success: true, path: file.path, isBinary: true, blobUrl: file.blobUrl!, mimeType: file.mimeType };
  }
  return { success: true, path: file.path, isBinary: false, content: file.content ?? "" };
}

// Fetches TEXT content for several files at once (the admin's
// attached-files selection for a single chat message). Binary files are
// silently excluded — there's no text content to inject into the model's
// context for them (chat attachment is text-only; binary files are
// viewed/downloaded from the Files tab instead, and the attach-file
// picker in chat only lists text files in the first place).
export async function getDevAssistantFilesContent(
  fileIds: number[]
): Promise<{ path: string; content: string }[]> {
  const session = await requireAdmin();
  if (fileIds.length === 0) return [];

  const files = await prisma.devAssistantFile.findMany({
    where: { id: { in: fileIds }, project: { adminId: session.id }, isBinary: false },
    select: { path: true, content: true },
  });

  return files.map((f) => ({ path: f.path, content: f.content ?? "" }));
}

export async function deleteDevAssistantProject(): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await requireAdmin();

  const project = await prisma.devAssistantProject.findUnique({ where: { adminId: session.id } });
  if (!project) return { success: true };

  await prisma.devAssistantProject.delete({ where: { id: project.id } });
  return { success: true };
}