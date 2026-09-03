import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import { query } from "../../../lib/db.js";
import {
  getAuthPolicy, setAuthPolicy, listAuthRequests, decideAuthRequest, cancelAuthRequest,
  countPendingAuthRequests, hasLinkedApprover, confirmOwnerHalf, adjustAuthRequest,
} from "../../../lib/authorization/store.js";

export const runtime = "nodejs";

async function accountType(userId) {
  try {
    const r = await query(`select account_type from user_onboarding where profile_key = $1`, [userId]);
    return r.rows[0]?.account_type ?? "individual";
  } catch {
    return "individual";
  }
}

// GET /api/authorizations -> the approval policy + the request queue for
// THIS account. Explore/Guardian/Family & Care read this.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [policy, requests, pending, linkedApprover, type] = await Promise.all([
      getAuthPolicy(userId),
      listAuthRequests(userId),
      countPendingAuthRequests(userId),
      hasLinkedApprover(userId),
      accountType(userId),
    ]);
    return Response.json({ policy, requests, counts: { pending }, linkedApprover, accountType: type });
  } catch (error) {
    console.error("[authorizations] GET failed:", error?.message);
    return Response.json({ error: "authorizations_unavailable" }, { status: 500 });
  }
}

// POST /api/authorizations
//   { action: "set_policy", restrictedNeedApproval?, approvalOverAmount?, mode?, coolingOffHours?, requireBoth? }
//   { action: "decide", id, decision: "approved"|"declined", note? }  (a decline needs a note)
//   { action: "confirm", id }   -> the owner's half of a two-person approval
//   { action: "cancel"|"stop", id }
// Requests themselves are created by the pay APIs, never directly here.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "authorizations", limit: 40 });
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "set_policy") {
      const fields = ["restrictedNeedApproval", "approvalOverAmount", "mode", "coolingOffHours", "requireBoth"];
      const patch = Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
      return Response.json({ policy: await setAuthPolicy(userId, patch) });
    }
    if (body.action === "decide") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      // this endpoint is the OWNER's own app; the guardian decides via /api/care
      const result = await decideAuthRequest(userId, body.id, {
        decision: body.decision,
        note: body.note ?? null,
        decidedBy: "owner",
      });
      if (!result) return Response.json({ error: "request_not_found" }, { status: 404 });
      return Response.json({ request: result });
    }
    if (body.action === "confirm") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      const result = await confirmOwnerHalf(userId, body.id);
      if (!result) return Response.json({ error: "request_not_found" }, { status: 404 });
      return Response.json({ request: result });
    }
    if (body.action === "adjust") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      const result = await adjustAuthRequest(userId, body.id, body.amount);
      if (!result) return Response.json({ error: "request_not_found" }, { status: 404 });
      return Response.json({ request: result });
    }
    if (body.action === "cancel" || body.action === "stop") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      return Response.json({ cancelled: await cancelAuthRequest(userId, body.id) });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
