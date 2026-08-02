"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendPushToUsers } from "@/lib/push";

export type AdminNotificationType = "pending_owner" | "email_awaiting_reply";

// Mirrors PUSH_TITLES in notification.actions.ts — kept as plain text
// here too, since it feeds a native OS notification title rather than
// the in-app dropdown's icon/label.
const PUSH_TITLES: Record<AdminNotificationType, string> = {
  pending_owner: "New Account Pending Review",
  email_awaiting_reply: "Reply Awaiting Response",
};

// Called from registerOwnerAction (new signup) and from wherever an owner
// reply lands — both the in-app reply action and the resend-inbound
// webhook (a real email reply). Never throws into the caller: a failed
// admin notification should never break registration or reply delivery,
// same pattern as createNotification in notification.actions.ts.
export async function createAdminNotification(params: {
  type: AdminNotificationType;
  message: string;
  link?: string;
}) {
  try {
    await prisma.adminNotification.create({
      data: {
        type: params.type,
        message: params.message,
        link: params.link ?? null,
      },
    });
  } catch (err) {
    console.error("[admin-notification] create failed", err);
    return;
  }

  // Fire-and-forget push to every admin's devices — never block the
  // caller (registration, a reply webhook) on a slow/failed push send.
  void deliverAdminPush(params).catch((err) => {
    console.error("[admin-notification] push delivery failed", err);
  });
}

async function deliverAdminPush(params: { type: AdminNotificationType; message: string; link?: string }) {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await sendPushToUsers(
    admins.map((a) => a.id),
    {
      title: PUSH_TITLES[params.type] ?? "Garrison Market Admin",
      body: params.message,
      link: params.link ?? null,
      tag: params.type,
    }
  );
}

export async function getAdminNotifications() {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") {
    return { notifications: [], unreadCount: 0 };
  }

  const notifications = await prisma.adminNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications: JSON.parse(JSON.stringify(notifications)),
    unreadCount,
  };
}

export async function markAllAdminNotificationsRead() {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") throw new Error("Unauthorized");

  await prisma.adminNotification.updateMany({
    where: { read: false },
    data: { read: true },
  });

  revalidatePath("/admin/dashboard");
  return { success: true };
}