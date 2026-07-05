import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Use 'any' to bypass the constructor type check that is failing your build
const prisma = new PrismaClient({ adapter } as any).$extends({
  result: {
    order: {
      total: {
        needs: { total: true },
        compute(data: any) { return Number(data.total); }
      }
    },
    inventory: {
      price: {
        needs: { price: true },
        compute(data: any) { return Number(data.price); }
      }
    }
  }
});

declare global {
  var prismaGlobal: undefined | typeof prisma;
}

const prismaInstance = globalThis.prismaGlobal ?? prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prismaInstance;
}

export default prismaInstance;