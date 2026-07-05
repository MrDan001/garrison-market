// app/owner/report/page.tsx
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions"; // 💡 Fixed: Importing from auth.actions instead of auth
import { redirect } from "next/navigation";
import ReportsReviewClient from "./reports-review-client";

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

  // Map and inject the actual total sales calculation for the day
  const reportsWithCalculatedSales = pendingReports.map((report: (typeof pendingReports)[0]) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Filter orders to only sum up the ones made today
    const todayOrders = report.author?.orders?.filter((order: any) => {
      return new Date(order.date) >= startOfToday;
    }) || [];

    const totalSalesToday = todayOrders.reduce((sum: number, order: any) => sum + Number(order.total), 0);

    return {
      ...report,
      staffTotalSales: totalSalesToday
    };
  });

  return <ReportsReviewClient initialReports={reportsWithCalculatedSales} />;
}