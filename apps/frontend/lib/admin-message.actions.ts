// FILE: apps/frontend/lib/admin-message.actions.ts

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { createNotification } from "./notification.actions";
import { createAdminNotification } from "./admin-notification.actions";
import { sendAdminBroadcastEmail, sendAdminMessageReplyEmail, getAdminMessageReplyAddress } from "./email";

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
  | { success: true; messageId: number; recipientCount: number; emailFailures: number }
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
          replyTo: getAdminMessageReplyAddress(message.id, owner.id),
        })
      )
  );
  const emailFailures = emailResults.filter((r) => r.status === "rejected").length;
  if (emailFailures > 0) {
    console.error(`[admin-message] ${emailFailures}/${recipients.length} broadcast emails failed to send`);
  }

  revalidatePath("/admin/messages");

  return { success: true, messageId: message.id, recipientCount: recipients.length, emailFailures };
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

  // Pull every reply for these messages in one query, then reduce down to
  // "how many distinct owner-threads on this message are waiting on an
  // admin response" — i.e. threads whose most recent entry was from the
  // owner. That's the number worth badging in the list.
  const replies = await prisma.adminMessageReply.findMany({
    where: { messageId: { in: messages.map((m) => m.id) } },
    orderBy: { createdAt: "asc" },
    select: { messageId: true, ownerId: true, authorRole: true },
  });

  const lastByThread = new Map<string, "admin" | "owner">();
  const replyCountByMessage = new Map<number, number>();
  for (const r of replies) {
    lastByThread.set(`${r.messageId}:${r.ownerId}`, r.authorRole as "admin" | "owner");
    replyCountByMessage.set(r.messageId, (replyCountByMessage.get(r.messageId) || 0) + 1);
  }
  const pendingByMessage = new Map<number, number>();
  for (const [key, lastRole] of lastByThread) {
    if (lastRole !== "owner") continue;
    const messageId = parseInt(key.split(":")[0], 10);
    pendingByMessage.set(messageId, (pendingByMessage.get(messageId) || 0) + 1);
  }

  return messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    audience: m.audience,
    targetOwnerName: m.targetOwner?.fullName ?? m.targetOwner?.storeName ?? null,
    createdAt: m.createdAt,
    readCount: m._count.reads,
    recipientCount: m.audience === "single_owner" ? 1 : approvedOwnerCount,
    replyCount: replyCountByMessage.get(m.id) || 0,
    pendingReplyCount: pendingByMessage.get(m.id) || 0,
  }));
}

// ============================================================================
// ADMIN — reply threads
// ============================================================================
// A single AdminMessage (especially an "all_owners" broadcast) can carry a
// separate reply thread per owner. These actions let admin see who's
// replied on a given message and hold a back-and-forth with any one of them
// — same conversation the owner sees (and can keep replying to) by email.

export async function getAdminMessageWithRecipients(messageId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;

  const message = await prisma.adminMessage.findUnique({ where: { id: messageId } });
  if (!message) return null;

  const recipients = await prisma.user.findMany({
    where:
      message.audience === "single_owner"
        ? { id: message.targetOwnerId ?? -1 }
        : { role: "owner", status: "approved" },
    select: { id: true, fullName: true, storeName: true, email: true },
    orderBy: { fullName: "asc" },
  });

  const replies = await prisma.adminMessageReply.findMany({
    where: { messageId },
    orderBy: { createdAt: "asc" },
    select: { ownerId: true, authorRole: true, createdAt: true },
  });

  const byOwner = new Map<number, typeof replies>();
  for (const r of replies) {
    if (!byOwner.has(r.ownerId)) byOwner.set(r.ownerId, []);
    byOwner.get(r.ownerId)!.push(r);
  }

  const threads = recipients.map((owner) => {
    const ownerReplies = byOwner.get(owner.id) || [];
    const last = ownerReplies[ownerReplies.length - 1];
    return {
      ownerId: owner.id,
      ownerName: owner.fullName || owner.storeName || owner.email,
      replyCount: ownerReplies.length,
      lastReplyAt: last?.createdAt ?? null,
      needsReply: last ? last.authorRole === "owner" : false,
    };
  });

  // Threads with activity float to the top, most recently active first;
  // untouched recipients follow, alphabetically (already sorted that way).
  threads.sort((a, b) => {
    if (a.lastReplyAt && b.lastReplyAt) return b.lastReplyAt.getTime() - a.lastReplyAt.getTime();
    if (a.lastReplyAt) return -1;
    if (b.lastReplyAt) return 1;
    return 0;
  });

  return {
    message: {
      id: message.id,
      subject: message.subject,
      body: message.body,
      audience: message.audience,
      createdAt: message.createdAt,
    },
    threads,
  };
}

