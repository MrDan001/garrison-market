import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getActiveStore } from "@/lib/store-context";
import { getWastageForOwner } from "@/lib/scale-wastage.actions";
import OwnerWastageClient from "./owner-wastage-client";

export const dynamic = "force-dynamic";

export default async function OwnerWastagePage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();
  if (activeStore?.storeType !== "scale") redirect("/owner/dashboard");

  const data = await getWastageForOwner();

  return <OwnerWastageClient data={JSON.parse(JSON.stringify(data))} />;
}