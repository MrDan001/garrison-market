// FILE: apps/frontend/app/staff/wastage/page.tsx

import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import { getScaleInventoryForStaff } from "@/lib/scale-inventory.actions";
import { getOpenScaleConsignmentsForStaff } from "@/lib/consignment.actions";
import { getWastageForStaff, getWastageVisibilityForStaff, getWastageReportForStaff } from "@/lib/scale-wastage.actions";
import StaffWastageClient from "./wastage-client";

export const dynamic = "force-dynamic";

export default async function StaffWastagePage() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  const activeStore = await getActiveStore();

  // Stage 2: previously only native scale-only stores could reach this
  // page. Merged stores (standard store + the admin-only
  // scaleConsignmentEnabled override) get in too now.
  const isNativeScale = activeStore?.storeType === "scale";
  let isMerged = false;
  if (!isNativeScale && session.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: session.ownerId },
      select: { scaleConsignmentEnabled: true },
    });
    isMerged = !!owner?.scaleConsignmentEnabled;
  }
  if (!isNativeScale && !isMerged) redirect("/staff/dashboard");

  // Native scale stores: staff manage the shop's whole scale pool
  // directly, same as before — the item picker lists everything.
  // Merged stores: staff only ever handle what's been signed out to
  // them (same model the sell screen already uses), so the item picker
  // here lists that instead — matching what submitWastageAction (Stage
  // 1) now validates wastage against for this store type.
  let inventory: { id: number; name: string; quantity: number; unit: string }[];
  if (isNativeScale) {
    inventory = (await getScaleInventoryForStaff()).map((i: any) => ({      id: i.id,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
    }));
  } else {
    const openConsignments = await getOpenScaleConsignmentsForStaff();
    const byItem = new Map<number, { id: number; name: string; quantity: number; unit: string }>();
    for (const c of openConsignments) {
      for (const item of c.scaleItems) {
        const remaining = Number(item.quantityOut) - Number(item.quantitySold) - Number(item.quantityWasted);
        if (remaining <= 0) continue;
        const existing = byItem.get(item.scaleInventoryId);
        if (existing) {
          existing.quantity += remaining;
        } else {
          byItem.set(item.scaleInventoryId, {
            id: item.scaleInventoryId,
            name: item.scaleInventory?.name || "Item",
            quantity: remaining,
            unit: item.unit,
          });
        }
      }
    }
    inventory = Array.from(byItem.values());
  }

  const [entries, canViewReport] = await Promise.all([
    getWastageForStaff(),
    getWastageVisibilityForStaff(),
  ]);

  // Stage 4: only fetch the monthly report when the owner's toggle is
  // actually on — no point running the aggregation query otherwise, and
  // it keeps the "locked" state honest (report is null, not just hidden
  // client-side).
  const report = canViewReport ? await getWastageReportForStaff() : null;

  return (
    <StaffWastageClient
      inventory={JSON.parse(JSON.stringify(inventory))}
      entries={JSON.parse(JSON.stringify(entries))}
      canViewReport={canViewReport}
      report={report ? JSON.parse(JSON.stringify(report)) : null}
    />
  );
}