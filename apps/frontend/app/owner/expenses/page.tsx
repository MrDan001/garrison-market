// FILE: apps/frontend/app/owner/expenses/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import {
  getExpenseCategories,
  getExpenseOverviewForOwner,
  getExpensesForOwner,
} from "@/lib/expense.actions";
import OwnerExpensesClient from "./owner-expenses-client";

export const dynamic = "force-dynamic";

export default async function OwnerExpensesPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const [categories, overview, initialDay] = await Promise.all([
    getExpenseCategories(),
    getExpenseOverviewForOwner(),
    getExpensesForOwner("day"),
  ]);

  return (
    <OwnerExpensesClient
      categories={categories}
      overview={overview}
      initialPeriod="day"
      initialData={initialDay}
    />
  );
}