import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  // Place migrations here at the top level of the config object
  migrations: {
    seed: 'tsx ./prisma/seed.ts',  },
});