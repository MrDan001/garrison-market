// FILE: apps/frontend/lib/stock-loss-return-scale.actions.ts
//
// Scale-inventory counterpart to stock-loss-return.actions.ts. Same
// mechanics — targets one specific batch directly (no FIFO), decrements
// that batch's remainingQty and ScaleInventory.quantity together — just
// Decimal-quantity and unit-aware.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { assertSubscriptionActive } from "./subscription-guard";

const LOSS_REASONS = ["Damaged", "Expired", "Theft", "Spillage", "Other"] as const;

export async function recordScaleStockLossAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  try {
    await assertSubscriptionActive(session.id);
  } catch (err: any) {
    return { success: false, error: err?.message || "Your trial or subscription has ended." };
  }

  const batchId = parseInt(formData.get("batchId") as string, 10);
  const quantity = parseFloat(formData.get("quantity") as string);
  const reasonRaw = (formData.get("reason") as string) || "Other";
  const reason = (LOSS_REASONS as readonly string[]).includes(reasonRaw) ? reasonRaw : "Other";
  const note = (formData.get("note") as string) || null;

  if (isNaN(batchId) || isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Enter a valid quantity." };
  }

  const batch = await prisma.scaleStockBatch.findFirst({
    where: { id: batchId, ownerId: session.id },
  });
  if (!batch) return { success: false, error: "Batch not found." };
  if (quantity > Number(batch.remainingQty)) {
    return { success: false, error: `Only ${Number(batch.remainingQty)} left in this batch.` };
  }

  await prisma.$transaction([
    prisma.scaleStockBatch.updateMany({
      where: { id: batch.id, remainingQty: batch.remainingQty },
      data: { remainingQty: { decrement: quantity } },
    }),
    prisma.scaleInventory.update({
      where: { id: batch.scaleInventoryId },
      data: { quantity: { decrement: quantity } },
    }),
    prisma.scaleStockLoss.create({
      data: {
        scaleInventoryId: batch.scaleInventoryId,
        scaleStockBatchId: batch.id,
        ownerId: session.id,
        storeId: batch.storeId ?? undefined,
        quantity,
        reason,
        note,
        recordedById: session.id,
      },
    }),
  ]);

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function recordScaleStockReturnAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  try {
    await assertSubscriptionActive(session.id);
  } catch (err: any) {
    return { success: false, error: err?.message || "Your trial or subscription has ended." };
  }

  const batchId = parseInt(formData.get("batchId") as string, 10);
  const quantity = parseFloat(formData.get("quantity") as string);
  const supplierName = (formData.get("supplierName") as string) || null;
  const reason = (formData.get("reason") as string) || null;
  const refundAmountRaw = formData.get("refundAmount") as string;
  const refundAmount = refundAmountRaw ? parseFloat(refundAmountRaw) : null;
  const note = (formData.get("note") as string) || null;

  if (isNaN(batchId) || isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Enter a valid quantity." };
  }

  const batch = await prisma.scaleStockBatch.findFirst({
    where: { id: batchId, ownerId: session.id },
  });
  if (!batch) return { success: false, error: "Batch not found." };
  if (quantity > Number(batch.remainingQty)) {
    return { success: false, error: `Only ${Number(batch.remainingQty)} left in this batch.` };
  }

  await prisma.$transaction([
    prisma.scaleStockBatch.updateMany({
      where: { id: batch.id, remainingQty: batch.remainingQty },
      data: { remainingQty: { decrement: quantity } },
    }),
    prisma.scaleInventory.update({
      where: { id: batch.scaleInventoryId },
      data: { quantity: { decrement: quantity } },
    }),
    prisma.scaleStockReturn.create({
      data: {
        scaleInventoryId: batch.scaleInventoryId,
        scaleStockBatchId: batch.id,
        ownerId: session.id,
        storeId: batch.storeId ?? undefined,
        quantity,
        supplierName,
        reason,
        refundAmount: refundAmount != null && !isNaN(refundAmount) ? refundAmount : undefined,
        note,
        recordedById: session.id,
      },
    }),
  ]);

  revalidatePath("/owner/inventory");
  return { success: true };
}