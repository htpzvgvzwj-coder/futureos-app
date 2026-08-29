// Living Plan - Decision Echo (pure, no DB/AI).
//
// FutureOS notices when a customer repeatedly makes the SAME kind of
// confirmed choice - but it never turns that into an identity, a goal, or a
// commitment on its own. An Echo only forms when ALL of these hold:
//   - at least 3 similar, user-confirmed actions
//   - inside a bounded time window
//   - with an explainable baseline
//   - evidence + confidence are shown
//   - the customer can dismiss it (and a dismissed Echo stays quiet)
//
// It never infers from a single action, and never from diet / body /
// medical / other sensitive categories - the input here is only Change
// Ledger action rows.

const MIN_OCCURRENCES = 3;
const DEFAULT_WINDOW_DAYS = 60;

// Which ledger actions are echo-eligible and how they're grouped.
const ECHO_PATTERNS = {
  allocation_set: (e) => {
    const a = e.after_snapshot ?? {};
    const flex = Number(a.flexibleMonthly) || 0;
    const goal = Number(a.goalMonthly) || 0;
    const emg = Number(a.emergencyMonthly) || 0;
    const total = flex + goal + emg;
    if (total <= 0) return null;
    if (flex / total >= 0.6) return "keeps_freed_cash_flexible";
    if (emg / total >= 0.6) return "rebuilds_safety_first";
    if (goal / total >= 0.6) return "accelerates_a_goal";
    return null;
  },
  pin_set: (e) => (e.message_params?.kind?.includes?.("emergency_floor") || String(e.cause?.constraintId || "").includes("emergency") ? "protects_the_emergency_floor" : null),
  rescue_adopted: (e) => (e.action_type === "rescue_adopted" ? "chooses_safety_under_pressure" : null),
};

// events: Change Ledger rows (newest first is fine). dismissed: Set of
// pattern keys the customer has already dismissed.
export function detectDecisionEchoes({ events = [], dismissed = new Set(), now = new Date(), windowDays = DEFAULT_WINDOW_DAYS }) {
  const cutoff = new Date(now.getTime() - windowDays * 86400000);
  const groups = new Map();

  for (const e of events) {
    if (!e || e.actor !== "user") continue;
    const occurredAt = new Date(e.occurred_at ?? e.occurredAt ?? 0);
    if (Number.isNaN(occurredAt.getTime()) || occurredAt < cutoff) continue;
    const patternFn = ECHO_PATTERNS[e.action_type];
    if (!patternFn) continue;
    const key = patternFn(e);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: e.id, at: occurredAt.toISOString(), sourceFeature: e.source_feature });
  }

  const echoes = [];
  for (const [key, occ] of groups) {
    if (occ.length < MIN_OCCURRENCES) continue;
    if (dismissed.has(key)) continue;
    echoes.push({
      pattern: key,
      occurrences: occ.length,
      windowDays,
      firstAt: occ[occ.length - 1].at,
      lastAt: occ[0].at,
      domains: [...new Set(occ.map((o) => o.sourceFeature))],
      confidence: occ.length >= 5 ? "high" : occ.length >= 4 ? "medium" : "low",
      evidenceEventIds: occ.map((o) => o.id),
      state: "surfaced",
      // low-friction, a question - never a verdict
      promptKey: `decisionEcho.prompt.${key}`,
      actions: ["keep_as_observation", "pin_it", "make_a_living_plan", "dismiss", "ask_why"],
    });
  }

  echoes.sort((a, b) => b.occurrences - a.occurrences);
  return { echoes, evaluatedEvents: events.length };
}

export const ECHO_STATES = ["observed", "surfaced", "pinned", "converted", "dismissed", "expired"];
