import webpush from "web-push";
import prisma from "@/lib/prisma";

// --- VAPID setup -----------------------------------------------------
// Configured lazily (not at module load) so a missing env var never
// crashes the whole server action — it just means push sends are
// silently skipped, and in-app notifications (bell, polling) keep
// working exactly as before.
let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@gmstock.co";

  if (!publicKey || !privateKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[push] VAPID keys missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — push notifications are disabled."
      );
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  link?: string | null;
  tag?: string;
};

// Sends one push payload to every device a single user has subscribed
// on. Dead subscriptions (browser revoked them, or the user cleared
// site data) come back as 404/410 from the push service — those rows
// are pruned here so we stop paying the cost of hitting a dead
// endpoint on every future notification.
export async function sendPushToUser(userId: number, payload: PushPayload) {
  if (!ensureVapidConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] send failed for subscription", sub.id, statusCode ?? err);
        }
      }
    })
  );
}

// Fan-out to several users at once (e.g. an announcement broadcast to
// an owner + every staff member under them). Failures for one user's
// devices never block delivery to the rest.
export async function sendPushToUsers(userIds: number[], payload: PushPayload) {
  const uniqueIds = [...new Set(userIds)];
  await Promise.all(uniqueIds.map((id) => sendPushToUser(id, payload)));
}