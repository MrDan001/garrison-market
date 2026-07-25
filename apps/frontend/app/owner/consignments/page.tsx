// FILE: apps/frontend/app/owner/consignments/page.tsx

import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getConsignmentsForOwner, getScaleConsignmentsForOwner } from "@/lib/consignment.actions";
import { getActiveStore } from "@/lib/store-context";
import OwnerConsignmentsClient from "./owner-consignments-client";

export const dynamic = "force-dynamic";

function reshapeScale(consignments: Awaited<ReturnType<typeof getScaleConsignmentsForOwner>>) {
  return consignments.map((c) => ({
    ...c,
    isScale: true,
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
}

export default async function OwnerConsignmentsPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();

  if (activeStore?.storeType === "scale") {
    const consignments = await getScaleConsignmentsForOwner();
    const reshaped = reshapeScale(consignments);
    return <OwnerConsignmentsClient consignments={JSON.parse(JSON.stringify(reshaped))} />;
  }

  const consignments = await getConsignmentsForOwner();

  // Always check for scale consignments on standard stores, regardless of
  // whether the toggle is CURRENTLY on — if admin turned it off while one
  // was still open, the owner must still be able to see and reconcile it
  // by hand. Only the write actions (sign out new stock, add scale items)
  // are gated by the live toggle value; visibility of existing data isn't.
  const scaleConsignments = await getScaleConsignmentsForOwner();

  const combined: any[] = scaleConsignments.length > 0 ? [...consignments, ...reshapeScale(scaleConsignments)] : consignments;

  return <OwnerConsignmentsClient consignments={JSON.parse(JSON.stringify(combined))} />;
}