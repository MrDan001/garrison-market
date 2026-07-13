import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import ReportsReviewClient from "@/components/ReportsReviewClient";

export default async function OwnerReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const pendingReports = await prisma.report.findMany({
    where: { ownerId: session.id, status: "pending" },
    include: { 
      author: { 
        include: { 
          orders: { 
            include: { items: { include: { inventory: true } } },
            orderBy: { date: 'desc' }
          } 
        } 
      } 
    }
  });

  const reportsWithCalculatedSales = pendingReports.map((report) => {
    // 1. Flatten all items from all orders into a single array for the UI to display
    const flattenedItems = report.author?.orders?.flatMap(order => 
      order.items.map(item => ({
        id: item.id,
        name: item.inventory?.name ?? "Unknown Item",
        price: Number(item.priceAtTime),
        quantity: item.quantity,
        total: Number(item.priceAtTime) * item.quantity,
        discountValue: item.discountValue,
        discountType: item.discountType,
        discountReason: item.discountReason
      }))
    ) || [];

    // 2. Calculate daily sales (as you were doing before)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayOrders = report.author?.orders?.filter((order: any) => {
      return new Date(order.date) >= startOfToday;
    }) || [];

    const totalSalesToday = todayOrders.reduce((sum: number, order: any) => sum + Number(order.total), 0);

    return {
      id: report.id,
      status: report.status,
      date: report.date instanceof Date ? report.date.toISOString() : new Date().toISOString(),
      notes: report.notes ?? "",
      authorId: report.authorId,
      ownerId: report.ownerId,
      totalSales: report.totalSales ? Number(report.totalSales) : 0,
      
      // Inject the flattened items here so ReportsReviewClient can find them
      items: flattenedItems,
      
      author: report.author ? {
        id: report.author.id,
        fullName: report.author.fullName,
        orders: report.author.orders.map(order => ({
          id: order.id,
          date: order.date instanceof Date ? order.date.toISOString() : new Date().toISOString(),
          total: Number(order.total),
          items: order.items.map(item => ({
            id: item.id,
            name: item.inventory?.name ?? "Unknown Item",
            price: Number(item.priceAtTime),
            quantity: item.quantity,
            total: Number(item.priceAtTime) * item.quantity,
            discountValue: item.discountValue,
            discountType: item.discountType,
            discountReason: item.discountReason
          }))
        }))
      } : null,
      
      staffTotalSales: totalSalesToday
    };
  });

  return <ReportsReviewClient initialReports={reportsWithCalculatedSales} />;
}