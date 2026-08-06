// FILE: apps/frontend/app/api/dev-assistant/download-zip/route.ts

import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { extractFilesFromReply } from "@/lib/dev-assistant-file-utils";

export const runtime = "nodejs"; // adm-zip needs Node, same as the Stage 2 upload route

// Stage 5 — "download or package files" for a specific assistant reply.
// A regular API route (not a server action) since it needs to return
// binary data with download headers, which server actions can't do
// directly. Admin-only, and scoped to the requesting admin's own thread
// — one admin can never download another admin's generated code by
// guessing a message id.
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const messageId = body?.messageId;
  if (typeof messageId !== "number") {
    return NextResponse.json({ error: "Missing messageId." }, { status: 400 });
  }

  const message = await prisma.devAssistantMessage.findUnique({
    where: { id: messageId },
    include: { thread: true },
  });

  if (!message || message.thread.adminId !== session.id || message.role !== "assistant") {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const files = extractFilesFromReply(message.content);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No "// FILE:" blocks found in that reply.' }, { status: 400 });
  }

  const zip = new AdmZip();
  for (const f of files) {
    // AdmZip infers folders from '/' in the entry name automatically.
    zip.addFile(f.path, Buffer.from(f.content, "utf-8"));
  }

  const buffer = zip.toBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dev-assistant-files.zip"`,
      "Content-Length": String(buffer.length),
    },
  });
}