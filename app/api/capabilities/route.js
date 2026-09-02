import { getCurrentUserId } from "../../../lib/auth.js";
import { resolveAllCapabilities } from "../../../lib/capability-registry.js";
import { query } from "../../../lib/db.js";

export const runtime = "nodejs";

// GET /api/capabilities - the resolved status of every feature for THIS
// user (account type + connected providers + permissions). Explore, Today
// and every CTA read this so a button is never clickable-but-dead.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  // account type from onboarding (defaults to individual)
  let accountType = "individual";
  try {
    const r = await query(`select account_type from user_onboarding where profile_key = $1`, [userId]);
    if (r.rows[0]?.account_type) accountType = r.rows[0].account_type;
  } catch {
    /* table may not exist yet - default */
  }

  // Provider connection status. No real partners configured -> everything
  // that needs one is connection_required. Honest by default.
  const providers = {
    payment_provider: process.env.FUTUREOS_PAYMENT_PROVIDER ?? "unavailable",
    sgfindex: process.env.FUTUREOS_SGFINDEX ?? "unavailable",
    insurer: process.env.FUTUREOS_INSURER ?? "unavailable",
  };

  return Response.json({
    accountType,
    providers,
    capabilities: resolveAllCapabilities({ accountType, providers }),
  });
}
