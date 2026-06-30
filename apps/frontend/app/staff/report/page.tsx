// app/staff/report/page.tsx
import { getSessionUser } from "@/lib/auth.actions"; // 👈 ADD THIS IMPORT LINE HERE
import prisma from "@/lib/prisma";
import StaffReportClient from "./staff-report-client";

export default async function ReportPage() {
  const session = await getSessionUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Get the last report submitted today to find the timestamp boundary
  const lastReportToday = await prisma.report.findFirst({
    where: { 
      authorId: session!.id, 
      date: { gte: today } 
    },
    orderBy: { date: 'desc' }
  });

  const salesStartTime = lastReportToday ? new Date(lastReportToday.date) : today;

  const [sales, reports] = await Promise.all([
    prisma.order.findMany({ 
        where: { 
          staffId: session!.id, 
          date: { gte: salesStartTime } 
        },
        include: { items: { include: { inventory: true } } } 
    }),
    prisma.report.findMany({ 
        where: { authorId: session!.id, date: { gte: today } },
        orderBy: { date: 'desc' }
    })
  ]);

  return (
    <StaffReportClient 
      staffId={session!.id} 
      reports={JSON.parse(JSON.stringify(reports))} 
      sales={JSON.parse(JSON.stringify(sales))} 
    />
  );
}