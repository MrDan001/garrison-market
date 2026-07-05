import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from "bcrypt";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({
  connectionString: "postgresql://postgres.rlscequchmvgjjcdqxfs:4gAJd6LaWx0ROADB@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
});

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

  console.log("Admin created:", admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });