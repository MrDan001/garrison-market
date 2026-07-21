import 'dotenv/config'; // Required to load .env variables
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // CLI-only (db push / migrate / studio). This must be a direct or
    // session-mode connection — Supabase's transaction pooler (port 6543,
    // what DATABASE_URL points at) doesn't support the persistent/prepared
    // statement behavior the schema engine needs, which is what caused the
    // earlier "prepared statement already exists" and P1001 errors.
    //
    // The app itself never reads this — lib/prisma.ts builds its own pg
    // Pool from process.env.DATABASE_URL (the pooler) for runtime queries,
    // completely separately from what the CLI uses here. So this change
    // only affects `prisma db push`/`migrate`/`studio`, not live traffic.
    url: env('DIRECT_URL'),
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
});