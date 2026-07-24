import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getInventoryForStaff } from "@/lib/business.actions";
import { getScaleInventoryForStaff } from "@/lib/scale-inventory.actions";
import { getActiveStore } from "@/lib/store-context";
import {
  isConsignmentEnabledForStaff,
  getOpenConsignmentsForStaff,
  getConsignmentHistoryForStaff,
  getOpenScaleConsignmentsForStaff,
  getScaleConsignmentHistoryForStaff,
} from "@/lib/consignment.actions";
import StaffConsignmentClient from "./consignment-client";
import StaffScaleConsignmentClient from "./scale-consignment-client";

export const dynamic = "force-dynamic";

export default async function StaffConsignmentPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const activeStore = await getActiveStore();

  if (activeStore?.storeType === "scale") {
    const [enabled, inventory, openConsignments, history] = await Promise.all([
      isConsignmentEnabledForStaff(),
      getScaleInventoryForStaff(),
      getOpenScaleConsignmentsForStaff(),
      getScaleConsignmentHistoryForStaff(),
    ]);

    return (
      <StaffScaleConsignmentClient
        enabled={enabled}
        inventory={JSON.parse(JSON.stringify(inventory))}
        openConsignments={JSON.parse(JSON.stringify(openConsignments))}
        history={JSON.parse(JSON.stringify(history))}
      />
    );
  }

  const [enabled, inventory, openConsignments, history] = await Promise.all([
    isConsignmentEnabledForStaff(),
    getInventoryForStaff(),
    getOpenConsignmentsForStaff(),
    getConsignmentHistoryForStaff(),
  ]);

  return (
    <StaffConsignmentClient
      enabled={enabled}
      inventory={JSON.parse(JSON.stringify(inventory))}
      openConsignments={JSON.parse(JSON.stringify(openConsignments))}
      history={JSON.parse(JSON.stringify(history))}
    />
  );
}