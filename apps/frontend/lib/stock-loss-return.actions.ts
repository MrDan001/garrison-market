// FILE: apps/frontend/lib/stock-loss-return.actions.ts
//
// Stage 4 of the batch-tracking feature: recording a loss (damaged,
// expired, stolen, spilled) or a supplier return against one specific
// batch — always the batch the owner is looking at on its detail screen,
// so unlike a sale there's no FIFO to resolve. Both decrement that
// batch's remainingQty and the product's Inventory.quantity together, in
// one transaction, the same optimistic-lock way a sale does.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { assertSubscriptionActive } from "./subscription-guard";

const LOSS_REASONS = ["Damaged", "Expired", "Theft", "Spillage", "Other"] as const;

export async function recordStockLossAction(
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
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const reasonRaw = (formData.get("reason") as string) || "Other";
  const reason = (LOSS_REASONS as readonly string[]).includes(reasonRaw) ? reasonRaw : "Other";
  const note = (formData.get("note") as string) || null;

  if (isNaN(batchId) || isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Enter a valid quantity." };
  }

  const batch = await prisma.stockBatch.findFirst({
    where: { id: batchId, ownerId: session.id },
  });
  if (!batch) return { success: false, error: "Batch not found." };
  if (quantity > batch.remainingQty) {
    return { success: false, error: `Only ${batch.remainingQty} left in this batch.` };
  }

  await prisma.$transaction([
    prisma.stockBatch.updateMany({
      where: { id: batch.id, remainingQty: batch.remainingQty },
      data: { remainingQty: { decrement: quantity } },
    }),
    prisma.inventory.update({
      where: { id: batch.inventoryId },
      data: { quantity: { decrement: quantity } },
    }),
    prisma.stockLoss.create({
      data: {
        inventoryId: batch.inventoryId,
        stockBatchId: batch.id,
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

export async function recordStockReturnAction(
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
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const supplierName = (formData.get("supplierName") as string) || null;
  const reason = (formData.get("reason") as string) || null;
  const refundAmountRaw = formData.get("refundAmount") as string;
  const refundAmount = refundAmountRaw ? parseFloat(refundAmountRaw) : null;
  const note = (formData.get("note") as string) || null;

  if (isNaN(batchId) || isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Enter a valid quantity." };
  }

  const batch = await prisma.stockBatch.findFirst({
    where: { id: batchId, ownerId: session.id },
  });
  if (!batch) return { success: false, error: "Batch not found." };
  if (quantity > batch.remainingQty) {
    return { success: false, error: `Only ${batch.remainingQty} left in this batch.` };
  }

  await prisma.$transaction([
    prisma.stockBatch.updateMany({
      where: { id: batch.id, remainingQty: batch.remainingQty },
      data: { remainingQty: { decrement: quantity } },
    }),
    prisma.inventory.update({
      where: { id: batch.inventoryId },
      data: { quantity: { decrement: quantity } },
    }),
    prisma.stockReturn.create({
      data: {
        inventoryId: batch.inventoryId,
        stockBatchId: batch.id,
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