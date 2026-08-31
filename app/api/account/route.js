import { getCurrentUserId } from "../../../lib/auth.js";
import { exportUserData, requestAccountDeletion, listAuditEvents, listRoles, grantRole, revokeRole, getConsent, setConsent, CONSENT_SCOPES } from "../../../lib/account-control/store.js";

export const runtime = "nodejs";

// GET  /api/account?view=export|audit|roles|consent
// POST /api/account  { action: "delete"|"revoke_consent"|"grant_role"|"revoke_role", ... }
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const view = new URL(request.url).searchParams.get("view") ?? "summary";
  try {
    if (view === "export") {
      const data = await exportUserData(userId);
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { "content-type": "application/json", "content-disposition": `attachment; filename="futureos-export-${userId}.json"` },
      });
    }
    if (view === "audit") return Response.json({ events: await listAuditEvents(userId) });
    if (view === "roles") return Response.json({ roles: await listRoles(userId) });
    if (view === "consent") return Response.json({ consent: await getConsent(userId) });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[account] GET failed:", error?.message);
    return Response.json({ error: "account_read_failed" }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "delete") {
      if (body.confirm !== "DELETE") {
        return Response.json(
          {
            error: "confirmation_required",
            message: "Deleting your account removes your accounts, transactions, plans, twin and shared access. Sessions end. Login stops working.",
            confirmWith: "DELETE",
          },
          { status: 400 },
        );
      }
      const result = await requestAccountDeletion(userId, { reason: body.reason ?? null });
      return Response.json({ status: "deleted", ...result, note: "Any outward-facing sharing or legal retention is flagged for compliance review." });
    }
    if (body.action === "revoke_consent") {
      if (!CONSENT_SCOPES.includes(body.scope)) return Response.json({ error: "invalid_scope" }, { status: 400 });
      return Response.json({ consent: await setConsent(userId, body.scope, false, { source: "account_settings" }) });
    }
    if (body.action === "grant_role") {
      const role = await grantRole(userId, { subjectKey: body.subjectKey ?? null, role: body.role, scope: body.scope ?? "view" });
      return Response.json({ role });
    }
    if (body.action === "revoke_role") {
      return Response.json({ revoked: await revokeRole(userId, body.roleId) });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
