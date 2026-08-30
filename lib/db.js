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

// Run `fn` inside a single BEGIN/COMMIT. `fn` receives a `tx` object with
// the same `query(text, params)` signature as the module export, but bound
// to one dedicated client so every statement is in the same transaction.
// Any throw rolls the whole thing back - nothing partially persists.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const tx = { query: (text, params) => client.query(text, params) };
    const result = await fn(tx);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* connection already broken - pool will discard it */
    }
    throw error;
  } finally {
    client.release();
  }
}
