import { resolveEffectiveProfileKey } from "../../../lib/auth.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { buildMemoryScrub } from "../../../lib/living-plan/memory-scrub.js";

export const runtime = "nodejs";

// Thread Memory Scrubber - drag back through one Studio's real
// plan_versions and see the plan state Before | After at each step. No
// invented values; a field absent from a version reads as `unknown`.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") || "wedding";

  const plan = await planStore.getPlan(resolved.profileKey, { domain, goalKey: domain });
  if (!plan) {
    return Response.json({ domain, count: 0, frames: [], latest: { before: {}, after: {}, changedKeys: [], deltas: {} } });
  }
  const [planVersions, events] = await Promise.all([
    planStore.listPlanVersions(plan.id),
    listEvents(resolved.profileKey, { filter: "all", limit: 250 }),
  ]);

  const scrub = buildMemoryScrub({ domain, planVersions, events });
  // Drop the function before serialising.
  return Response.json({
    domain: scrub.domain,
    keys: scrub.keys,
    count: scrub.count,
    frames: scrub.frames,
    latest: scrub.latest,
  });
}
