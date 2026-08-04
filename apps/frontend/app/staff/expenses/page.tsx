// FILE: apps/frontend/app/staff/expenses/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getExpenseCategories, getExpensesForStaffToday } from "@/lib/expense.actions";
import StaffExpensesClient from "./staff-expenses-client";

export const dynamic = "force-dynamic";

export default async function StaffExpensesPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  const [categories, todayData] = await Promise.all([
    getExpenseCategories(),
    getExpensesForStaffToday(),
  ]);

  return <StaffExpensesClient categories={categories} initialData={todayData} />;
}