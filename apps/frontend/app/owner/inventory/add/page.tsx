// FILE: apps/frontend/app/owner/inventory/add/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import AddInventoryForm from "@/components/AddInventoryForm";
import AddScaleInventoryForm from "@/components/AddScaleInventoryForm";

export const dynamic = "force-dynamic";

interface AddInventoryItemPageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function AddInventoryItemPage({ searchParams }: AddInventoryItemPageProps) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const { type } = await searchParams;
  const activeStore = await getActiveStore();

  // Native scale stores always get the scale form. Standard stores land
  // here too when adding from the Scale tab (?type=scale) — only allowed
  // if the admin-only scaleConsignmentEnabled override is on for this
  // owner, same gate addScaleItemAction itself enforces server-side.
  if (activeStore?.storeType === "scale") {
    return <AddScaleInventoryForm />;
  }

  if (type === "scale") {
    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { scaleConsignmentEnabled: true },
    });
    if (owner?.scaleConsignmentEnabled) {
      return <AddScaleInventoryForm />;
    }
  }

  return <AddInventoryForm />;
}