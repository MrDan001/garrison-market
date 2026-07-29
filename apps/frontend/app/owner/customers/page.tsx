// FILE: apps/frontend/app/owner/customers/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getCustomersForOwner } from "@/lib/customer.actions";
import CustomersClient from "./customers-client";

export const dynamic = "force-dynamic";

export default async function OwnerCustomersPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  // Defaults to the current year AND month — see getCustomersForOwner for
  // how the year picker's floor is derived (this store's earliest customer).
  const now = new Date();
  const initial = await getCustomersForOwner({ year: now.getFullYear(), month: now.getMonth() + 1 });

  return <CustomersClient initial={initial} />;
}