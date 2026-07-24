import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getConsignmentsForOwner, getScaleConsignmentsForOwner } from "@/lib/consignment.actions";
import { getActiveStore } from "@/lib/store-context";
import OwnerConsignmentsClient from "./owner-consignments-client";

export const dynamic = "force-dynamic";

export default async function OwnerConsignmentsPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();

  if (activeStore?.storeType === "scale") {
    const consignments = await getScaleConsignmentsForOwner();

    // Reshape scaleItems into the same {inventory, quantityOut,
    // quantitySold, quantityReturned, priceAtTime} shape the standard
    // items already use, plus a `unit` field the display component
    // shows next to each quantity — keeps one shared client component
    // instead of forking the whole review UI.
    const reshaped = consignments.map((c) => ({
      ...c,
      items: c.scaleItems.map((item) => ({
        id: item.id,
        inventory: { name: item.scaleInventory.name },
        quantityOut: Number(item.quantityOut),
        quantitySold: Number(item.quantitySold),
        quantityReturned: Number(item.quantityReturned),
        priceAtTime: Number(item.priceAtTime),
        unit: item.unit,
      })),
    }));

    return <OwnerConsignmentsClient consignments={JSON.parse(JSON.stringify(reshaped))} />;
  }

  const consignments = await getConsignmentsForOwner();

  return <OwnerConsignmentsClient consignments={JSON.parse(JSON.stringify(consignments))} />;
}