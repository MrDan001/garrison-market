// FILE: apps/frontend/app/owner/history/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveStoreId } from "@/lib/store-context";
import OwnerOrderHistoryClient from "./order-history-client";

// This was previously a "use client" component sitting directly at the
// route (page.tsx never receives custom props — Next.js only ever passes
// it params/searchParams), destructuring an `orders` prop that nothing
// ever supplied. It silently defaulted to `orders = []` instead of
// crashing, so the page always rendered its own empty state ("No business
// sales recorded yet") no matter what was actually in the database. This
// file is the fix: an actual server component that fetches real orders
// and hands them to the client component (renamed to order-history-client.tsx,
// UI otherwise unchanged) — same split already used by
// app/owner/consignments/page.tsx and its client component.
export default async function OwnerHistoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStoreId = await getActiveStoreId();

  // Same ownerId + (storeId matches OR storeId is null) scoping as the
  // owner dashboard's orderMatchQuery — storeId is nullable to support
  // legacy pre-multi-store records, so excluding null would silently drop
  // any order made before this owner had more than one store.
  const orders = await prisma.order.findMany({
    where: {
      ownerId: session.id,
      OR: [{ storeId: activeStoreId }, { storeId: null }],
    },
    include: {
      items: { include: { inventory: true } },
      scaleItems: { include: { scaleInventory: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return <OwnerOrderHistoryClient orders={JSON.parse(JSON.stringify(orders))} />;
}