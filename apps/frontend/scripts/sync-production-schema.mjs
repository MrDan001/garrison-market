import { spawnSync } from "node:child_process";

// One-time, explicitly enabled production schema reconciliation. This is
// deliberately opt-in so ordinary builds, previews, and CI never mutate a DB.
if (process.env.VERCEL_ENV !== "production" || process.env.PRISMA_SYNC_SCHEMA !== "1") {
  console.log("[schema-sync] Skipped (not explicitly enabled for a production deployment).");
  process.exit(0);
}

if (!process.env.DIRECT_URL) {
  console.error("[schema-sync] DIRECT_URL is required for the production schema sync.");
  process.exit(1);
}

console.log("[schema-sync] Reconciling the production database with the checked-in Prisma schema...");
const result = spawnSync("npx", ["prisma", "db", "push"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
