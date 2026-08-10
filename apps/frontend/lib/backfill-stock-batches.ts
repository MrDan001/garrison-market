// FILE: apps/frontend/scripts/backfill-stock-batches.ts
//
// One-time migration: every Inventory row created before batch tracking
// existed has a quantity but no StockBatch behind it. This gives each such
// item a single "opening" batch representing its current stock, dated at
// the item's own createdAt, using its current costPrice/price/expiryDate.
//
// Items with quantity <= 0 are skipped (addItemAction does the same —
// nothing was actually added yet, so there's nothing to backfill). Items
// that already have at least one batch are skipped too, so this is safe
// to re-run.
//
// Run with:  npx tsx scripts/backfill-stock-batches.ts

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
  console.log("Backfilling opening stock batches for pre-existing inventory...");

  const items = await prisma.inventory.findMany({
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
    await prisma.stockBatch.create({
      data: {
        inventoryId: item.id,
        ownerId: item.ownerId,
        storeId: item.storeId ?? undefined,
        originalQty: item.quantity,
        remainingQty: item.quantity,
        costPrice: item.costPrice ?? undefined,
        sellingPriceAtTime: item.price,
        expiryDate: item.expiryDate,
        addedAt: item.createdAt,
        // No record of who originally added it — the owner is the closest
        // accurate attribution available.
        createdById: item.ownerId,
      },
    });
    created++;
  }

  console.log(`Done. Created ${created} opening batch(es) for ${items.length} item(s) with no existing batch.`);
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