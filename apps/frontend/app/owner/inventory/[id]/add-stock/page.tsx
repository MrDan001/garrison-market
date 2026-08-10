// FILE: apps/frontend/app/owner/inventory/[id]/add-stock/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import AddStockForm from "@/components/AddStockForm";
import AddScaleStockForm from "@/components/AddScaleStockForm";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function AddStockPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) redirect("/owner/inventory");

  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const { type } = await searchParams;
  const activeStore = await getActiveStore();
  let useScale = activeStore?.storeType === "scale";
  if (!useScale && type === "scale") {
    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { scaleConsignmentEnabled: true },
    });
    useScale = !!owner?.scaleConsignmentEnabled;
  }

  if (useScale) {
    const item = await prisma.scaleInventory.findFirst({
      where: { id: itemId, ownerId: session.id },
    });
    if (!item) redirect("/owner/inventory");

    return (
      <AddScaleStockForm
        itemId={item.id}
        itemName={item.name}
        unit={item.unit}
        currentQuantity={Number(item.quantity)}
        currentPrice={Number(item.price)}
        currentCostPrice={item.costPrice != null ? Number(item.costPrice) : null}
        trackExpiry={item.trackExpiry}
      />
    );
  }

  const item = await prisma.inventory.findFirst({
    where: { id: itemId, ownerId: session.id },
  });
  if (!item) redirect("/owner/inventory");

  return (
    <AddStockForm
      itemId={item.id}
      itemName={item.name}
      currentQuantity={item.quantity}
      currentPrice={Number(item.price)}
      currentCostPrice={item.costPrice != null ? Number(item.costPrice) : null}
      trackExpiry={item.trackExpiry}
    />
  );
}