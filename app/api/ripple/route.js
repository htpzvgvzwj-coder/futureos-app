import { getCurrentUserId } from "../../../lib/auth.js";
import { listRippleEvents, setRippleState } from "../../../lib/ripple/store.js";
import { buildCurrentRipple } from "../../../lib/ripple/build.js";
import { recordStudioImpactRipple, recordSealRipple, recordRevokeRipple } from "../../../lib/ripple/record.js";

export const runtime = "nodejs";

// GET /api/ripple -> the persistent Current Ripple (active rows), formatted.
// Read by Today, Life, Explore, Guardian and every Studio - one source.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const limit = Math.min(50, Number(url.searchParams.get("limit")) || 20);
  try {
    const rows = await listRippleEvents(userId, { limit });
    return Response.json(buildCurrentRipple(rows));
  } catch (error) {
    console.error("[ripple] failed:", error?.message);
    return Response.json({ error: "ripple_unavailable" }, { status: 500 });
  }
}

// POST /api/ripple
//   { action: "studio_impact", domain, cause, monthlyDelta, affectedGoals, snapshotId }
//   { action: "seal", domain, snapshotId }
//   { action: "revoke", domain }
//   { action: "set_state", id, state }
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "studio_impact") {
      const event = await recordStudioImpactRipple(userId, {
        domain: body.domain,
        cause: body.cause,
        monthlyDelta: body.monthlyDelta ?? null,
        affectedGoals: body.affectedGoals ?? [],
        snapshotId: body.snapshotId ?? null,
        severity: body.severity ?? "turning_point",
      });
      return Response.json({ event });
    }
    if (body.action === "seal") {
      const rows = await recordSealRipple(userId, body.domain, { snapshotId: body.snapshotId ?? null });
      return Response.json({ confirmed: rows });
    }
    if (body.action === "revoke") {
      const rows = await recordRevokeRipple(userId, body.domain);
      return Response.json({ revoked: rows });
    }
    if (body.action === "set_state") {
      const event = await setRippleState(userId, body.id, body.state);
      return Response.json({ event });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
