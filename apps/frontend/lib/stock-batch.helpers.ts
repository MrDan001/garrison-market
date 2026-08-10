// FILE: apps/frontend/lib/stock-batch.helpers.ts
//
// Shared FIFO stock-batch consumption logic. Any place that moves stock
// out of a product (a sale, a recorded loss, a supplier return) calls this
// to figure out which StockBatch row(s) that movement actually came from,
// oldest batch first — so a batch's own Sales/Customers/Loss/Returns/
// Activity tabs can show only what happened to that specific batch.
//
// Deliberately used by both standard (Inventory/StockBatch) and, from
// later stages, scale (ScaleInventory/ScaleStockBatch) products — the two
// call sites pass in whichever tx client and batch model they need.
//
// Not itself a server action — it's a plain helper only ever imported by
// server-side action files ("use server" modules) that call it inside
// their own transactions, so it doesn't need the directive itself.

// A loose transaction-client type — Prisma's transaction callback param
// doesn't export a clean standalone type, and this helper is called with
// either the standard or scale Prisma delegate depending on caller.
type TxClient = any;

export interface BatchConsumption {
  stockBatchId: number;
  quantity: number;
}

// Consumes `quantity` units of `inventoryId`'s stock from its StockBatch
// rows, oldest (by addedAt) first, and returns how much was drawn from
// each. Must run inside the same transaction as the operation consuming
// the stock (sale/loss/return), so the decrements are atomic with it.
//
// Best-effort, never throws: if the sum of available batch remainingQty
// is less than `quantity` (e.g. a pre-batch-tracking item, or the
// one-time backfill script hasn't been run yet), it consumes whatever
// batches exist and returns early. Inventory.quantity remains the
// authoritative stock figure elsewhere in the app — this is purely for
// batch-level attribution, so a shortfall here should never block the
// sale/loss/return itself.
export async function consumeStockBatchesFifo(
  tx: TxClient,
  inventoryId: number,
  quantity: number
): Promise<BatchConsumption[]> {
  if (quantity <= 0) return [];

  const batches = await tx.stockBatch.findMany({
    where: { inventoryId, remainingQty: { gt: 0 } },
    orderBy: { addedAt: "asc" },
  });

  const consumed: BatchConsumption[] = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.remainingQty);
    if (take <= 0) continue;

    // Same optimistic-lock convention as the Inventory quantity decrement
    // this runs alongside: if another concurrent operation already
    // touched this exact batch, skip it rather than fail the whole
    // sale — the next batch in line picks up the slack, or the shortfall
    // is simply left unattributed to any batch.
    const updateResult = await tx.stockBatch.updateMany({
      where: { id: batch.id, remainingQty: batch.remainingQty },
      data: { remainingQty: { decrement: take } },
    });
    if (updateResult.count === 0) continue;

    consumed.push({ stockBatchId: batch.id, quantity: take });
    remaining -= take;
  }

  return consumed;
}

// Same as consumeStockBatchesFifo above, for ScaleInventory's ScaleStockBatch
// model. Kept as a separate function rather than a generic one because
// Prisma's typed client needs the concrete model name (tx.scaleStockBatch
// vs tx.stockBatch) — the logic itself is identical, just Decimal-typed
// quantities instead of Int.
export async function consumeScaleStockBatchesFifo(
  tx: TxClient,
  scaleInventoryId: number,
  quantity: number
): Promise<BatchConsumption[]> {
  if (quantity <= 0) return [];

  const batches = await tx.scaleStockBatch.findMany({
    where: { scaleInventoryId, remainingQty: { gt: 0 } },
    orderBy: { addedAt: "asc" },
  });

  const consumed: BatchConsumption[] = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const batchRemaining = Number(batch.remainingQty);
    const take = Math.min(remaining, batchRemaining);
    if (take <= 0) continue;

    const updateResult = await tx.scaleStockBatch.updateMany({
      where: { id: batch.id, remainingQty: batch.remainingQty },
      data: { remainingQty: { decrement: take } },
    });
    if (updateResult.count === 0) continue;

    consumed.push({ stockBatchId: batch.id, quantity: take });
    remaining -= take;
  }

  return consumed;
}

// A third FIFO layer, specific to the scale-consignment sign-out flow.
// ownerSignOutScaleToStaffAction already draws down the master
// ScaleStockBatch pool at sign-out time (via consumeScaleStockBatchesFifo
// above) and records the resulting breakdown as ScaleConsignmentItemBatch
// rows. When a staff member later actually sells some of what was signed
// out to them, this walks THAT breakdown (oldest allocation first, by id)
// instead of touching ScaleStockBatch again — the stock already left the
// master pool at sign-out, so re-querying it here would double-count.
export async function consumeConsignmentItemBatchesFifo(
  tx: TxClient,
  consignmentItemId: number,
  quantity: number
): Promise<BatchConsumption[]> {
  if (quantity <= 0) return [];

  const allocations = await tx.scaleConsignmentItemBatch.findMany({
    where: { consignmentItemId, remainingQty: { gt: 0 } },
    orderBy: { id: "asc" },
  });

  const consumed: BatchConsumption[] = [];
  let remaining = quantity;

  for (const allocation of allocations) {
    if (remaining <= 0) break;
    const allocationRemaining = Number(allocation.remainingQty);
    const take = Math.min(remaining, allocationRemaining);
    if (take <= 0) continue;

    const updateResult = await tx.scaleConsignmentItemBatch.updateMany({
      where: { id: allocation.id, remainingQty: allocation.remainingQty },
      data: { remainingQty: { decrement: take } },
    });
    if (updateResult.count === 0) continue;

    // Note: stockBatchId here is the allocation's underlying
    // ScaleStockBatch id, not the allocation row's own id — callers use
    // this to write ScaleOrderItemBatch rows that point straight at the
    // real batch, same shape as consumeScaleStockBatchesFifo's result.
    consumed.push({ stockBatchId: allocation.scaleStockBatchId, quantity: take });
    remaining -= take;
  }

  return consumed;
}