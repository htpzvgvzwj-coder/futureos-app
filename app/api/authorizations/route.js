import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import { query } from "../../../lib/db.js";
import {
  getAuthPolicy, setAuthPolicy, listAuthRequests, decideAuthRequest, cancelAuthRequest,
  countPendingAuthRequests, hasLinkedApprover,
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
//   { action: "set_policy", restrictedNeedApproval?, approvalOverAmount? }
//   { action: "decide", id, decision: "approved"|"declined", note? }
//   { action: "cancel", id }
// Requests themselves are created by the pay APIs, never directly here.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "authorizations", limit: 40 });
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "set_policy") {
      const policy = await setAuthPolicy(userId, {
        ...(body.restrictedNeedApproval !== undefined ? { restrictedNeedApproval: body.restrictedNeedApproval } : {}),
        ...(body.approvalOverAmount !== undefined ? { approvalOverAmount: body.approvalOverAmount } : {}),
      });
      return Response.json({ policy });
    }
    if (body.action === "decide") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      const linked = await hasLinkedApprover(userId);
      const result = await decideAuthRequest(userId, body.id, {
        decision: body.decision,
        note: body.note ?? null,
        decidedBy: linked ? "guardian" : "owner",
      });
      if (!result) return Response.json({ error: "request_not_found" }, { status: 404 });
      return Response.json({ request: result });
    }
    if (body.action === "cancel") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      return Response.json({ cancelled: await cancelAuthRequest(userId, body.id) });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
