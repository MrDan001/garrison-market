// FILE: apps/frontend/app/staff/report/page.tsx

import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import StaffReportClient from "./staff-report-client";

export default async function ReportPage() {
  const session = await getSessionUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeStore = await getActiveStore();
  const isNativeScale = activeStore?.storeType === "scale";

  // Stage 3: merged stores (standard store + the admin-only
  // scaleConsignmentEnabled override) can have a staff member selling
  // BOTH list items and consigned scale stock on the same day. This page
  // previously only ever queried one relation — items for standard,
  // scaleItems for native scale stores — so a merged staff member's
  // scale sales were invisible in their pre-submit preview, even though
  // submitDailyReport already correctly captured them once submitted.
  // Now both relations are requested together whenever the override is
  // on, regardless of the store's native type.
  let ownerScaleEnabled = false;
  if (!isNativeScale) {
    const owner = await prisma.user.findUnique({
      where: { id: session!.id },
      select: { scaleConsignmentEnabled: true },
    });
    ownerScaleEnabled = !!owner?.scaleConsignmentEnabled;
  }

  const includeList = !isNativeScale;
  const includeScale = isNativeScale || ownerScaleEnabled;

  const [sales, reports, pendingRevision] = await Promise.all([
    prisma.order.findMany({
      where: { staffId: session!.id, date: { gte: today } },
      include: {
        ...(includeList ? { items: { include: { inventory: true } } } : {}),
        ...(includeScale ? { scaleItems: { include: { scaleInventory: true } } } : {}),
      },
    }),
    prisma.report.findMany({
      where: { authorId: session!.id, date: { gte: today } },
      orderBy: { date: "desc" },
    }),
    prisma.report.findFirst({
      where: { authorId: session!.id, status: "revision_requested" },
      orderBy: { date: "desc" },
    }),
  ]);

  // Group today's scale sales by product for the "one line per product"
  // summary staff see before submitting — same grouping submitDailyReport
  // applies server-side when the report is created.
  let scaleSummary: { name: string; unit: string; qty: number; total: number }[] = [];
  if (includeScale) {
    const grouped = new Map<number, { name: string; unit: string; qty: number; total: number }>();
    for (const sale of sales as any[]) {
      for (const item of sale.scaleItems ?? []) {
        const key = item.scaleInventoryId;
        const qty = Number(item.quantityInBaseUnit);
        const total = Number(item.priceAtTime);
        const existing = grouped.get(key);
        if (existing) {
          existing.qty += qty;
          existing.total += total;
        } else {
          grouped.set(key, {
            name: item.scaleInventory?.name ?? "Unknown Item",
            unit: item.scaleInventory?.unit ?? "",
            qty,
            total,
          });
        }
      }
    }
    scaleSummary = Array.from(grouped.values());
  }

  return (
    <StaffReportClient
      staffId={session!.id}
      // Kept for the current client, which still branches on this exact
      // meaning ("native scale-only store") — Stage 4 replaces it with
      // hasList/hasScale below so a merged store can show both.
      isScale={isNativeScale}
      hasList={includeList}
      hasScale={includeScale}
      scaleSummary={JSON.parse(JSON.stringify(scaleSummary))}
      reports={JSON.parse(JSON.stringify(reports))}
      sales={JSON.parse(JSON.stringify(sales))}
      pendingRevision={pendingRevision ? JSON.parse(JSON.stringify(pendingRevision)) : null}
    />
  );
}
