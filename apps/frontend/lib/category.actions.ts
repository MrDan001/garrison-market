// FILE: apps/frontend/lib/category.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";

// Resolves "whose category list is this" regardless of whether the caller
// is the owner themselves or one of their staff — same pattern as
// resolveOwnerScopeId in expense.actions.ts. Only owners can write, but
// staff can read (needed once staff-facing pickers/filters land in a later
// stage).
async function resolveOwnerScopeId(): Promise<number | null> {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) return null;
  return session.role === "owner" ? session.id : session.ownerId ?? null;
}

// ============================================================================
// Read — categories for the current owner scope, each annotated with a live
// item count merged across standard Inventory and ScaleInventory. A given
// owner only ever has products in one or the other (storeType is fixed per
// store), but an owner can run multiple stores of different types, so we
// always count both and add them together rather than picking one.
// ============================================================================
export async function getProductCategories() {
  const ownerScopeId = await resolveOwnerScopeId();
  if (!ownerScopeId) return [];

  const [categories, invCounts, scaleCounts] = await Promise.all([
    prisma.productCategory.findMany({
      where: { ownerId: ownerScopeId },
      orderBy: { name: "asc" },
    }),
    prisma.inventory.groupBy({
      by: ["categoryId"],
      where: { ownerId: ownerScopeId, categoryId: { not: null } },
      _count: { _all: true },
    }),
    prisma.scaleInventory.groupBy({
      by: ["categoryId"],
      where: { ownerId: ownerScopeId, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map<number, number>();
  for (const row of invCounts) {
    if (row.categoryId == null) continue;
    countMap.set(row.categoryId, (countMap.get(row.categoryId) ?? 0) + row._count._all);
  }
  for (const row of scaleCounts) {
    if (row.categoryId == null) continue;
    countMap.set(row.categoryId, (countMap.get(row.categoryId) ?? 0) + row._count._all);
  }

  return categories.map((c: { id: number; name: string }) => ({
    ...c,
    itemCount: countMap.get(c.id) ?? 0,
  }));
}

// ============================================================================
// Write — owner only, same restriction as create/rename/delete on
// ExpenseCategory.
// ============================================================================
export async function createProductCategoryAction(name: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false as const, error: "Unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false as const, error: "Category name is required." };

  const existing = await prisma.productCategory.findFirst({
    where: { ownerId: session.id, name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return { success: false as const, error: "You already have a category with that name." };

  const category = await prisma.productCategory.create({
    data: { ownerId: session.id, name: trimmed },
  });

  revalidatePath("/owner/inventory");
  revalidatePath("/owner/inventory/add");
  revalidatePath("/staff/inventory");
  return { success: true as const, category: { ...category, itemCount: 0 } };
}

export async function renameProductCategoryAction(categoryId: number, name: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false as const, error: "Unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false as const, error: "Category name is required." };

  const category = await prisma.productCategory.findFirst({ where: { id: categoryId, ownerId: session.id } });
  if (!category) return { success: false as const, error: "Category not found." };

  const clash = await prisma.productCategory.findFirst({
    where: { ownerId: session.id, name: { equals: trimmed, mode: "insensitive" }, id: { not: categoryId } },
  });
  if (clash) return { success: false as const, error: "You already have a category with that name." };

  await prisma.productCategory.update({ where: { id: categoryId }, data: { name: trimmed } });

  revalidatePath("/owner/inventory");
  revalidatePath("/staff/inventory");
  return { success: true as const };
}

// Deleting a category does NOT delete the products in it — schema's
// onDelete: SetNull means those rows just lose their category and show as
// "No Category" going forward, same convention as expense categories.
export async function deleteProductCategoryAction(categoryId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return { success: false as const, error: "Unauthorized" };

  const category = await prisma.productCategory.findFirst({ where: { id: categoryId, ownerId: session.id } });
  if (!category) return { success: false as const, error: "Category not found." };

  await prisma.productCategory.delete({ where: { id: categoryId } });

  revalidatePath("/owner/inventory");
  revalidatePath("/staff/inventory");
  return { success: true as const };
}