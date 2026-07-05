import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Set up the connection pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// 2. Initialize the adapter
const adapter = new PrismaPg(pool);

// 3. Create the client (Use a type assertion if TS is stubborn about the adapter)
const prisma = new PrismaClient({ 
  adapter 
} as any).$extends({
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

declare global {
  var prismaGlobal: undefined | typeof prisma;
}

const prismaInstance = globalThis.prismaGlobal ?? prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prismaInstance;
}

export default prismaInstance;