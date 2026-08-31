import { query } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/readiness - can the app actually serve traffic: DB reachable +
// the core tables present (a proxy for "migrations applied"). Returns 503
// when not ready. No secrets, no counts, no infra details.
const REQUIRED_TABLES = ["users", "user_sessions", "bank_accounts", "bank_transactions", "financial_assets", "liabilities", "ripple_events"];

export async function GET() {
  const checks = {};
  let ready = true;

  try {
    await query("select 1");
    checks.database = "ok";
  } catch {
    checks.database = "unreachable";
    ready = false;
  }

  if (checks.database === "ok") {
    try {
      const res = await query(
        `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`,
        [REQUIRED_TABLES],
      );
      const present = new Set(res.rows.map((r) => r.table_name));
      const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
      checks.migrations = missing.length === 0 ? "ok" : "incomplete";
      if (missing.length) {
        ready = false;
        checks.missingTables = missing;
      }
    } catch {
      checks.migrations = "unknown";
      ready = false;
    }
  }

  return Response.json({ ready, checks, time: new Date().toISOString() }, { status: ready ? 200 : 503 });
}
