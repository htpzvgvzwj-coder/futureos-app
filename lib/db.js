import { Pool } from "pg";

// Reuse a single pool across hot-reloads in dev and across warm serverless
// invocations in production — creating a new Pool per request/module-load
// exhausts Neon's connection limit within minutes.
const globalForDb = globalThis;

export const pool =
  globalForDb.__weddingDbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__weddingDbPool = pool;
}

export async function query(text, params) {
  return pool.query(text, params);
}
