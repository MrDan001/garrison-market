import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import StaffReportClient from "./staff-report-client";

export default async function ReportPage() {
  const session = await getSessionUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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