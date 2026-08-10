// FILE: apps/frontend/app/owner/inventory/[id]/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import { getInventoryWithBatches } from "@/lib/stock-batch-scale.actions";
import { getScaleInventoryWithBatches } from "@/lib/stock-batch.actions";
import ProductDetailClient from "./product-detail-client";
import ScaleProductDetailClient from "./scale-product-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) redirect("/owner/inventory");

  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  // Same detection convention as the edit page — native scale stores
  // always use the scale form; standard stores only do when the admin's
  // scaleConsignmentEnabled override is on and the link was tagged
  // ?type=scale (i.e. it came from the Scale tab).
  const { type } = await searchParams;
  const activeStore = await getActiveStore();
  let useScale = activeStore?.storeType === "scale";
  if (!useScale && type === "scale") {
    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { scaleConsignmentEnabled: true },
    });
    useScale = !!owner?.scaleConsignmentEnabled;
  }

  if (useScale) {
    const data = await getScaleInventoryWithBatches(itemId);
    if (!data) redirect("/owner/inventory");
    return <ScaleProductDetailClient item={data.item} batches={data.batches} />;
  }

  const data = await getInventoryWithBatches(itemId);
  if (!data) redirect("/owner/inventory");
  return <ProductDetailClient item={data.item} batches={data.batches} />;
}