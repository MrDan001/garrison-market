import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getActiveStore } from "@/lib/store-context";
import InventoryGrid from "@/components/InventoryGrid";
import ScaleInventoryGrid from "@/components/ScaleInventoryGrid";

export const dynamic = "force-dynamic";

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();
  const storeId = activeStore?.id ?? null;

  // Scale stores run entirely on the ScaleInventory model — the
  // storeType choice made permanently at store creation decides this.
  if (activeStore?.storeType === "scale") {
    const scaleItems = await prisma.scaleInventory.findMany({
      where: { ownerId: session.id, storeId },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        price: true,
        costPrice: true,
        category: true,
        restockLevel: true,
        image: true,
      },
      orderBy: { name: "asc" },
    });

    const serialized = scaleItems.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      price: Number(item.price),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      category: item.category,
      restockLevel: item.restockLevel != null ? Number(item.restockLevel) : null,
      image: item.image,
    }));

    return (
      <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
        <ScaleInventoryGrid items={serialized} />
      </Suspense>
    );
  }

  const items = await prisma.inventory.findMany({
    where: {
      ownerId: session.id,
      ...(storeId ? { storeId } : {}),
    },
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

  const salesCounts = await prisma.orderItem.groupBy({
    by: ["inventoryId"],
    where: {
      inventory: {
        ownerId: session.id,
        ...(storeId ? { storeId } : {}),
      },
    },
    _sum: {
      quantity: true,
    },
  });

  const salesMap = new Map<string | number, number>();
  salesCounts.forEach((s) => {
    salesMap.set(s.inventoryId, s._sum.quantity ?? 0);
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
    salesCount: salesMap.get(item.id) ?? 0,
  }));

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
      <InventoryGrid items={serialized} />
    </Suspense>
  );
}