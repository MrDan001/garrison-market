import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import InventoryEditForm from "@/components/InventoryEditForm";
import ScaleInventoryEditForm from "@/components/ScaleInventoryEditForm";
import { getActiveStore } from "@/lib/store-context";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditItemPage({ params }: EditPageProps) {
  const { id } = await params;
  const itemId = parseInt(id, 10);

  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();

  if (activeStore?.storeType === "scale") {
    const item = await prisma.scaleInventory.findUnique({ where: { id: itemId } });

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
      />
    );
  }

  const item = await prisma.inventory.findUnique({ where: { id: itemId } });

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
    />
  );
}