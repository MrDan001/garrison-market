// FILE: apps/frontend/lib/admin-message.actions.ts

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { createNotification } from "./notification.actions";
import { createAdminNotification } from "./admin-notification.actions";
import { sendAdminBroadcastEmail, sendAdminMessageReplyEmail, getAdminMessageReplyAddress } from "./email";
import { stripMessageLinksForPreview } from "./message-links";

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
// row (the mailbox content itself), a Notification per targeted recipient
// (bell icon + push, linking straight to their mailbox), and an email via
// Resend. Email failures are logged and swallowed per-recipient — one bad
// address should never stop the rest of the send or roll back the message
// itself, since the in-app mailbox copy is the source of truth.
//
// Two public entry points sit below this — sendAdminMessageToOwnersAction
// and sendAdminMessageToStaffAction — one per admin compose route, per
// product decision (a deliberate "Send to Owners" vs "Send to Staff" split
// rather than one combined picker). Both funnel through this shared helper
// so the AdminMessage row, notification, and email logic never drifts
// between the two routes.
type SendAudience = "all_owners" | "single_owner" | "all_staff" | "single_staff";
type SendChannel = "popup" | "email";

async function sendAdminMessage(
  session: { id: number },
  params: {
    subject: string;
    body: string;
    link?: string;
    imageUrl?: string;
    audience: SendAudience;
    targetOwnerId?: number;
    targetStaffId?: number;
    channel: SendChannel;
  }
): Promise<
  | { success: true; messageId: number; recipientCount: number; emailFailures: number }
  | { success: false; error: string }
> {
  const subject = params.subject.trim();
  const body = params.body.trim();
  if (!subject || !body) return { success: false, error: "Subject and message body are required." };
  if (params.audience === "single_owner" && !params.targetOwnerId) {
    return { success: false, error: "Pick an owner to send this to." };
  }
  if (params.audience === "single_staff" && !params.targetStaffId) {
    return { success: false, error: "Pick a staff member to send this to." };
  }

  const isStaffSend = params.audience === "all_staff" || params.audience === "single_staff";

  // Email channel is owner-only — staff has no reply/email thread concept.
  // The staff compose route never passes "email" (it forces "popup" below),
  // but guard here too in case that ever changes upstream.
  if (params.channel === "email" && isStaffSend) {
    return { success: false, error: "Email isn't available for staff — use Pop-up instead." };
  }

  // Resolve recipients up front so we know the send actually has someone
  // to go to before writing anything. Staff recipients also need the
  // business owner they belong to (ownerId) so their notification lands
  // in the right owner-scope, per createNotification's requirements.
  const recipients = await prisma.user.findMany({
    where:
      params.audience === "single_owner"
        ? { id: params.targetOwnerId, role: "owner" }
        : params.audience === "single_staff"
        ? { id: params.targetStaffId, role: "staff" }
        : isStaffSend
        ? { role: "staff", status: "approved" }
        : { role: "owner", status: "approved" },
    select: { id: true, email: true, fullName: true, ownerId: true },
  });

  if (recipients.length === 0) {
    return {
      success: false,
      error: isStaffSend ? "No matching staff member(s) found to send to." : "No matching owner(s) found to send to.",
    };
  }

  const message = await prisma.adminMessage.create({
    data: {
      subject,
      body,
      link: params.link?.trim() || null,
      imageUrl: params.imageUrl || null,
      audience: params.audience,
      targetOwnerId: params.audience === "single_owner" ? params.targetOwnerId : null,
      targetStaffId: params.audience === "single_staff" ? params.targetStaffId : null,
      channel: params.channel,
      sentById: session.id,
    },
  });

  const baseUrl = await getBaseUrl();
  const mailboxSegment = isStaffSend ? "staff" : "owner";
  const messageUrl = `${baseUrl}/${mailboxSegment}/messages/${message.id}`;
  const messageLink = `/${mailboxSegment}/messages/${message.id}`;

  // Notification for every recipient (fast, in-process) — same pattern as
  // every other notification type in the app. For staff, ownerId scopes
  // the notification to the business they belong to while recipientId
  // keeps it targeted at that one staff member's bell — it never fans out
  // to the rest of that owner's team.
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        ownerId: isStaffSend ? recipient.ownerId ?? recipient.id : recipient.id,
        recipientId: recipient.id,
        type: "admin_message",
        message: subject,
        link: messageLink,
      })
    )
  );

  // Email every recipient — best-effort, one failure doesn't affect
  // anyone else's copy or the notification that already went out.
  // Popup-channel messages are info-only: no email, so skip this block
  // entirely rather than sending an email nobody's meant to reply to.
  let emailFailures = 0;
  if (params.channel === "email") {
    const emailResults = await Promise.allSettled(
      recipients
        .filter((recipient) => recipient.email)
        .map((recipient) =>
          sendAdminBroadcastEmail(recipient.email, recipient.fullName || "there", {
            subject,
            body,
            link: params.link?.trim() || null,
            imageUrl: params.imageUrl || null,
            messageUrl,
            replyTo: getAdminMessageReplyAddress(message.id, recipient.id),
            baseUrl,
          })
        )
    );
    emailFailures = emailResults.filter((r) => r.status === "rejected").length;
    if (emailFailures > 0) {
      console.error(`[admin-message] ${emailFailures}/${recipients.length} broadcast emails failed to send`);
    }
  }

  revalidatePath("/admin/messages");
  revalidatePath("/admin/messages/staff");

  return { success: true, messageId: message.id, recipientCount: recipients.length, emailFailures };
}

