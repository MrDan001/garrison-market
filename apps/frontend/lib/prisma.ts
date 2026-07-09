import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Only disable SSL if absolutely necessary for local dev. 
// Remove this in production for security.
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in your .env file.");
  }

  // Initialize the pool
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // Initialize Prisma with the adapter and extensions
  return new PrismaClient({ adapter }).$extends({
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
};

// Global singleton pattern to prevent multiple instances during hot-reloads
const globalForPrisma = globalThis as unknown as { prismaGlobal: ReturnType<typeof createPrismaClient> };

const prisma = globalForPrisma.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
}

export default prisma;