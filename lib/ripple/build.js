// Build the Current Ripple view the UI renders in Today / Life / Explore /
// Guardian / every Studio. It is a pure formatter over the PERSISTED
// ripple_events rows - it computes nothing new.

const NEXT_ACTION_BY_STATE = {
  possible: ["compare", "undo", "seal"],
  placed: ["compare", "undo", "seal"],
  confirmed: ["view_cause", "open_history"],
  revoked: ["view_cause"],
  superseded: [],
};

function fmtGoal(g) {
  const before = g.before ?? null;
  const after = g.after ?? null;
  return {
    goalId: g.goalId ?? null,
    metric: g.metric ?? null,
    unit: g.unit ?? null,
    before,
    after,
    direction: g.direction ?? (before != null && after != null ? (after > before ? "up" : after < before ? "down" : "flat") : "flat"),
  };
}

// rows: listRippleEvents() output (active only, newest first)
export function buildCurrentRipple(rows = []) {
  const events = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    domain: r.domain,
    whatChanged: r.cause,
    cause: r.sourceRef?.kind ?? r.kind,
    monthlyImpact: r.monthlyDelta,
    affectedGoals: (r.affectedGoals ?? []).map(fmtGoal),
    state: r.state, // possible | placed | confirmed | revoked | superseded
    severity: r.severity, // information | turning_point | action_required
    confidence: r.state === "confirmed" ? "confirmed" : r.state === "possible" || r.state === "placed" ? "conditional" : "expected",
    occurredAt: r.occurredAt,
    nextActions: NEXT_ACTION_BY_STATE[r.state] ?? [],
  }));

  const actionRequired = events.filter((e) => e.severity === "action_required");
  const turningPoints = events.filter((e) => e.severity === "turning_point");

  return {
    events,
    count: events.length,
    mostRecent: events[0] ?? null,
    actionRequiredCount: actionRequired.length,
    turningPointCount: turningPoints.length,
    // A compact one-liner for a header strip.
    headline: events[0]
      ? `${events[0].whatChanged}${events[0].monthlyImpact != null ? ` — SGD ${events[0].monthlyImpact >= 0 ? "+" : ""}${events[0].monthlyImpact}/mo` : ""} (${events[0].state})`
      : null,
  };
}