export async function getAdminMessageThread(messageId: number, ownerId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;

  const [message, owner, replies] = await Promise.all([
    prisma.adminMessage.findUnique({
      where: { id: messageId },
      select: { id: true, subject: true, body: true, createdAt: true },
    }),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, fullName: true, storeName: true, email: true },
    }),
    prisma.adminMessageReply.findMany({
      where: { messageId, ownerId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!message || !owner) return null;

  return { message, owner, replies };
}

export async function sendAdminReplyAction(
  messageId: number,
  ownerId: number,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { success: false, error: "Unauthorized" };

  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: "Reply can't be empty." };

  const [message, owner] = await Promise.all([
    prisma.adminMessage.findUnique({ where: { id: messageId }, select: { id: true, subject: true } }),
    prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, email: true, fullName: true, role: true } }),
  ]);
  if (!message) return { success: false, error: "Message not found." };
  if (!owner || owner.role !== "owner") return { success: false, error: "Owner not found." };

  await prisma.adminMessageReply.create({
    data: { messageId, ownerId, authorRole: "admin", body: trimmed },
  });

  const baseUrl = await getBaseUrl();
  const messageUrl = `${baseUrl}/owner/messages/${messageId}`;

  await createNotification({
    ownerId: owner.id,
    recipientId: owner.id,
    type: "admin_message",
    message: `New reply: ${message.subject}`,
    link: `/owner/messages/${messageId}`,
  });

  if (owner.email) {
    await sendAdminMessageReplyEmail(owner.email, {
      recipientFirstName: owner.fullName?.split(" ")[0] || "there",
      authorLabel: "Garrison Market Support",
      subject: message.subject,
      body: trimmed,
      messageUrl,
      replyTo: getAdminMessageReplyAddress(messageId, ownerId),
    }).catch((err) => console.error("[admin-message] reply email failed:", err));
  }

  revalidatePath(`/admin/messages/${messageId}`);
  revalidatePath(`/owner/messages/${messageId}`);

  return { success: true };
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

// Owner's side of the reply thread for one message — pairs with
// getMessageForOwner (which already verifies access + marks read) and adds
// the back-and-forth for that owner's specific thread on this message.
export async function getOwnerMessageThread(messageId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return null;

  const message = await getMessageForOwner(messageId);
  if (!message) return null;

  const replies = await prisma.adminMessageReply.findMany({
    where: { messageId, ownerId: session.id },
    orderBy: { createdAt: "asc" },
  });

  return { message, replies };
}

export async function sendOwnerReplyAction(
  messageId: number,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false, error: "Unauthorized" };

  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: "Reply can't be empty." };

  const message = await prisma.adminMessage.findFirst({
    where: {
      id: messageId,
      OR: [{ audience: "all_owners" }, { targetOwnerId: session.id }],
    },
    select: { id: true, subject: true },
  });
  if (!message) return { success: false, error: "Message not found." };

  await prisma.adminMessageReply.create({
    data: { messageId, ownerId: session.id, authorRole: "owner", body: trimmed },
  });

  // Surfaces the reply to admin (bell + push) instead of relying on them to
  // notice pendingReplyCount next time they happen to open the thread list.
  // Wrapped so a failure here can never fail the reply itself.
  try {
    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { fullName: true, storeName: true },
    });
    await createAdminNotification({
      type: "email_awaiting_reply",
      message: `${owner?.fullName || owner?.storeName || "An owner"} replied to "${message.subject}" and is awaiting a response.`,
      link: `/admin/messages/${messageId}`,
    });
  } catch (err) {
    console.error("[sendOwnerReplyAction] admin notification failed", err);
  }

  revalidatePath(`/owner/messages/${messageId}`);
  revalidatePath(`/admin/messages/${messageId}`);

  return { success: true };
}