"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";

export type BroadcastTargetType = "owners" | "staff" | "everyone" | "owner_tenant" | "store";

export type SendBroadcastParams = {
  title: string;
  body: string;
  // Internal app path only, e.g. "/owner/promotions" — see the
  // isInternalPath guard below. Optional: a broadcast with no link just
  // opens the app to whatever the client is already on.
  link?: string | null;
  targetType: BroadcastTargetType;
  // Required (and only meaningful) when targetType is "owner_tenant"
  // (an owner's User.id — reaches that owner + their staff) or "store"
  // (a Store.id — reaches staff pinned to that store via staffStoreId).
  targetId?: number | null;
};

// Only allow relative, in-app paths — never an external URL. This is a
// push notification the recipient trusts came from Garrison Market
// itself; letting it deep-link off-app would make it a phishing vector,
// and it's also almost certainly a mistake (a pasted external link)
// rather than something an admin actually wants here.
function isInternalPath(link: string) {
  return link.startsWith("/") && !link.startsWith("//");
}

export async function sendBroadcastNotification(params: SendBroadcastParams) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") {
    throw new Error("Unauthorized");
  }

  const title = params.title.trim();
  const body = params.body.trim();
  const link = params.link?.trim() || null;

  if (!title || !body) {
    throw new Error("Title and message are required");
  }
  if (link && !isInternalPath(link)) {
    throw new Error("Link must be an internal app path, e.g. /owner/promotions");
  }
  if ((params.targetType === "owner_tenant" || params.targetType === "store") && !params.targetId) {
    throw new Error("targetId is required for this target type");
  }

  // Simple guardrail against accidental double-fire (double-click, a slow
  // network making someone hit send twice) rather than genuine abuse —
  // this is a single-admin internal tool, not a public endpoint. Blocks
  // this admin from sending a second broadcast within 10 seconds of
  // their last one.
  const recent = await prisma.adminBroadcast.findFirst({
    where: { sentById: session.id, createdAt: { gt: new Date(Date.now() - 10_000) } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (recent) {
    throw new Error("Please wait a few seconds before sending another broadcast.");
  }

  const userIds = await resolveTargetUserIds(params.targetType, params.targetId ?? null);

  if (userIds.length === 0) {
    throw new Error("No matching recipients found for that target");
  }

  // Count devices (subscriptions), not users, for recipientCount — that's
  // the number that actually matters for "did this reach anyone", since a
  // user with zero subscribed devices contributes nothing to delivery.
  const recipientCount = await prisma.pushSubscription.count({
    where: { userId: { in: userIds } },
  });

  const broadcast = await prisma.adminBroadcast.create({
    data: {
      title,
      body,
      link,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      recipientCount,
      sentById: session.id,
    },
  });

  // Fire-and-forget, same pattern as createAdminNotification's
  // deliverAdminPush — the admin's "sent" confirmation shouldn't hang on
  // however long web-push takes to fan out to every device.
  void sendPushToUsers(userIds, { title, body, link, tag: `broadcast-${broadcast.id}` }).catch((err) => {
    console.error("[broadcast] push delivery failed", err);
  });

  return { success: true, recipientCount, broadcastId: broadcast.id };
}

async function resolveTargetUserIds(targetType: BroadcastTargetType, targetId: number | null): Promise<number[]> {
  switch (targetType) {
    case "owners": {
      const users = await prisma.user.findMany({ where: { role: "owner" }, select: { id: true } });
      return users.map((u) => u.id);
    }
    case "staff": {
      const users = await prisma.user.findMany({ where: { role: "staff" }, select: { id: true } });
      return users.map((u) => u.id);
    }
    case "everyone": {
      const users = await prisma.user.findMany({
        where: { role: { in: ["owner", "staff"] } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case "owner_tenant": {
      // The owner themselves plus every staff member under them
      // (User.ownerId points staff back to their owner).
      const users = await prisma.user.findMany({
        where: { OR: [{ id: targetId! }, { ownerId: targetId! }] },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case "store": {
      const users = await prisma.user.findMany({
        where: { staffStoreId: targetId! },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    default:
      return [];
  }
}

// List of stores for the "specific store" target picker — owner's
// storeName is shown alongside since two different owners can otherwise
// have identically-named stores ("Main Store" is common).
export async function getStoresForBroadcastPicker() {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") return [];

  const stores = await prisma.store.findMany({
    select: { id: true, name: true, owner: { select: { storeName: true, fullName: true } } },
    orderBy: { name: "asc" },
  });

  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    ownerLabel: s.owner?.storeName || s.owner?.fullName || null,
  }));
}

const TARGET_TYPE_LABELS: Record<BroadcastTargetType, string> = {
  everyone: "Everyone",
  owners: "All Owners",
  staff: "All Staff",
  owner_tenant: "Owner",
  store: "Store",
};

// Turns a raw broadcast's targetType/targetId into a human label, e.g.
// "Owner — Chidi's Store" or "Store — Main Branch (Chidi's Store)".
// Batches the owner/store lookups (one query each across the whole page
// of history) rather than querying per-row, since this runs on every
// page load of the history list.
async function attachTargetLabels(broadcasts: any[]) {
  const ownerIds = broadcasts.filter((b) => b.targetType === "owner_tenant" && b.targetId).map((b) => b.targetId);
  const storeIds = broadcasts.filter((b) => b.targetType === "store" && b.targetId).map((b) => b.targetId);

  const [owners, stores] = await Promise.all([
    ownerIds.length
      ? prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, fullName: true, storeName: true },
        })
      : Promise.resolve([]),
    storeIds.length
      ? prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, name: true, owner: { select: { storeName: true, fullName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const ownerMap = new Map(owners.map((o) => [o.id, o.storeName || o.fullName || `Owner #${o.id}`]));
  const storeMap = new Map(
    stores.map((s) => [s.id, `${s.name}${s.owner ? ` (${s.owner.storeName || s.owner.fullName})` : ""}`])
  );

  return broadcasts.map((b) => {
    let targetLabel = TARGET_TYPE_LABELS[b.targetType as BroadcastTargetType] ?? b.targetType;
    if (b.targetType === "owner_tenant" && b.targetId) {
      targetLabel = `Owner — ${ownerMap.get(b.targetId) || `#${b.targetId}`}`;
    } else if (b.targetType === "store" && b.targetId) {
      targetLabel = `Store — ${storeMap.get(b.targetId) || `#${b.targetId}`}`;
    }
    return { ...b, targetLabel };
  });
}

const HISTORY_PAGE_SIZE = 15;

export async function getBroadcastHistory(offset: number = 0) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") {
    return { broadcasts: [], hasMore: false };
  }

  const broadcasts = await prisma.adminBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: HISTORY_PAGE_SIZE + 1,
    include: { sentBy: { select: { email: true, fullName: true } } },
  });

  const hasMore = broadcasts.length > HISTORY_PAGE_SIZE;
  const page = broadcasts.slice(0, HISTORY_PAGE_SIZE);
  const labeled = await attachTargetLabels(page);

  return { broadcasts: JSON.parse(JSON.stringify(labeled)), hasMore };
}