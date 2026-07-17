"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification.actions";

const TYPING_STALE_MS = 4000; // a typing row older than this is treated as "not typing"

function isTypingFresh(updatedAt: Date | undefined | null) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < TYPING_STALE_MS;
}

// ───────── STAFF ↔ OWNER ─────────

export async function getStaffOwnerThread() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff" || !session.ownerId) return { messages: [], otherTyping: false };

  const messages = await prisma.supportMessage.findMany({
    where: { threadType: "staff_owner", ownerId: session.ownerId, staffId: session.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true, image: true } } },
  });

  await prisma.supportMessage.updateMany({
    where: {
      threadType: "staff_owner",
      ownerId: session.ownerId,
      staffId: session.id,
      senderRole: "owner",
      read: false,
    },
    data: { read: true },
  });

  const typingRow = await prisma.typingStatus.findUnique({
    where: {
      threadKey_senderRole: {
        threadKey: `staff_owner:${session.ownerId}:${session.id}`,
        senderRole: "owner",
      },
    },
  });

  return { messages, otherTyping: isTypingFresh(typingRow?.updatedAt) };
}

export async function setStaffTypingInOwnerThread() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff" || !session.ownerId) return;

  const threadKey = `staff_owner:${session.ownerId}:${session.id}`;
  await prisma.typingStatus.upsert({
    where: { threadKey_senderRole: { threadKey, senderRole: "staff" } },
    create: { threadKey, senderRole: "staff" },
    update: {},
  });
}

export async function sendStaffMessage(content: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "staff" || !session.ownerId) throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Message cannot be empty");

  await prisma.supportMessage.create({
    data: {
      threadType: "staff_owner",
      ownerId: session.ownerId,
      staffId: session.id,
      senderId: session.id,
      senderRole: "staff",
    content: content.trim(),
    },
  });

  revalidatePath("/staff/dashboard");
  return { success: true };
}

export async function getOwnerStaffThreads() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return [];

  const staffList = await prisma.user.findMany({
    where: { ownerId: session.id, role: "staff" },
    select: { id: true, fullName: true, image: true },
  });

  const threads = await Promise.all(
    staffList.map(async (staff) => {
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.supportMessage.findFirst({
          where: { threadType: "staff_owner", ownerId: session.id, staffId: staff.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.supportMessage.count({
          where: {
            threadType: "staff_owner",
            ownerId: session.id,
            staffId: staff.id,
            senderRole: "staff",
            read: false,
          },
        }),
      ]);
      return { staff, lastMessage, unreadCount };
    })
  );

  return threads.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt.getTime() ?? 0;
    const bTime = b.lastMessage?.createdAt.getTime() ?? 0;
    return bTime - aTime;
  });
}

export async function getOwnerStaffThread(staffId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { messages: [], otherTyping: false };

  const messages = await prisma.supportMessage.findMany({
    where: { threadType: "staff_owner", ownerId: session.id, staffId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true, image: true } } },
  });

  await prisma.supportMessage.updateMany({
    where: {
      threadType: "staff_owner",
      ownerId: session.id,
      staffId,
      senderRole: "staff",
      read: false,
    },
    data: { read: true },
  });

  const typingRow = await prisma.typingStatus.findUnique({
    where: {
      threadKey_senderRole: {
        threadKey: `staff_owner:${session.id}:${staffId}`,
        senderRole: "staff",
      },
    },
  });

  return { messages, otherTyping: isTypingFresh(typingRow?.updatedAt) };
}

export async function setOwnerTypingInStaffThread(staffId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return;

  const threadKey = `staff_owner:${session.id}:${staffId}`;
  await prisma.typingStatus.upsert({
    where: { threadKey_senderRole: { threadKey, senderRole: "owner" } },
    create: { threadKey, senderRole: "owner" },
    update: {},
  });
}

