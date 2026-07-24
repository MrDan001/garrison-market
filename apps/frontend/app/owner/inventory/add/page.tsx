import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStore } from "@/lib/store-context";
import AddInventoryForm from "@/components/AddInventoryForm";
import AddScaleInventoryForm from "@/components/AddScaleInventoryForm";

export const dynamic = "force-dynamic";

export default async function AddInventoryItemPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();

  // storeType decides which form renders — chosen permanently at store
  // creation, so there's nothing else to branch on here.
  if (activeStore?.storeType === "scale") {
    return <AddScaleInventoryForm />;
  }

  return <AddInventoryForm />;
}