import { resolveEffectiveProfileKey } from "../../../lib/auth.js";
import { listEvents } from "../../../lib/change-ledger/store.js";

export const runtime = "nodejs";

const ALLOWED_FILTERS = new Set(["all", "mine", "guardian", "plan", "quotes", "shared", "outcomes"]);

// The Change Ledger's read side: a plain causal timeline, newest first.
// Filters map 1:1 to the brief's set (全部 / 我的决定 / Guardian / 计划 /
// 报价与文件 / 共享目标 / 已完成结果). `since` (ISO) powers Delta Replay
// ("what changed since you last opened FutureOS"). Only an "all"-scope grant
// exposes another user's ledger, same as every other cross-domain aggregate.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const url = new URL(request.url);
  const filterParam = url.searchParams.get("filter") ?? "all";
  const filter = ALLOWED_FILTERS.has(filterParam) ? filterParam : "all";
  const since = url.searchParams.get("since") || null;

  const events = await listEvents(resolved.profileKey, { filter, since });
  return Response.json({ events, filter });
}