export async function sendOwnerToStaffMessage(staffId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Message cannot be empty");

  await prisma.supportMessage.create({
    data: {
      threadType: "staff_owner",
      ownerId: session.id,
      staffId,
      senderId: session.id,
      senderRole: "owner",
      content: content.trim(),
    },
  });

  await createNotification({
    ownerId: session.id,
    recipientId: staffId,
    type: "announcement",
    message: `Your store owner replied to your message.`,
    link: "/staff/dashboard",
  });

  revalidatePath("/owner/support");
  return { success: true };
}

// ───────── OWNER ↔ ADMIN ─────────

export async function getOwnerAdminThread() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { messages: [], otherTyping: false };

  const messages = await prisma.supportMessage.findMany({
    where: { threadType: "owner_admin", ownerId: session.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true, image: true } } },
  });

  await prisma.supportMessage.updateMany({
    where: { threadType: "owner_admin", ownerId: session.id, senderRole: "admin", read: false },
    data: { read: true },
  });

  const typingRow = await prisma.typingStatus.findUnique({
    where: {
      threadKey_senderRole: {
        threadKey: `owner_admin:${session.id}`,
        senderRole: "admin",
      },
    },
  });

  return { messages, otherTyping: isTypingFresh(typingRow?.updatedAt) };
}

export async function setOwnerTypingInAdminThread() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return;

  const threadKey = `owner_admin:${session.id}`;
  await prisma.typingStatus.upsert({
    where: { threadKey_senderRole: { threadKey, senderRole: "owner" } },
    create: { threadKey, senderRole: "owner" },
    update: {},
  });
}

export async function sendOwnerToAdminMessage(content: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Message cannot be empty");

  await prisma.supportMessage.create({
    data: {
      threadType: "owner_admin",
      ownerId: session.id,
      senderId: session.id,
      senderRole: "owner",
      content: content.trim(),
    },
  });

  revalidatePath("/owner/support");
  revalidatePath("/admin/support");
  return { success: true };
}

export async function getOwnerUnreadTotal() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return 0;

  const [staffUnread, adminUnread] = await Promise.all([
    prisma.supportMessage.count({
      where: { threadType: "staff_owner", ownerId: session.id, senderRole: "staff", read: false },
    }),
    prisma.supportMessage.count({
      where: { threadType: "owner_admin", ownerId: session.id, senderRole: "admin", read: false },
    }),
  ]);

  return staffUnread + adminUnread;
}

// ───────── ADMIN ─────────

export async function getAdminThreads() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return [];

  const owners = await prisma.user.findMany({
    where: { role: "owner" },
    select: { id: true, fullName: true, storeName: true, image: true },
  });

  const threads = await Promise.all(
    owners.map(async (owner) => {
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.supportMessage.findFirst({
          where: { threadType: "owner_admin", ownerId: owner.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.supportMessage.count({
          where: { threadType: "owner_admin", ownerId: owner.id, senderRole: "owner", read: false },
        }),
      ]);
      return { owner, lastMessage, unreadCount };
    })
  );

  return threads
    .filter((t) => t.lastMessage !== null)
    .sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
}

export async function getAdminOwnerThread(ownerId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { messages: [], otherTyping: false };

  const messages = await prisma.supportMessage.findMany({
    where: { threadType: "owner_admin", ownerId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true, image: true } } },
  });

  await prisma.supportMessage.updateMany({
    where: { threadType: "owner_admin", ownerId, senderRole: "owner", read: false },
    data: { read: true },
  });

  const typingRow = await prisma.typingStatus.findUnique({
    where: {
      threadKey_senderRole: {
        threadKey: `owner_admin:${ownerId}`,
        senderRole: "owner",
      },
    },
  });

  return { messages, otherTyping: isTypingFresh(typingRow?.updatedAt) };
}

export async function setAdminTypingInOwnerThread(ownerId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return;

  const threadKey = `owner_admin:${ownerId}`;
  await prisma.typingStatus.upsert({
    where: { threadKey_senderRole: { threadKey, senderRole: "admin" } },
    create: { threadKey, senderRole: "admin" },
    update: {},
  });
}

