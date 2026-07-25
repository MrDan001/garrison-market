// FILE: apps/frontend/app/owner/report/page.tsx

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import { redirect } from "next/navigation";
import ReportsReviewClient from "@/components/ReportsReviewClient";

export default async function OwnerReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const activeStoreId = await getActiveStoreId();

  const pendingReports = await prisma.report.findMany({
    where: {
      ownerId: session.id,
      status: "pending",
      OR: [{ storeId: activeStoreId }, { storeId: null }],
    },
    include: {
      author: { select: { id: true, fullName: true } },
      items: {
        include: { inventory: true },
      },
      scaleItems: true,
    },
    orderBy: { date: "desc" },
  });

  // Stage: a merged (admin-override) store's report can carry BOTH list
  // sales and scale sales on the same row — previously this reshaped
  // either scaleItems OR items into a single `items` array, which
  // silently dropped whichever type lost that coin-flip. Now both are
  // kept, always, as separate arrays — the review UI decides how to
  // show them (a toggle when a report genuinely has both).
  const serialized = pendingReports.map((report) => {
    const listItems = report.items.map((item) => ({
      id: item.id,
      name: item.inventory?.name ?? item.name ?? "Unknown Item",
      price: Number(item.price),
      quantity: item.quantity,
      total: Number(item.total),
      discountValue: item.discountValue != null ? Number(item.discountValue) : null,
      discountType: item.discountType,
      discountReason: item.discountReason,
    }));

    // Scale reports use ScaleReportItem (name/quantitySold/unit/totalPrice —
    // no discount fields) — reshaped here into the same {name, price,
    // quantity, total, discountValue} shape the standard items use, so
    // both render through the same table component. "quantity" becomes
    // a display string like "12kg" instead of a number.
    const scaleItems = report.scaleItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.quantitySold) > 0 ? Number(item.totalPrice) / Number(item.quantitySold) : 0,
      quantity: `${Number(item.quantitySold)}${item.unit}`,
      total: Number(item.totalPrice),
      discountValue: null,
      discountType: null,
      discountReason: null,
    }));

    return {
      id: report.id,
      status: report.status,
      date: report.date instanceof Date ? report.date.toISOString() : new Date().toISOString(),
      notes: report.notes,
      ownerNote: report.ownerNote,
      authorId: report.authorId,
      ownerId: report.ownerId,
      totalSales: Number(report.totalSales),
      cashTotal: Number(report.cashTotal),
      transferTotal: Number(report.transferTotal),
      author: report.author,
      listItems,
      scaleItems,
    };
  });

  return <ReportsReviewClient initialReports={serialized} />;
}