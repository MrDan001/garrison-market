"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type NotificationType = "report_status" | "low_stock" | "new_item" | "announcement" | "sale_made" | "report_submitted";

export async function createNotification(params: {
  ownerId: number;
  recipientId?: number | null;
  storeId?: number | null;
  type: NotificationType;
  message: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      ownerId: params.ownerId,
      recipientId: params.recipientId ?? null,
      storeId: params.storeId ?? null,
      type: params.type,
      message: params.message,
      link: params.link ?? null,
    },
  });
}

export async function getNotificationsForStaff() {
  const session = await getSessionUser();
  if (!session) return { notifications: [], unreadCount: 0 };

  const ownerScopeId = session.ownerId ?? session.id;

  const notifications = await prisma.notification.findMany({
    where: {
      ownerId: ownerScopeId,
      OR: [{ recipientId: session.id }, { recipientId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications: JSON.parse(JSON.stringify(notifications)),
    unreadCount,
  };
}

export async function markAllNotificationsRead() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerScopeId = session.ownerId ?? session.id;

  await prisma.notification.updateMany({
    where: {
      ownerId: ownerScopeId,
      OR: [{ recipientId: session.id }, { recipientId: null }],
      read: false,
    },
    data: { read: true },
  });

  revalidatePath("/staff/dashboard");
  return { success: true };
}

// Owner-only — broadcasts a message to all staff under this owner.
export async function sendAnnouncementAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "owner") throw new Error("Unauthorized");

  const message = (formData.get("message") as string)?.trim();
  if (!message) throw new Error("Message cannot be empty");

  await createNotification({
    ownerId: session.id,
    recipientId: null,
    type: "announcement",
    message,
  });

  return { success: true };
}