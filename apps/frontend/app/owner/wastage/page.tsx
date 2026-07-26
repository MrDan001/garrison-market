// FILE: apps/frontend/app/owner/wastage/page.tsx

import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import { getWastageForOwner } from "@/lib/scale-wastage.actions";
import OwnerWastageClient from "./owner-wastage-client";

export const dynamic = "force-dynamic";

export default async function OwnerWastagePage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();

  // Stage 2: previously only native scale-only stores could reach this
  // page. Merged stores (standard store + the admin-only
  // scaleConsignmentEnabled override) can have wastage too, since staff
  // there sell consigned scale stock just like a native scale store's
  // staff do — they just also have a List side. getWastageForOwner()
  // itself was already store-agnostic; only this redirect was blocking
  // merged stores from ever reaching it.
  const isNativeScale = activeStore?.storeType === "scale";
  let isMerged = false;
  if (!isNativeScale) {
    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { scaleConsignmentEnabled: true },
    });
    isMerged = !!owner?.scaleConsignmentEnabled;
  }
  if (!isNativeScale && !isMerged) redirect("/owner/dashboard");

  const data = await getWastageForOwner();

  return <OwnerWastageClient data={JSON.parse(JSON.stringify(data))} />;
}