// Route 1 — admin/messages (Send to Owners). Kept as its own named action
// (rather than one shared action taking an audience of all four values)
// so each compose route can only ever address the audience it's meant to.
export async function sendAdminMessageToOwnersAction(params: {
  subject: string;
  body: string;
  link?: string;
  imageUrl?: string;
  audience: "all_owners" | "single_owner";
  targetOwnerId?: number;
  channel: "popup" | "email";
}) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { success: false as const, error: "Unauthorized" };
  return sendAdminMessage(session, params);
}

// Route 2 — admin/messages/staff (Send to Staff). Always forced to the
// "popup" channel here, regardless of what's passed in — staff has no
// email/reply thread, so this route never offers that choice in the UI.
export async function sendAdminMessageToStaffAction(params: {
  subject: string;
  body: string;
  link?: string;
  imageUrl?: string;
  audience: "all_staff" | "single_staff";
  targetStaffId?: number;
}) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { success: false as const, error: "Unauthorized" };
  return sendAdminMessage(session, { ...params, channel: "popup" });
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

// List of staff for the admin compose screen's "single staff" picker —
// storeName comes from the owner they belong to, since staff accounts
// don't carry their own storeName.
export async function getStaffForAdminPicker() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return [];

  const staff = await prisma.user.findMany({
    where: { role: "staff" },
    select: { id: true, fullName: true, email: true, owner: { select: { storeName: true } } },
    orderBy: { fullName: "asc" },
  });

  return staff.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    email: s.email,
    storeName: s.owner?.storeName ?? null,
  }));
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
      targetStaff: { select: { fullName: true, email: true } },
      _count: { select: { reads: true, acks: true } },
    },
  });

  // Recipient count per message — computed the same way sendAdminMessage
  // resolved it at send time (single_*: 1, all_*: however many approved
  // owners/staff existed then). We only need it for a rough "X/Y read"
  // label, so a fresh count of currently-approved accounts is close enough
  // even though the exact original audience could've shrunk/grown since.
  const approvedOwnerCount = await prisma.user.count({ where: { role: "owner", status: "approved" } });
  const approvedStaffCount = await prisma.user.count({ where: { role: "staff", status: "approved" } });

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
    channel: m.channel,
    targetOwnerName: m.targetOwner?.fullName ?? m.targetOwner?.storeName ?? null,
    targetStaffName: m.targetStaff?.fullName ?? m.targetStaff?.email ?? null,
    createdAt: m.createdAt,
    readCount: m._count.reads,
    ackCount: m._count.acks,
    recipientCount:
      m.audience === "single_owner" || m.audience === "single_staff"
        ? 1
        : m.audience === "all_staff"
        ? approvedStaffCount
        : approvedOwnerCount,
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
      channel: message.channel,
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
      select: { id: true, subject: true, body: true, channel: true, createdAt: true },
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
    prisma.adminMessage.findUnique({ where: { id: messageId }, select: { id: true, subject: true, channel: true } }),
    prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, email: true, fullName: true, role: true } }),
  ]);
  if (!message) return { success: false, error: "Message not found." };
  if (!owner || owner.role !== "owner") return { success: false, error: "Owner not found." };
  if (message.channel !== "email") return { success: false, error: "Pop-up messages aren't repliable." };

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

  const [messages, reads, acks] = await Promise.all([
    prisma.adminMessage.findMany({
      where: { OR: [{ audience: "all_owners" }, { targetOwnerId: session.id }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, body: true, imageUrl: true, link: true, channel: true, createdAt: true },
    }),
    prisma.adminMessageRead.findMany({
      where: { ownerId: session.id },
      select: { messageId: true },
    }),
    prisma.adminMessageAck.findMany({
      where: { userId: session.id },
      select: { messageId: true },
    }),
  ]);

  const readIds = new Set(reads.map((r) => r.messageId));
  const ackedIds = new Set(acks.map((a) => a.messageId));

  return messages.map((m) => ({
    ...m,
    preview: stripMessageLinksForPreview(m.body).slice(0, 120),
    isRead: readIds.has(m.id),
    isAcknowledged: ackedIds.has(m.id),
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

  const ack = await prisma.adminMessageAck.findUnique({
    where: { messageId_userId: { messageId: message.id, userId: session.id } },
  });

  return { ...message, isAcknowledged: !!ack };
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
    select: { id: true, subject: true, channel: true },
  });
  if (!message) return { success: false, error: "Message not found." };
  if (message.channel !== "email") return { success: false, error: "Pop-up messages aren't repliable." };

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

// ============================================================================
// STAFF — mailbox
// ============================================================================
// Mirrors the owner mailbox above, minus the reply-thread feature (not part
// of the staff flow) and minus a separate "read" concept — staff only ever
// have the one acknowledgment state, set exclusively via
// acknowledgeAdminMessageAction (from the pop-up). Opening the detail page
// does NOT auto-acknowledge, unlike the owner's auto-read-on-open — a staff
// member can read the full message and still leave it pending until they
// deliberately hit "Acknowledged".
export async function getMessagesForStaff() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") return [];

  const [messages, acks] = await Promise.all([
    prisma.adminMessage.findMany({
      where: { OR: [{ audience: "all_staff" }, { targetStaffId: session.id }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, body: true, imageUrl: true, link: true, channel: true, createdAt: true },
    }),
    prisma.adminMessageAck.findMany({
      where: { userId: session.id },
      select: { messageId: true },
    }),
  ]);

  const ackedIds = new Set(acks.map((a) => a.messageId));

  return messages.map((m) => ({
    ...m,
    preview: stripMessageLinksForPreview(m.body).slice(0, 120),
    isAcknowledged: ackedIds.has(m.id),
  }));
}

export async function getMessageForStaff(messageId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") return null;

  const message = await prisma.adminMessage.findFirst({
    where: {
      id: messageId,
      OR: [{ audience: "all_staff" }, { targetStaffId: session.id }],
    },
  });
  if (!message) return null;

  const ack = await prisma.adminMessageAck.findUnique({
    where: { messageId_userId: { messageId: message.id, userId: session.id } },
  });

  return { ...message, isAcknowledged: !!ack };
}

// ============================================================================
// RECIPIENT — acknowledgment (owner OR staff)
// ============================================================================
// The explicit "Acknowledged" action fired from the pop-up modal. Idempotent
// — clicking twice, or acknowledging a message already acknowledged, is a
// harmless no-op. Writing this row is what closes the pop-up for good and
// what the recipient's Messages list uses to show the message as
// acknowledged, per the "acknowledge -> moves into Messages" flow.
export async function acknowledgeAdminMessageAction(
  messageId: number
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) {
    return { success: false, error: "Unauthorized" };
  }

  const message = await prisma.adminMessage.findFirst({
    where: {
      id: messageId,
      OR:
        session.role === "owner"
          ? [{ audience: "all_owners" }, { targetOwnerId: session.id }]
          : [{ audience: "all_staff" }, { targetStaffId: session.id }],
    },
    select: { id: true },
  });
  if (!message) return { success: false, error: "Message not found." };

  await prisma.adminMessageAck.upsert({
    where: { messageId_userId: { messageId: message.id, userId: session.id } },
    update: {},
    create: { messageId: message.id, userId: session.id },
  });

  // The owner mailbox also tracks "read" separately (auto-marked when the
  // detail page is opened, see getMessageForOwner). Acknowledging straight
  // from the pop-up — without ever opening the detail page — should still
  // count as having seen it, so the unread dot clears too.
  if (session.role === "owner") {
    await prisma.adminMessageRead.upsert({
      where: { messageId_ownerId: { messageId: message.id, ownerId: session.id } },
      update: {},
      create: { messageId: message.id, ownerId: session.id },
    });
  }

  revalidatePath("/owner/messages");
  revalidatePath("/staff/messages");
  revalidatePath(`/owner/messages/${messageId}`);
  revalidatePath(`/staff/messages/${messageId}`);
  revalidatePath("/owner/dashboard");
  revalidatePath("/staff/dashboard");

  return { success: true };
}

// The single next message the pop-up modal should show for the current
// owner/staff session — oldest-unacknowledged-first, and only ONE at a
// time, so a recipient with several pending announcements sees them one
// pop-up per visit/acknowledgment rather than all stacked at once. Called
// on dashboard load and again right after an acknowledgment to chain to
// the next pending one, if any.
export async function getPendingAdminAnnouncementForRecipient() {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) return null;

  const where =
    session.role === "owner"
      ? { channel: "popup", OR: [{ audience: "all_owners" as const }, { targetOwnerId: session.id }] }
      : { channel: "popup", OR: [{ audience: "all_staff" as const }, { targetStaffId: session.id }] };

  const [messages, acks] = await Promise.all([
    prisma.adminMessage.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: { id: true, subject: true, body: true, link: true, imageUrl: true, createdAt: true },
    }),
    prisma.adminMessageAck.findMany({
      where: { userId: session.id },
      select: { messageId: true },
    }),
  ]);

  const ackedIds = new Set(acks.map((a) => a.messageId));
  return messages.find((m) => !ackedIds.has(m.id)) ?? null;
}
