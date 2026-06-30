import prisma from "../lib/prisma"; // Use your existing singleton
import bcrypt from "bcrypt";

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