import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import InventoryGrid from "@/components/InventoryGrid";

export const dynamic = "force-dynamic";

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const items = await prisma.inventory.findMany({
    where: { ownerId: session.id },
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      costPrice: true,
      category: true,
      restockLevel: true,
      image: true,
      ownerId: true,
    },
    orderBy: { name: "asc" },
  });

  const serialized = items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    price: Number(item.price),
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    category: item.category,
    restockLevel: item.restockLevel,
    image: item.image,
  }));

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0C10]" />}>
      <InventoryGrid items={serialized} />
    </Suspense>
  );
}
