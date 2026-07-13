import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getInventoryForStaff } from "@/lib/business.actions";
import {
  isConsignmentEnabledForStaff,
  getOpenConsignmentsForStaff,
  getConsignmentHistoryForStaff,
} from "@/lib/consignment.actions";
import StaffConsignmentClient from "./consignment-client";

export const dynamic = "force-dynamic";

export default async function StaffConsignmentPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

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