// FILE: apps/frontend/lib/admin-message.actions.ts

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { createNotification } from "./notification.actions";
import { sendAdminBroadcastEmail } from "./email";

async function getBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
}

// ============================================================================
// ADMIN — compose & send
// ============================================================================
// Fans a single message out three ways at once: the permanent AdminMessage
// row (the mailbox content itself), a Notification per targeted owner
// (bell icon + push, linking straight to /owner/messages/[id]), and an
// email via Resend. Email failures are logged and swallowed per-recipient
// — one bad address should never stop the rest of the send or roll back
// the message itself, since the in-app mailbox copy is the source of truth.
export async function sendAdminMessageAction(params: {
  subject: string;
  body: string;
  link?: string;
  imageUrl?: string;
  audience: "all_owners" | "single_owner";
  targetOwnerId?: number;
}): Promise<
  | { success: true; recipientCount: number; emailFailures: number }
  | { success: false; error: string }
> {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { success: false, error: "Unauthorized" };

  const subject = params.subject.trim();
  const body = params.body.trim();
  if (!subject || !body) return { success: false, error: "Subject and message body are required." };
  if (params.audience === "single_owner" && !params.targetOwnerId) {
    return { success: false, error: "Pick an owner to send this to." };
  }

  // Resolve recipients up front so we know the send actually has someone
  // to go to before writing anything.
  const recipients = await prisma.user.findMany({
    where:
      params.audience === "single_owner"
        ? { id: params.targetOwnerId, role: "owner" }
        : { role: "owner", status: "approved" },
    select: { id: true, email: true, fullName: true },
  });

  if (recipients.length === 0) {
    return { success: false, error: "No matching owner(s) found to send to." };
  }

  const message = await prisma.adminMessage.create({
    data: {
      subject,
      body,
      link: params.link?.trim() || null,
      imageUrl: params.imageUrl || null,
      audience: params.audience,
      targetOwnerId: params.audience === "single_owner" ? params.targetOwnerId : null,
      sentById: session.id,
    },
  });

  const baseUrl = await getBaseUrl();
  const messageUrl = `${baseUrl}/owner/messages/${message.id}`;

  // Notification for every recipient (fast, in-process) — same pattern as
  // every other notification type in the app.
  await Promise.all(
    recipients.map((owner) =>
      createNotification({
        ownerId: owner.id,
        recipientId: owner.id,
        type: "admin_message",
        message: subject,
        link: `/owner/messages/${message.id}`,
      })
    )
  );

  // Email every recipient — best-effort, one failure doesn't affect
  // anyone else's copy or the notification that already went out.
  const emailResults = await Promise.allSettled(
    recipients
      .filter((owner) => owner.email)
      .map((owner) =>
        sendAdminBroadcastEmail(owner.email, owner.fullName || "there", {
          subject,
          body,
          link: params.link?.trim() || null,
          imageUrl: params.imageUrl || null,
          messageUrl,
        })
      )
  );
  const emailFailures = emailResults.filter((r) => r.status === "rejected").length;
  if (emailFailures > 0) {
    console.error(`[admin-message] ${emailFailures}/${recipients.length} broadcast emails failed to send`);
  }

  revalidatePath("/admin/messages");

  return { success: true, recipientCount: recipients.length, emailFailures };
}

// List of owners for the admin compose screen's "single owner" picker.
export async function getOwnersForAdminPicker() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return [];

  return prisma.user.findMany({
    where: { role: "owner" },
    select: { id: true, fullName: true, storeName: true, email: true },
    orderBy: { fullName: "asc" },
  });
}

// Admin's own reference list of what's already been sent.
export async function getSentAdminMessages() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return [];

  const messages = await prisma.adminMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      targetOwner: { select: { fullName: true, storeName: true } },
      _count: { select: { reads: true } },
    },
  });

  // Recipient count per message — computed the same way sendAdminMessageAction
  // resolved it at send time (single_owner: 1, all_owners: however many
  // approved owners existed then). We only need it for a rough "X/Y read"
  // label, so a fresh count of currently-approved owners is close enough
  // even though the exact original audience could've shrunk/grown since.
  const approvedOwnerCount = await prisma.user.count({ where: { role: "owner", status: "approved" } });

  return messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    audience: m.audience,
    targetOwnerName: m.targetOwner?.fullName ?? m.targetOwner?.storeName ?? null,
    createdAt: m.createdAt,
    readCount: m._count.reads,
    recipientCount: m.audience === "single_owner" ? 1 : approvedOwnerCount,
  }));
}

// ============================================================================
// OWNER — mailbox
// ============================================================================
export async function getMessagesForOwner() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return [];

  const [messages, reads] = await Promise.all([
    prisma.adminMessage.findMany({
      where: { OR: [{ audience: "all_owners" }, { targetOwnerId: session.id }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, body: true, imageUrl: true, link: true, createdAt: true },
    }),
    prisma.adminMessageRead.findMany({
      where: { ownerId: session.id },
      select: { messageId: true },
    }),
  ]);

  const readIds = new Set(reads.map((r) => r.messageId));

  return messages.map((m) => ({
    ...m,
    preview: m.body.slice(0, 120),
    isRead: readIds.has(m.id),
  }));
}

export async function getMessageForOwner(messageId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return null;

  const message = await prisma.adminMessage.findFirst({
    where: {
      id: messageId,
      OR: [{ audience: "all_owners" }, { targetOwnerId: session.id }],
    },
  });
  if (!message) return null;

  // Mark read the moment the owner opens it — idempotent, so re-opening
  // an already-read message is a harmless no-op.
  await prisma.adminMessageRead.upsert({
    where: { messageId_ownerId: { messageId: message.id, ownerId: session.id } },
    update: {},
    create: { messageId: message.id, ownerId: session.id },
  });

  return message;
}

export async function getUnreadAdminMessageCount() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return 0;

  const [messages, reads] = await Promise.all([
    prisma.adminMessage.findMany({
      where: { OR: [{ audience: "all_owners" }, { targetOwnerId: session.id }] },
      select: { id: true },
    }),
    prisma.adminMessageRead.findMany({
      where: { ownerId: session.id },
      select: { messageId: true },
    }),
  ]);

  const readIds = new Set(reads.map((r) => r.messageId));
  return messages.filter((m) => !readIds.has(m.id)).length;
}