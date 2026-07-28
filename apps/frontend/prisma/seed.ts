import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from "bcrypt";
import 'dotenv/config';

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL is not set in your environment/.env file");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Garrison2026!";
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

  console.log("Admin created successfully:", admin.email);
}

main()
  .catch((e) => {
    console.error("Seeding execution error encountered:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });