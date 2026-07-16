import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import StaffDetailClient from "./staff-detail-client";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staffId = parseInt(id, 10);
  if (isNaN(staffId)) notFound();

  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  const owner = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, role: true },
  });
  if (!owner || owner.role !== "owner") redirect("/login");

  const staff = await prisma.user.findFirst({
    where: { id: staffId, ownerId: owner.id, role: "staff" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
      image: true,
      staffStoreId: true,
    },
  });

  if (!staff) notFound();

  const [stores, monthAgg] = await Promise.all([
    prisma.store.findMany({
      where: { ownerId: owner.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.aggregate({
      where: {
        staffId: staff.id,
        date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const currentStore = stores.find((s) => s.id === staff.staffStoreId);

  return (
    <StaffDetailClient
      staff={JSON.parse(JSON.stringify(staff))}
      stores={stores}
      currentStoreName={currentStore?.name ?? null}
      monthSales={Number(monthAgg._sum.total ?? 0)}
      monthOrders={monthAgg._count}
    />
  );
}