import { getCurrentUserId } from "../../../lib/auth.js";
import { resolveAllCapabilities } from "../../../lib/capability-registry.js";
import { query } from "../../../lib/db.js";
import { connectedProviderStatuses } from "../../../lib/connections/store.js";

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

  // Provider connection status: an OCBC-wide env flag, OR this account's own
  // link (from /api/connections). A per-account 'sandbox' still resolves the
  // capability so the flow is reachable, but the flow itself stays honest
  // about sandbox mode.
  const providers = {
    payment_provider: process.env.FUTUREOS_PAYMENT_PROVIDER ?? "unavailable",
    sgfindex: process.env.FUTUREOS_SGFINDEX ?? "unavailable",
    insurer: process.env.FUTUREOS_INSURER ?? "unavailable",
  };
  try {
    Object.assign(providers, await connectedProviderStatuses(userId));
  } catch {
    /* connections table may not exist yet */
  }

  return Response.json({
    accountType,
    providers,
    capabilities: resolveAllCapabilities({ accountType, providers }),
  });
}
