import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getConsignmentsForOwner } from "@/lib/consignment.actions";
import OwnerConsignmentsClient from "./owner-consignments-client";

export const dynamic = "force-dynamic";

export default async function OwnerConsignmentsPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const consignments = await getConsignmentsForOwner();

  return <OwnerConsignmentsClient consignments={JSON.parse(JSON.stringify(consignments))} />;
}