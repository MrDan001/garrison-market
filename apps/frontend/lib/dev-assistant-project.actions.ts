// FILE: apps/frontend/lib/dev-assistant-project.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Stage 2 — read access to the admin's uploaded codebase. Ingestion itself
 * happens in app/api/dev-assistant/upload-project/route.ts (a regular API
 * route rather than a server action, since server actions default to a
 * 1MB body limit and zip uploads need more room). This file just lets the
 * UI list files and fetch one file's content on demand.
 */

export type DevAssistantFileSummary = {
  id: number;
  path: string;
  sizeBytes: number;
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
        select: { id: true, path: true, sizeBytes: true },
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
// codebase to the browser on page load — keeps the initial page fast even
// for a project near the file-count/size limits.
export async function getDevAssistantFileContent(
  fileId: number
): Promise<{ success: true; path: string; content: string } | { success: false; error: string }> {
  const session = await requireAdmin();

  const file = await prisma.devAssistantFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  });

  if (!file || file.project.adminId !== session.id) {
    return { success: false, error: "File not found." };
  }

  return { success: true, path: file.path, content: file.content };
}

// Fetches content for several files at once (the admin's attached-files
// selection for a single chat message) — scoped to this admin's own
// project so one admin can never pull another admin's files by guessing
// ids.
export async function getDevAssistantFilesContent(
  fileIds: number[]
): Promise<{ path: string; content: string }[]> {
  const session = await requireAdmin();
  if (fileIds.length === 0) return [];

  const files = await prisma.devAssistantFile.findMany({
    where: { id: { in: fileIds }, project: { adminId: session.id } },
    select: { path: true, content: true },
  });

  return files;
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