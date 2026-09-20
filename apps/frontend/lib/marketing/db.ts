import { Pool, type QueryResultRow } from "pg";

const globalForMarketingDb = globalThis as unknown as {
  marketingPool?: Pool;
};

const pool =
  globalForMarketingDb.marketingPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: {
      rejectUnauthorized: false,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForMarketingDb.marketingPool = pool;
}

export async function marketingQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

export async function marketingQueryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T | null> {
  const rows = await marketingQuery<T>(text, values);
  return rows[0] ?? null;
}
