// FILE: apps/frontend/scripts/backfill-product-categories.ts
//
// One-time migration: every distinct non-empty value currently sitting in
// Inventory.category / ScaleInventory.category (the old free-text field)
// becomes a real ProductCategory row for that owner, and every item with
// that string gets its categoryId linked. The old string field is left
// untouched afterward — it's just no longer read by the app.
//
// Safe to re-run: items that already have a categoryId are skipped, and
// category names are matched case-insensitively per owner so re-running
// won't create duplicates.
//
// Run with:  npx tsx scripts/backfill-product-categories.ts

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

async function backfillTable(
  table: "inventory" | "scaleInventory",
  categoryCache: Map<string, number> // key: `${ownerId}:${lowercased name}` -> categoryId
) {
  const model = (prisma as any)[table];

  const items: { id: number; ownerId: number; category: string | null }[] = await model.findMany({
    where: { categoryId: null, category: { not: null } },
    select: { id: true, ownerId: true, category: true },
  });

  let linked = 0;
  for (const item of items) {
    const name = item.category?.trim();
    if (!name) continue;

    const cacheKey = `${item.ownerId}:${name.toLowerCase()}`;
    let categoryId = categoryCache.get(cacheKey);

    if (!categoryId) {
      // Look for an existing category first (case-insensitive), in case a
      // previous partial run — or the owner manually using the new picker —
      // already created it.
      const existing = await prisma.productCategory.findFirst({
        where: { ownerId: item.ownerId, name: { equals: name, mode: "insensitive" } },
      });
      const category =
        existing ??
        (await prisma.productCategory.create({
          data: { ownerId: item.ownerId, name },
        }));
      categoryId = category.id;
      categoryCache.set(cacheKey, categoryId);
    }

    await model.update({ where: { id: item.id }, data: { categoryId } });
    linked++;
  }

  console.log(`  ${table}: linked ${linked} of ${items.length} item(s) with a legacy category string`);
}

async function main() {
  console.log("Backfilling product categories from legacy string fields...");
  const categoryCache = new Map<string, number>();

  await backfillTable("inventory", categoryCache);
  await backfillTable("scaleInventory", categoryCache);

  console.log(`Done. Created/matched ${categoryCache.size} distinct (owner, category) pair(s).`);
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