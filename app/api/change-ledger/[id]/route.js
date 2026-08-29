import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";
import { getEvent, listEvents } from "../../../../lib/change-ledger/store.js";

export const runtime = "nodejs";

// One event with its full causal detail, plus the chain of events it
// supersedes / is superseded by - so "this change is no longer in effect"
// is always reachable from either end (a revoke points back at what it
// cancelled; the read here also surfaces anything that later cancelled THIS
// one). Powers Change Replay's before/after view.
export async function GET(request, { params }) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const { id } = await params;
  const event = await getEvent(id, resolved.profileKey);
  if (!event) return Response.json({ error: "not_found" }, { status: 404 });

  // Cheap chain lookup without a recursive CTE: pull the recent window and
  // link by supersedes_event_id in memory. Fine at ledger sizes this app
  // produces; revisit with a CTE if a single plan ever has hundreds of
  // superseding revisions.
  const recent = await listEvents(resolved.profileKey, { filter: "all", limit: 250 });
  const supersededBy = recent.find((e) => e.supersedes_event_id === event.id) ?? null;
  const supersedes = event.supersedes_event_id
    ? recent.find((e) => e.id === event.supersedes_event_id) ?? null
    : null;

  return Response.json({
    event,
    chain: {
      supersedes,
      supersededBy,
      stillInEffect: !supersededBy && event.status !== "revoked",
    },
  });
}
