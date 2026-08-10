// FILE: apps/frontend/app/owner/inventory/[id]/batches/[batchId]/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { getActiveStore } from "@/lib/store-context";
import { getBatchDetail } from "@/lib/stock-batch-scale.actions";
import { getScaleBatchDetail } from "@/lib/stock-batch.actions";
import BatchDetailClient from "./batch-detail-client";
import ScaleBatchDetailClient from "./scale-batch-detail-client";

interface PageProps {
  params: Promise<{ id: string; batchId: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function BatchDetailPage({ params, searchParams }: PageProps) {
  const { id, batchId } = await params;
  const parsedBatchId = parseInt(batchId, 10);
  if (isNaN(parsedBatchId)) redirect(`/owner/inventory/${id}`);

  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

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
    const detail = await getScaleBatchDetail(parsedBatchId);
    if (!detail) redirect(`/owner/inventory/${id}?type=scale`);
    return <ScaleBatchDetailClient data={detail} productId={id} />;
  }

  const detail = await getBatchDetail(parsedBatchId);
  if (!detail) redirect(`/owner/inventory/${id}`);
  return <BatchDetailClient data={detail} productId={id} />;
}