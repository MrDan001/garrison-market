import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getActiveStore } from "@/lib/store-context";
import { getScaleInventoryForStaff } from "@/lib/scale-inventory.actions";
import { getWastageForStaff, getWastageVisibilityForStaff } from "@/lib/scale-wastage.actions";
import StaffWastageClient from "./wastage-client";

export const dynamic = "force-dynamic";

export default async function StaffWastagePage() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  const activeStore = await getActiveStore();
  if (activeStore?.storeType !== "scale") redirect("/staff/dashboard");

  const [inventory, entries, canViewReport] = await Promise.all([
    getScaleInventoryForStaff(),
    getWastageForStaff(),
    getWastageVisibilityForStaff(),
  ]);

  return (
    <StaffWastageClient
      inventory={JSON.parse(JSON.stringify(inventory))}
      entries={JSON.parse(JSON.stringify(entries))}
      canViewReport={canViewReport}
    />
  );
}