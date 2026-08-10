// FILE: apps/frontend/scripts/backfill-scale-stock-batches.ts
//
// Scale-inventory counterpart to backfill-stock-batches.ts. Same purpose:
// every ScaleInventory row created before batch tracking existed gets a
// single opening ScaleStockBatch representing its current stock, dated at
// the item's own createdAt. Safe to re-run — skips items that already
// have at least one batch, and skips items with quantity <= 0.
//
// Run with:  npx tsx scripts/backfill-scale-stock-batches.ts

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is not set in your environment/.env file");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Backfilling opening stock batches for pre-existing scale inventory...");

  const items = await prisma.scaleInventory.findMany({
    where: {
      quantity: { gt: 0 },
      stockBatches: { none: {} },
    },
    select: {
      id: true,
      ownerId: true,
      storeId: true,
      quantity: true,
      costPrice: true,
      price: true,
      expiryDate: true,
      createdAt: true,
    },
  });

  let created = 0;
  for (const item of items) {
    await prisma.scaleStockBatch.create({
      data: {
        scaleInventoryId: item.id,
        ownerId: item.ownerId,
        storeId: item.storeId ?? undefined,
        originalQty: item.quantity,
        remainingQty: item.quantity,
        costPrice: item.costPrice ?? undefined,
        sellingPriceAtTime: item.price,
        expiryDate: item.expiryDate,
        addedAt: item.createdAt,
        createdById: item.ownerId,
      },
    });
    created++;
  }

  console.log(`Done. Created ${created} opening batch(es) for ${items.length} scale item(s) with no existing batch.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });