import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import ReportsReviewClient from "@/components/ReportsReviewClient";

export default async function OwnerReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  // Fetch reports directly including their own items
  const pendingReports = await prisma.report.findMany({
    where: { 
      ownerId: session.id, 
      status: "pending" 
    },
    include: { 
      author: true, 
      items: { 
        include: { inventory: true } 
      } 
    }
  });

  const reports = pendingReports.map((report) => ({
    ...report,
    date: report.date instanceof Date ? report.date.toISOString() : new Date().toISOString(),
    
    // Map the direct report items
    items: report.items.map((item) => ({
      id: item.id,
      name: item.inventory?.name ?? "Unknown Item",
      price: Number(item.price),
      quantity: item.quantity,
      total: Number(item.total),
      // Convert Decimal to Number to prevent serialization errors
      discountValue: item.discountValue ? Number(item.discountValue) : 0,
      discountType: item.discountType,
      discountReason: item.discountReason
    })),
    
    // Convert Decimal totalSales to Number
    totalSales: report.totalSales ? Number(report.totalSales) : 0
  }));

  return <ReportsReviewClient initialReports={reports} />;
}