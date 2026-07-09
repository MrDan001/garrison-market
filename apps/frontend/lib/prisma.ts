import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prismaGlobal?: PrismaClient;
  pool?: Pool;
};

// Reuse the pool across hot-reloads in dev; created once per server in prod
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // prevents overwhelming Supabase's connection limit
    idleTimeoutMillis: 30000,
    ssl: {
      // Supabase's pooler presents a cert chain that Node's default strict
      // TLS validation flags as self-signed/untrusted. This still encrypts
      // the connection — it just skips validating the cert against Node's
      // trusted CA list, which is required for poolers like Supabase's.
      rejectUnauthorized: false,
    },
  });

const adapter = new PrismaPg(pool);

// NOTE: removed the empty `.$extends({})` — an extension call with nothing
// inside it still changes the client's TS type to DynamicClientExtensionThis,
// which is what dropped `$on` from the type and caused the build error.
// If you need extensions later, add real logic inside $extends and the
// exported type will just need to be inferred (`typeof prisma`) instead of
// annotated as `PrismaClient`.
const prisma = globalForPrisma.prismaGlobal ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prismaGlobal = prisma;
}

export default prisma;