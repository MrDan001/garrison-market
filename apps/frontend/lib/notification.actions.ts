"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendPushToUsers } from "@/lib/push";

type NotificationType = "report_status" | "low_stock" | "new_item" | "announcement" | "sale_made" | "report_submitted" | "restock" | "wastage_submitted" | "wastage_status";

// Mirrors the labels in NotificationBell's typeConfig — kept as plain
// text here (no icons/JSX) since this file runs on the server and
// feeds a native OS notification title, not the in-app dropdown.
const PUSH_TITLES: Record<NotificationType, string> = {
  report_status: "Report Update",
  low_stock: "Stock Alert",
  new_item: "New Item",
  announcement: "Announcement",
  sale_made: "Sale Made",
  report_submitted: "Report Submitted",
  restock: "Restocked",
  wastage_submitted: "Wastage Logged",
  wastage_status: "Wastage Update",
};

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

  // Fire the native/OS-level push in the background — never let a slow
  // or failed push send delay or break the caller's action (a sale,
  // a report submission, etc). This is what makes notifications show
  // up even when the app is closed or backgrounded, same as a native
  // app; the in-app bell (polling) keeps working independently of this.
  void deliverPush(params).catch((err) => {
    console.error("[push] deliverPush failed", err);
  });
}

async function deliverPush(params: {
  ownerId: number;
  recipientId?: number | null;
  type: NotificationType;
  message: string;
  link?: string;
}) {
  let recipientUserIds: number[];

  if (params.recipientId) {
    recipientUserIds = [params.recipientId];
  } else {
    // recipientId: null means "everyone under this owner" — the owner
    // themself plus every staff member scoped to them, same audience
    // the in-app bell resolves in getNotificationsForStaff.
    const audience = await prisma.user.findMany({
      where: { OR: [{ id: params.ownerId }, { ownerId: params.ownerId }] },
      select: { id: true },
    });
    recipientUserIds = audience.map((u) => u.id);
  }

  if (recipientUserIds.length === 0) return;

  await sendPushToUsers(recipientUserIds, {
    title: PUSH_TITLES[params.type] ?? "Garrison Market",
    body: params.message,
    link: params.link ?? null,
    tag: params.type,
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