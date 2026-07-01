import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Disable SSL verification for Supabase pooler
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({ adapter }).$extends({
    result: {
      order: {
        total: {
          needs: { total: true },
          compute(data) { return Number(data.total); }
        }
      },
      inventory: {
        price: {
          needs: { price: true },
          compute(data) { return Number(data.price); }
        }
      }
    }
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof createPrismaClient>;
}

const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}