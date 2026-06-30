// apps/frontend/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Initializes the MariaDB adapter.
 */
const createPrismaClient = () => {
  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'garrison_db',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
  });

  // Create the client with the adapter and extend it for global serialization
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends({
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

// Global augmentation for the singleton pattern
declare global {
  var prismaGlobal: undefined | ReturnType<typeof createPrismaClient>;
}

// Ensure the singleton survives HMR (Hot Module Replacement)
const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}