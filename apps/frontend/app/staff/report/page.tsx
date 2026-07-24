import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import StaffReportClient from "./staff-report-client";

export default async function ReportPage() {
  const session = await getSessionUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeStore = await getActiveStore();
  const isScale = activeStore?.storeType === "scale";

  if (isScale) {
    const [sales, reports, pendingRevision] = await Promise.all([
      prisma.order.findMany({
        where: { staffId: session!.id, date: { gte: today } },
        include: { scaleItems: { include: { scaleInventory: true } } },
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

    // Group today's scale sales by product for the "one line per
    // product" summary staff see before submitting — same grouping
    // submitDailyReport applies server-side when the report is created.
    const grouped = new Map<number, { name: string; unit: string; qty: number; total: number }>();
    for (const sale of sales) {
      for (const item of sale.scaleItems) {
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
    const scaleSummary = Array.from(grouped.values());

    return (
      <StaffReportClient
        staffId={session!.id}
        isScale
        scaleSummary={JSON.parse(JSON.stringify(scaleSummary))}
        reports={JSON.parse(JSON.stringify(reports))}
        sales={JSON.parse(JSON.stringify(sales))}
        pendingRevision={pendingRevision ? JSON.parse(JSON.stringify(pendingRevision)) : null}
      />
    );
  }

  const [sales, reports, pendingRevision] = await Promise.all([
    prisma.order.findMany({
      where: { staffId: session!.id, date: { gte: today } },
      include: { items: { include: { inventory: true } } }
    }),
    prisma.report.findMany({
      where: { authorId: session!.id, date: { gte: today } },
      orderBy: { date: 'desc' }
    }),
    prisma.report.findFirst({
      where: { authorId: session!.id, status: "revision_requested" },
      orderBy: { date: 'desc' },
    }),
  ]);

  return (
    <StaffReportClient
      staffId={session!.id}
      reports={JSON.parse(JSON.stringify(reports))}
      sales={JSON.parse(JSON.stringify(sales))}
      pendingRevision={pendingRevision ? JSON.parse(JSON.stringify(pendingRevision)) : null}
    />
  );
}