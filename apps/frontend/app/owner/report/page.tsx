import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import { redirect } from "next/navigation";
import ReportsReviewClient from "@/components/ReportsReviewClient";

export default async function OwnerReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const activeStoreId = await getActiveStoreId();

  // 1. Fetch using the second query's structure, but with the first query's nested inventory relation
  const pendingReports = await prisma.report.findMany({
    where: {
      ownerId: session.id,
      status: "pending",
      OR: [{ storeId: activeStoreId }, { storeId: null }],
    },
    include: {
      author: { select: { id: true, fullName: true } },
      items: {
        include: { inventory: true } // Pulled from block 1 to resolve item names
      },
      scaleItems: true,
    },
    orderBy: { date: "desc" },
  });
  
  // 2. Serialize using the second block's structure, merging the inventory-name fallback logic
  const serialized = pendingReports.map((report) => ({
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
    // Scale reports use ScaleReportItem (name/quantitySold/unit/totalPrice —
    // no discount fields) — reshaped here into the exact same {name, price,
    // quantity, total, discountValue} shape the standard items use, so the
    // review UI's table renders both without needing separate branches.
    // "quantity" becomes a display string like "12kg" instead of a number.
    items: report.scaleItems.length > 0
      ? report.scaleItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.quantitySold) > 0 ? Number(item.totalPrice) / Number(item.quantitySold) : 0,
          quantity: `${Number(item.quantitySold)}${item.unit}`,
          total: Number(item.totalPrice),
          discountValue: null,
          discountType: null,
          discountReason: null,
        }))
      : report.items.map((item) => ({
          id: item.id,
          // Resolves name from nested inventory first, falls back to item.name, then "Unknown Item"
          name: item.inventory?.name ?? item.name ?? "Unknown Item",
          price: Number(item.price),
          quantity: item.quantity,
          total: Number(item.total),
          discountValue: item.discountValue != null ? Number(item.discountValue) : null,
          discountType: item.discountType,
          discountReason: item.discountReason,
        })),
  }));

  // 3. Pass the consolidated 'serialized' array to the Client Component
  return <ReportsReviewClient initialReports={serialized} />;
}