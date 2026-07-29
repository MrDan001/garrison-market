"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type NotificationType = "report_status" | "low_stock" | "new_item" | "announcement" | "sale_made" | "report_submitted" | "restock" | "wastage_submitted" | "wastage_status";

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

  // Read status is per-viewer, not a single flag on the notification row —
  // see NotificationRead. A notification with recipientId: null is shared
  // by the owner and every staff member; without this, one person opening
  // their bell would mark it read for everyone else too.
  const myReads = await prisma.notificationRead.findMany({
    where: { userId: session.id, notificationId: { in: notifications.map((n) => n.id) } },
    select: { notificationId: true },
  });
  const readIds = new Set(myReads.map((r) => r.notificationId));

  const withPersonalReadStatus = notifications.map((n) => ({ ...n, read: readIds.has(n.id) }));
  const unreadCount = withPersonalReadStatus.filter((n) => !n.read).length;

  return {
    notifications: JSON.parse(JSON.stringify(withPersonalReadStatus)),
    unreadCount,
  };
}

export async function markAllNotificationsRead() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerScopeId = session.ownerId ?? session.id;

  const visible = await prisma.notification.findMany({
    where: {
      ownerId: ownerScopeId,
      OR: [{ recipientId: session.id }, { recipientId: null }],
    },
    select: { id: true },
  });

  // Record read status for THIS viewer only — createMany + skipDuplicates
  // is a no-op for any (notification, user) pair already recorded, so this
  // is safe to call repeatedly. Never touches the legacy Notification.read
  // column, which stays untouched so it can't leak into anyone else's view.
  await prisma.notificationRead.createMany({
    data: visible.map((n) => ({ notificationId: n.id, userId: session.id })),
    skipDuplicates: true,
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