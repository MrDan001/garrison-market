// FILE: apps/frontend/app/owner/inventory/page.tsx

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getActiveStore } from "@/lib/store-context";
import InventoryGrid from "@/components/InventoryGrid";
import ScaleInventoryGrid from "@/components/ScaleInventoryGrid";
import OwnerInventoryModeSwitcher from "@/components/OwnerInventoryModeSwitcher";
import { getStaffForScaleOverride, getStaffScaleStockSummary } from "@/lib/consignment.actions";
import { getProductCategories } from "@/lib/category.actions";

export const dynamic = "force-dynamic";

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const activeStore = await getActiveStore();
  const storeId = activeStore?.id ?? null;

  // Scale stores run entirely on the ScaleInventory model — the
  // storeType choice made permanently at store creation decides this.
  if (activeStore?.storeType === "scale") {
    const scaleItems = await prisma.scaleInventory.findMany({
      where: { ownerId: session.id, storeId },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        price: true,
        costPrice: true,
        category: true,
        categoryRef: { select: { name: true } },
        sku: true,
        trackExpiry: true,
        expiryDate: true,
        restockLevel: true,
        image: true,
      },
      orderBy: { name: "asc" },
    });

    const scaleSalesCounts = await prisma.scaleOrderItem.groupBy({
      by: ["scaleInventoryId"],
      where: {
        scaleInventory: { ownerId: session.id, storeId },
      },
      _sum: { quantityInBaseUnit: true },
    });
    const scaleSalesMap = new Map<number, number>();
    scaleSalesCounts.forEach((s) => {
      scaleSalesMap.set(s.scaleInventoryId, Number(s._sum.quantityInBaseUnit ?? 0));
    });

    const serialized = scaleItems.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      price: Number(item.price),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      category: item.category,
      categoryName: item.categoryRef?.name ?? null,
      sku: item.sku,
      trackExpiry: item.trackExpiry,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
      restockLevel: item.restockLevel != null ? Number(item.restockLevel) : null,
      image: item.image,
      salesCount: scaleSalesMap.get(item.id) ?? 0,
    }));

    return (
      <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
        <ScaleInventoryGrid items={serialized} categories={await getProductCategories()} />
      </Suspense>
    );
  }

  const items = await prisma.inventory.findMany({
    where: {
      ownerId: session.id,
      ...(storeId ? { storeId } : {}),
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      costPrice: true,
      category: true,
      categoryRef: { select: { name: true } },
      sku: true,
      trackExpiry: true,
      expiryDate: true,
      restockLevel: true,
      image: true,
      ownerId: true,
    },
    orderBy: { name: "asc" },
  });

  const salesCounts = await prisma.orderItem.groupBy({
    by: ["inventoryId"],
    where: {
      inventory: {
        ownerId: session.id,
        ...(storeId ? { storeId } : {}),
      },
    },
    _sum: {
      quantity: true,
    },
  });

  const salesMap = new Map<string | number, number>();
  salesCounts.forEach((s) => {
    salesMap.set(s.inventoryId, s._sum.quantity ?? 0);
  });

  const serialized = items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    price: Number(item.price),
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    category: item.category,
    categoryName: item.categoryRef?.name ?? null,
    sku: item.sku,
    trackExpiry: item.trackExpiry,
    expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
    restockLevel: item.restockLevel,
    image: item.image,
    salesCount: salesMap.get(item.id) ?? 0,
  }));

  // Admin-only override: standard stores keep their normal Inventory as-is,
  // but if the owner has scaleConsignmentEnabled on, they also get Scale
  // Inventory for the daily consignment-to-staff flow. Stage 1: instead of
  // showing that Scale panel stacked underneath the List grid, it now sits
  // behind a List/Scale toggle at the top of the page, matching the pattern
  // already used on the staff inventory page.
  const owner = await prisma.user.findUnique({
    where: { id: session.id },
    select: { scaleConsignmentEnabled: true },
  });

  if (owner?.scaleConsignmentEnabled) {
    const [scaleItems, staff, scaleSalesCounts, staffStockSummary] = await Promise.all([
      prisma.scaleInventory.findMany({
        where: { ownerId: session.id, storeId },
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          price: true,
          costPrice: true,
          category: true,
          categoryRef: { select: { name: true } },
          sku: true,
          trackExpiry: true,
          expiryDate: true,
          restockLevel: true,
          image: true,
        },
        orderBy: { name: "asc" },
      }),
      getStaffForScaleOverride(),
      prisma.scaleOrderItem.groupBy({
        by: ["scaleInventoryId"],
        where: { scaleInventory: { ownerId: session.id, storeId } },
        _sum: { quantityInBaseUnit: true },
      }),
      getStaffScaleStockSummary(),
    ]);

    const scaleSalesMap = new Map<number, number>();
    scaleSalesCounts.forEach((s) => {
      scaleSalesMap.set(s.scaleInventoryId, Number(s._sum.quantityInBaseUnit ?? 0));
    });

    const serializedScaleItems = scaleItems.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
      price: Number(i.price),
      costPrice: i.costPrice != null ? Number(i.costPrice) : null,
      category: i.category,
      categoryName: i.categoryRef?.name ?? null,
      sku: i.sku,
      trackExpiry: i.trackExpiry,
      expiryDate: i.expiryDate ? i.expiryDate.toISOString() : null,
      salesCount: scaleSalesMap.get(i.id) ?? 0,
      restockLevel: i.restockLevel != null ? Number(i.restockLevel) : null,
      image: i.image,
    }));

    return (
      <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
        <OwnerInventoryModeSwitcher
          listItems={serialized}
          scaleItems={serializedScaleItems}
          staff={staff}
          staffStock={staffStockSummary}
          categories={await getProductCategories()}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
      <InventoryGrid items={serialized} categories={await getProductCategories()} />
    </Suspense>
  );
}