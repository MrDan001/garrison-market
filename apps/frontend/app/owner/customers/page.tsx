// FILE: apps/frontend/app/owner/customers/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getCustomersForOwner } from "@/lib/customer.actions";
import { getOpenDebtsForOwner } from "@/lib/debt.actions";
import CustomersClient from "./customers-client";

export const dynamic = "force-dynamic";

function sanitize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value && typeof value === "object" && value.constructor.name === "Decimal") {
        return Number(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    })
  );
}

export default async function OwnerCustomersPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  // Defaults to the current year AND month — see getCustomersForOwner for
  // how the year picker's floor is derived (this store's earliest customer).
  const now = new Date();
  const [initial, openDebts] = await Promise.all([
    getCustomersForOwner({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    getOpenDebtsForOwner(),
  ]);

  return <CustomersClient initial={initial} initialDebts={sanitize(openDebts)} />;
}