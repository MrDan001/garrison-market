// lib/test-user.ts
import prisma from "@/lib/prisma";

// apps/frontend/lib/test-db.ts
async function main() {
    const newUser = await prisma.user.create({
      data: {
        email: "admin@demo.com",
        password: "Admin123",
        role: "admin",
        status: "approved" // Add this field
      },
    });
    console.log("Created user:", newUser);
  }

main();