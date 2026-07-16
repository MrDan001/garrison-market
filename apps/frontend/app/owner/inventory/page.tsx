import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import InventoryGrid from "@/components/InventoryGrid";

export const dynamic = "force-dynamic";

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  // 1. Fetch inventory items
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

  // 2. Fetch sales counts for each item under this owner
  // (Adjust the table name 'orderItem' or 'sales' to match your schema)
  const salesCounts = await prisma.orderItem.groupBy({
    by: ["inventoryId"],
    where: {
      inventory: { ownerId: session.id },
    },
    _sum: {
      quantity: true, // Sums up total quantity sold per product
    },
  });

  // Create a quick lookup map of { inventoryId: totalSoldQuantity }
  const salesMap = new Map<string | number, number>();
  salesCounts.forEach((s) => {
    salesMap.set(s.inventoryId, s._sum.quantity ?? 0);
  });

  // 3. Serialize and attach the salesCount to each item
  const serialized = items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    price: Number(item.price),
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    category: item.category,
    restockLevel: item.restockLevel,
    image: item.image,
    salesCount: salesMap.get(item.id) ?? 0, // Injected into our component!
  }));

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0C10]" />}>
      <InventoryGrid items={serialized} />
    </Suspense>
  );
}