// Living Plan - Memory Lens (pure, no DB/AI).
//
// Memory Lens answers "why is my life like this now?" for one goal, by
// stitching that goal's real Change Ledger events + plan versions into a
// single causal chain. Every node is tagged Fact / User choice / Estimate /
// Inference. No AI-invented causality; where the record is thin it says
// Unknown. History is append-only - a version can supersede, never rewrite.

// Tag vocabulary for each step in the chain.
export const MEMORY_NODE_TYPES = ["fact", "user_choice", "estimate", "inference", "unknown"];

function tagForEvent(e) {
  switch (e.actor) {
    case "user":
      return "user_choice";
    case "system":
    case "guardian":
      return e.action_type === "commitment_paused" || e.action_type === "reality_checkin_applied" ? "fact" : "inference";
    case "partner":
      return "user_choice";
    default:
      return "unknown";
  }
}

function stepFromEvent(e) {
  const impacts = Array.isArray(e.impact_set) ? e.impact_set : [];
  return {
    eventId: e.id,
    at: e.occurred_at ?? e.occurredAt ?? null,
    actionType: e.action_type,
    actor: e.actor,
    nodeType: tagForEvent(e),
    truthfulness: e.status, // projected / simulated / scheduled / active / ...
    before: e.before_snapshot ?? {},
    after: e.after_snapshot ?? {},
    cause: e.cause ?? {},
    impacts: impacts.map((i) => ({
      goalId: i.goalId,
      metric: i.metric,
      before: i.before ?? null,
      after: i.after ?? null,
      unit: i.unit ?? null,
    })),
    // whether this step's evidence is real enough to stand on
    evidenceKnown: Object.keys(e.cause ?? {}).length > 0 || impacts.length > 0,
    messageKey: e.message_key,
    messageParams: e.message_params ?? {},
    supersedesEventId: e.supersedes_event_id ?? null,
  };
}

// events: Change Ledger rows for a goal (any order). planVersions: rows from
// plan_versions for that goal's plan (any order). question: optional
// free-text ("why did Home move from 2028 to 2029") - used only to pick a
// focus metric, never to fabricate.
export function buildMemoryLens({ goalId, events = [], planVersions = [], focusMetric = null, now = new Date() }) {
  const relevant = events
    .filter((e) => Array.isArray(e.related_goal_ids) && e.related_goal_ids.some((g) => g === goalId || String(g).startsWith(`${goalId}:`)))
    .sort((a, b) => new Date(a.occurred_at ?? 0) - new Date(b.occurred_at ?? 0));

  const chain = relevant.map(stepFromEvent);

  // Which steps actually touched the focus metric (if asked).
  const focus = focusMetric
    ? chain.filter((s) => s.impacts.some((i) => i.metric === focusMetric || (i.goalId && i.goalId.startsWith(goalId))))
    : chain;

  const versionTrail = [...planVersions]
    .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0))
    .map((v) => ({
      version: v.version,
      supersedesVersion: v.supersedes_version ?? null,
      at: v.created_at ?? null,
      actor: v.actor,
      confidence: v.confidence ?? null,
      cause: v.cause ?? {},
      nodeType: v.actor === "user" ? "user_choice" : v.actor === "system" ? "fact" : "inference",
    }));

  const counts = chain.reduce((acc, s) => {
    acc[s.nodeType] = (acc[s.nodeType] ?? 0) + 1;
    return acc;
  }, {});

  const unresolved = chain.length === 0;

  return {
    goalId,
    focusMetric: focusMetric ?? null,
    chain, // full causal chain, oldest -> newest
    focusChain: focus, // only steps touching the focus metric
    versionTrail,
    tally: counts,
    hasEnoughEvidence: !unresolved,
    // Honest fallback when the record can't explain it.
    unknownReasonKey: unresolved ? "memoryLens.unknown.noRecord" : null,
    // Current state = the last real step's `after`, if any.
    currentState: chain.filter((s) => s.truthfulness && !["projected", "simulated"].includes(s.truthfulness)).slice(-1)[0]?.after ?? null,
    builtAt: now.toISOString(),
  };
}
