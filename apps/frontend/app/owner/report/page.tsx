import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import ReportsReviewClient from "@/components/ReportsReviewClient";

export default async function OwnerReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  // 1. Fetch using the second query's structure, but with the first query's nested inventory relation
  const pendingReports = await prisma.report.findMany({
    where: { ownerId: session.id, status: "pending" },
    include: {
      author: { select: { id: true, fullName: true } },
      items: {
        include: { inventory: true } // Pulled from block 1 to resolve item names
      },
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
    items: report.items.map((item) => ({
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