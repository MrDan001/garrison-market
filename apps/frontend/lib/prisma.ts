import { PrismaPg } from '@prisma/adapter-pg';

const createPrismaClient = () => {
  const { PrismaClient } = require('@prisma/client');
  
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

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

declare global {
  var prismaGlobal: undefined | ReturnType<typeof createPrismaClient>;
}

const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}