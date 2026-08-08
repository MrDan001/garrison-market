// FILE: apps/frontend/app/owner/inventory/[id]/edit/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import InventoryEditForm from "@/components/InventoryEditForm";
import ScaleInventoryEditForm from "@/components/ScaleInventoryEditForm";
import { getActiveStore } from "@/lib/store-context";

interface EditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function EditItemPage({ params, searchParams }: EditPageProps) {
  const { id } = await params;
  const itemId = parseInt(id, 10);

  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const { type } = await searchParams;
  const activeStore = await getActiveStore();

  // Native scale stores always edit through ScaleInventory. Standard
  // stores with the admin-only scaleConsignmentEnabled override reach
  // this same branch when editing from the Scale tab (?type=scale).
  let useScaleForm = activeStore?.storeType === "scale";
  if (!useScaleForm && type === "scale") {
    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { scaleConsignmentEnabled: true },
    });
    useScaleForm = !!owner?.scaleConsignmentEnabled;
  }

  if (useScaleForm) {
    const item = await prisma.scaleInventory.findUnique({
      where: { id: itemId },
      include: { categoryRef: { select: { name: true } } },
    });

    if (!item || item.ownerId !== session.id) {
      redirect("/owner/inventory");
    }

    return (
      <ScaleInventoryEditForm
        itemId={id}
        initialName={item.name}
        initialQuantity={Number(item.quantity)}
        initialUnit={item.unit}
        initialCostPrice={item.costPrice ? Number(item.costPrice) : 0}
        initialPrice={Number(item.price)}
        initialCategory={item.category || ""}
        initialRestockLevel={item.restockLevel ? Number(item.restockLevel) : 0}
        initialImage={item.image}
        initialImage2={item.image2}
        initialImage3={item.image3}
        initialDescription={item.description}
        initialSku={item.sku}
        initialCategoryId={item.categoryId}
        initialCategoryName={item.categoryRef?.name ?? null}
        initialTrackExpiry={item.trackExpiry}
        initialExpiryDate={item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : null}
      />
    );
  }

  const item = await prisma.inventory.findUnique({
    where: { id: itemId },
    include: { categoryRef: { select: { name: true } } },
  });

  if (!item || item.ownerId !== session.id) {
    redirect("/owner/inventory");
  }

  return (
    <InventoryEditForm
      itemId={id}
      initialName={item.name}
      initialQuantity={item.quantity}
      initialCostPrice={item.costPrice ? Number(item.costPrice) : 0}
      initialPrice={Number(item.price)}
      initialCategory={item.category || "phones"}
      initialRestockLevel={item.restockLevel || 0}
      initialImage={item.image}
      initialImage2={item.image2}
      initialImage3={item.image3}
      initialDescription={item.description}
      initialSku={item.sku}
      initialCategoryId={item.categoryId}
      initialCategoryName={item.categoryRef?.name ?? null}
      initialTrackExpiry={item.trackExpiry}
      initialExpiryDate={item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : null}
    />
  );
}