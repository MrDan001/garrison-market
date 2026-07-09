import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from "bcrypt";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//  FIXED: Using your active password string over port 5432
const connectionString = "postgresql://postgres.rlscequchmvgjjcdqxfs:Dani1429ACHS@://supabase.com";

// ✅ FIXED: Instantiating a native PostgreSQL connection pool manager
const pool = new Pool({ connectionString });

// ✅ FIXED: Binding the valid pool stream straight to Prisma's driver adapter layout
const adapter = new PrismaPg(pool);

// ✅ FIXED: Using uniform ES Module syntax for the client declaration
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = "Garrison2026!";
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@garrison.com' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@garrison.com',
      password: hashedPassword,
      role: 'admin',
      status: 'approved',
    },
  });

  console.log("Admin created successfully:", admin);
}

main()
  .catch((e) => {
    console.error("Seeding execution error encountered:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Cleanly close the native connection pool stream
  });