export async function sendAdminReply(ownerId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Message cannot be empty");

  await prisma.supportMessage.create({
    data: {
      threadType: "owner_admin",
      ownerId,
      senderId: session.id,
      senderRole: "admin",
      content: content.trim(),
    },
  });

  revalidatePath("/admin/support");
  revalidatePath("/owner/support");
  return { success: true };
}

// ───────── STAFF ↔ ADMIN ─────────

export async function getStaffAdminThread() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") return { messages: [], otherTyping: false };

  const messages = await prisma.supportMessage.findMany({
    where: { threadType: "staff_admin", staffId: session.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true, image: true } } },
  });

  await prisma.supportMessage.updateMany({
    where: { threadType: "staff_admin", staffId: session.id, senderRole: "admin", read: false },
    data: { read: true },
  });

  const typingRow = await prisma.typingStatus.findUnique({
    where: {
      threadKey_senderRole: {
        threadKey: `staff_admin:${session.id}`,
        senderRole: "admin",
      },
    },
  });

  return { messages, otherTyping: isTypingFresh(typingRow?.updatedAt) };
}

export async function setStaffTypingInAdminThread() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") return;

  const threadKey = `staff_admin:${session.id}`;
  await prisma.typingStatus.upsert({
    where: { threadKey_senderRole: { threadKey, senderRole: "staff" } },
    create: { threadKey, senderRole: "staff" },
    update: {},
  });
}

export async function sendStaffToAdminMessage(content: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Message cannot be empty");

  await prisma.supportMessage.create({
    data: {
      threadType: "staff_admin",
      ownerId: session.ownerId!,
      staffId: session.id,
      senderId: session.id,
      senderRole: "staff",
      content: content.trim(),
    },
  });

  revalidatePath("/admin/support");
  return { success: true };
}

export async function getAdminStaffThreads() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return [];

  const staffWithMessages = await prisma.supportMessage.findMany({
    where: { threadType: "staff_admin" },
    distinct: ["staffId"],
    select: { staffId: true },
  });

  const staffIds = staffWithMessages.map((s) => s.staffId).filter((id): id is number => id !== null);

  const staffList = await prisma.user.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, fullName: true, image: true, owner: { select: { storeName: true } } },
  });

  const threads = await Promise.all(
    staffList.map(async (staff) => {
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.supportMessage.findFirst({
          where: { threadType: "staff_admin", staffId: staff.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.supportMessage.count({
          where: { threadType: "staff_admin", staffId: staff.id, senderRole: "staff", read: false },
        }),
      ]);
      return { staff, lastMessage, unreadCount };
    })
  );

  return threads.sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
}

export async function getAdminStaffThread(staffId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { messages: [], otherTyping: false };

  const messages = await prisma.supportMessage.findMany({
    where: { threadType: "staff_admin", staffId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true, image: true } } },
  });

  await prisma.supportMessage.updateMany({
    where: { threadType: "staff_admin", staffId, senderRole: "staff", read: false },
    data: { read: true },
  });

  const typingRow = await prisma.typingStatus.findUnique({
    where: {
      threadKey_senderRole: {
        threadKey: `staff_admin:${staffId}`,
        senderRole: "staff",
      },
    },
  });

  return { messages, otherTyping: isTypingFresh(typingRow?.updatedAt) };
}

export async function setAdminTypingInStaffThread(staffId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return;

  const threadKey = `staff_admin:${staffId}`;
  await prisma.typingStatus.upsert({
    where: { threadKey_senderRole: { threadKey, senderRole: "admin" } },
    create: { threadKey, senderRole: "admin" },
    update: {},
  });
}

export async function sendAdminReplyToStaff(staffId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Message cannot be empty");

  await prisma.supportMessage.create({
    data: {
      threadType: "staff_admin",
      ownerId: session.id, // not meaningful here, just satisfies the schema's required field
      staffId,
      senderId: session.id,
      senderRole: "admin",
      content: content.trim(),
    },
  });

  await createNotification({
    ownerId: session.id,
    recipientId: staffId,
    type: "announcement",
    message: "Support replied to your message.",
    link: "/staff/dashboard",
  });

  revalidatePath("/admin/support");
  return { success: true };
}