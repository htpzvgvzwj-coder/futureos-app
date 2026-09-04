import { getCurrentUserId } from "../../../lib/auth.js";
import { buildFeatureHistory, HISTORY_FEATURES } from "../../../lib/history/feature-history.js";

export const runtime = "nodejs";

// GET /api/history?feature=<today|spending|twin|explore|family|guardian>
// "What you've done here" — merged from the Change Ledger + the audit trail.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const feature = new URL(request.url).searchParams.get("feature") ?? "";
  if (!HISTORY_FEATURES.includes(feature)) {
    return Response.json({ error: "unknown_feature", features: HISTORY_FEATURES }, { status: 400 });
  }
  try {
    return Response.json({ feature, events: await buildFeatureHistory(userId, feature) });
  } catch (error) {
    console.error("[history] failed:", error?.message);
    return Response.json({ error: "history_unavailable" }, { status: 500 });
  }
}
