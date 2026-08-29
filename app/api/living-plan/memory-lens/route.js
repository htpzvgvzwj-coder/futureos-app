import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";
import { listEvents } from "../../../../lib/change-ledger/store.js";
import { planStore } from "../../../../lib/plan-runtime/index.js";
import { buildMemoryLens } from "../../../../lib/living-plan/memory-lens.js";

export const runtime = "nodejs";

// "Why is my <goal> like this now?" - the causal chain for one goal,
// rebuilt from its real Change Ledger events + plan versions. Every node is
// tagged Fact / User choice / Estimate / Inference / Unknown. No invented
// causality.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const url = new URL(request.url);
  const goalId = url.searchParams.get("goal") || "wedding";
  const focusMetric = url.searchParams.get("metric") || null;

  const events = await listEvents(resolved.profileKey, { filter: "all", limit: 250 });

  let planVersions = [];
  const plan = await planStore.getPlan(resolved.profileKey, { domain: goalId, goalKey: goalId });
  if (plan) planVersions = await planStore.listPlanVersions(plan.id);

  const lens = buildMemoryLens({ goalId, events, planVersions, focusMetric });
  return Response.json(lens);
}
