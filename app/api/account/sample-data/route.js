import { getCurrentUserId } from "../../../../lib/auth.js";
import { guard } from "../../../../lib/http-guards.js";
import { buildSampleAccount, wipeSampleAccount } from "../../../../lib/sample-data/build.js";
import { recordAuditEvent } from "../../../../lib/account-control/store.js";

export const runtime = "nodejs";
export const maxDuration = 120; // the build writes ~130 transactions + 6 plans

// POST /api/account/sample-data
//   { action: "load" }  -> replace THIS account's data with the example
//                          dataset (accounts, 90d of transactions, income,
//                          bills, assets, five Studio plans + commitments,
//                          the three links, a Care Circle row). Every row
//                          is source_type 'synthetic_fixture'.
//   { action: "clear" } -> wipe the same set of tables, leave the account
//                          empty.
//
// This is a real Settings action, not a hidden fixture: it is explicit,
// reversible, and only ever touches the caller's own rows.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "sample-data", limit: 6 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "clear") {
      await wipeSampleAccount(userId);
      await recordAuditEvent(null, userId, { kind: "sample_data_cleared", detail: {} });
      return Response.json({ ok: true, state: "cleared" });
    }
    // default: load
    await buildSampleAccount(userId, { wipeFirst: true });
    await recordAuditEvent(null, userId, { kind: "sample_data_loaded", detail: {} });
    return Response.json({ ok: true, state: "loaded" });
  } catch (error) {
    console.error("[sample-data] failed:", error?.message);
    return Response.json({ error: "sample_data_failed", detail: error?.message ?? null }, { status: 500 });
  }
}
