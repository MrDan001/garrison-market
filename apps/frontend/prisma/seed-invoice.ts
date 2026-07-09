import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg"; // Native PostgreSQL pool coordinator connection driver
import * as dotenv from "dotenv";
import * as path from "path";

// 1. Load local environment configuration variable credentials safely
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// 2. Set your Supabase connection string parameter
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres.rlscequchmvgjjcdqxfs:Dani1429ACHS@://supabase.com";

// 3. Temporarily pass insecure TLS flags exactly as defined in your main client file
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 4. Initialize a direct PostgreSQL pool cluster instance matching your main setup configuration
const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);

// 5. Build the client instance using valid modern ES imports while preserving your custom computation rules
const prisma = new PrismaClient({ adapter }).$extends({
  result: {
    order: {
      total: {
        needs: { total: true },
        compute(data: { total: any }) { return Number(data.total); }
      }
    },
    inventory: {
      price: {
        needs: { price: true },
        compute(data: { price: any }) { return Number(data.price); }
      }
    }
  }
});

async function main() {
  console.log("⏳ Connecting directly via your PostgreSQL Driver Adapter...");

  // Find your active owner account profile record 
  const owner = await prisma.user.findFirst({
    where: { role: "owner" }
  });

  if (!owner) {
    console.log("❌ Execution stopped: Create an owner account first!");
    return;
  }

  // Find or create a sample product to assign to the purchase invoice
  const item = await prisma.inventory.findFirst({
    where: { ownerId: owner.id }
  }) || await prisma.inventory.create({
    data: {
      name: "Test iPhone 15 Pro",
      quantity: 10,
      price: 150000,
      costPrice: 120000,
      category: "phones",
      restockLevel: 2,
      ownerId: owner.id
    }
  });

  // Insert a test invoice order block into your Supabase database 
  const newOrder = await prisma.order.create({
    data: {
      total: 150000,
      ownerId: owner.id,
      items: {
        create: {
          inventoryId: item.id,
          quantity: 1,
          priceAtTime: 150000
        }
      }
    }
  });

  console.log(`\n✅ Success! Created sample invoice record: INV-#${newOrder.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Clean up the connection pool
  });
