// FILE: apps/frontend/lib/expense.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { getActiveStoreId } from "./store-context";

// Resolves "whose expense book is this" regardless of whether the caller
// is the owner themselves or one of their staff — every read/write below
// starts from this, same pattern as getOpenDebtsForStaff.
async function resolveOwnerScopeId(): Promise<{ ownerScopeId: number; userId: number; role: "owner" | "staff" } | null> {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) return null;
  const ownerScopeId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerScopeId) return null;
  return { ownerScopeId, userId: session.id, role: session.role };
}

// ============================================================================
// Categories — owner-managed. Both roles can READ the list (staff need it
// for the picker when logging an expense); only the owner can create,
// rename, or delete a category.
// ============================================================================
export async function getExpenseCategories() {
  const scope = await resolveOwnerScopeId();
  if (!scope) return [];

  return prisma.expenseCategory.findMany({
    where: { ownerId: scope.ownerScopeId },
    orderBy: { name: "asc" },
  });
}

export async function createExpenseCategoryAction(name: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false as const, error: "Unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false as const, error: "Category name is required." };

  const existing = await prisma.expenseCategory.findFirst({
    where: { ownerId: session.id, name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return { success: false as const, error: "You already have a category with that name." };

  const category = await prisma.expenseCategory.create({
    data: { ownerId: session.id, name: trimmed },
  });

  revalidatePath("/owner/expenses");
  revalidatePath("/staff/expenses");
  return { success: true as const, category };
}

export async function renameExpenseCategoryAction(categoryId: number, name: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false as const, error: "Unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false as const, error: "Category name is required." };

  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, ownerId: session.id } });
  if (!category) return { success: false as const, error: "Category not found." };

  const clash = await prisma.expenseCategory.findFirst({
    where: { ownerId: session.id, name: { equals: trimmed, mode: "insensitive" }, id: { not: categoryId } },
  });
  if (clash) return { success: false as const, error: "You already have a category with that name." };

  await prisma.expenseCategory.update({ where: { id: categoryId }, data: { name: trimmed } });

  revalidatePath("/owner/expenses");
  revalidatePath("/staff/expenses");
  return { success: true as const };
}

// Deleting a category does NOT delete the expenses logged under it — the
// schema's onDelete: SetNull means those rows just lose their category
// label and show as "Uncategorized" going forward.
export async function deleteExpenseCategoryAction(categoryId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false as const, error: "Unauthorized" };

  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, ownerId: session.id } });
  if (!category) return { success: false as const, error: "Category not found." };

  await prisma.expenseCategory.delete({ where: { id: categoryId } });

  revalidatePath("/owner/expenses");
  revalidatePath("/staff/expenses");
  return { success: true as const };
}

// ============================================================================
// Add an expense — owner or staff, same action either way. Always
// attributed to whoever is actually logged in (loggedById), which is what
// lets the shared "today" view show "Logged by: X" per entry.
// ============================================================================
export async function addExpenseAction(params: { categoryId?: number; amount: number; note?: string }) {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) {
    return { success: false as const, error: "Unauthorized" };
  }
  const ownerScopeId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerScopeId) return { success: false as const, error: "No store assigned to this account." };

  if (isNaN(params.amount) || params.amount <= 0) {
    return { success: false as const, error: "Enter a valid amount." };
  }

  if (params.categoryId) {
    const category = await prisma.expenseCategory.findFirst({ where: { id: params.categoryId, ownerId: ownerScopeId } });
    if (!category) return { success: false as const, error: "Choose a valid category." };
  }

  const storeId = await getActiveStoreId();

  const expense = await prisma.expense.create({
    data: {
      ownerId: ownerScopeId,
      storeId,
      categoryId: params.categoryId ?? null,
      amount: params.amount,
      note: params.note?.trim() || null,
      loggedById: session.id,
    },
  });

  revalidatePath("/owner/expenses");
  revalidatePath("/staff/expenses");
  return { success: true as const, id: expense.id };
}

// ============================================================================
// Staff — today's expenses, store-wide (everyone's entries, not just their
// own), re-derived from the current server clock on every load rather than
// anything stored client-side, so it "resets" automatically at midnight
// with no extra logic needed.
// ============================================================================
export async function getExpensesForStaffToday() {
  const scope = await resolveOwnerScopeId();
  if (!scope) return { expenses: [], total: 0 };

  const storeId = await getActiveStoreId();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const expenses = await prisma.expense.findMany({
    where: {
      ownerId: scope.ownerScopeId,
      ...(storeId ? { storeId } : {}),
      createdAt: { gte: startOfToday, lt: startOfTomorrow },
    },
    include: {
      category: { select: { name: true } },
      loggedBy: { select: { fullName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = expenses.reduce((sum: number, e: { amount: unknown }) => sum + Number(e.amount), 0);
  // Decimal fields (amount) don't cross the server->client boundary safely
  // as-is in this codebase (same reason app/staff/debts/page.tsx runs its
  // own sanitize pass) — convert to plain numbers here, once, so every
  // caller (page props AND direct client-side calls to this action) gets
  // an already-safe shape without needing to remember to do it themselves.
  const safeExpenses = expenses.map((e: any) => ({ ...e, amount: Number(e.amount), isMine: e.loggedById === scope.userId }));
  return { expenses: safeExpenses, total };
}

// ============================================================================
// Owner — full expense history, filterable by day / month / year. Pass any
// referenceDate that falls within the period you want (e.g. any day in
// August 2026 for a "month" query); the range is derived from it.
// ============================================================================
function getDateRange(period: "day" | "month" | "year", referenceDate: Date): { start: Date; end: Date; label: string } {
  if (period === "day") {
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, label: start.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) };
  }
  if (period === "month") {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
    return { start, end, label: start.toLocaleDateString("en-NG", { month: "long", year: "numeric" }) };
  }
  const start = new Date(referenceDate.getFullYear(), 0, 1);
  const end = new Date(referenceDate.getFullYear() + 1, 0, 1);
  return { start, end, label: String(referenceDate.getFullYear()) };
}

export async function getExpensesForOwner(period: "day" | "month" | "year", referenceDateISO?: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { expenses: [], total: 0, count: 0, label: "" };

  const referenceDate = referenceDateISO ? new Date(referenceDateISO) : new Date();
  const { start, end, label } = getDateRange(period, referenceDate);
  const storeId = await getActiveStoreId();

  const expenses = await prisma.expense.findMany({
    where: {
      ownerId: session.id,
      ...(storeId ? { storeId } : {}),
      createdAt: { gte: start, lt: end },
    },
    include: {
      category: { select: { name: true } },
      loggedBy: { select: { fullName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = expenses.reduce((sum: number, e: { amount: unknown }) => sum + Number(e.amount), 0);
  const safeExpenses = expenses.map((e: any) => ({ ...e, amount: Number(e.amount) }));
  return { expenses: safeExpenses, total, count: expenses.length, label };
}

// Quick-glance totals for the top of the owner's page — today, this month,
// this year, all in one call rather than three separate round trips.
export async function getExpenseOverviewForOwner() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return null;

  const now = new Date();
  const [today, month, year] = await Promise.all([
    getExpensesForOwner("day", now.toISOString()),
    getExpensesForOwner("month", now.toISOString()),
    getExpensesForOwner("year", now.toISOString()),
  ]);

  return {
    today: { total: today.total, count: today.count },
    month: { total: month.total, count: month.count, label: month.label },
    year: { total: year.total, count: year.count, label: year.label },
  };
}