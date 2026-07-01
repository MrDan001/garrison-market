import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "postgresql://postgres.rlscequchmvgjjcdqxfs:4gAJd6LaWx0ROADB@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
});