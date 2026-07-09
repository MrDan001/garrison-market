import 'dotenv/config'; // Required to load .env variables
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'), // This is the required property
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
});