// Guardian Now — the one status the Guardian home leads with.
//
// Guardian is Future Bank's protection layer, not a notification list. This
// reducer collapses the whole Money Moment stream (+ the bank-now view and
// plan movement) into ONE state, ONE cause, ONE primary action. It never
// returns more than one problem.
//
// Pure: no DB, no fetch. Feed it the payload of buildMoneyMoments().

export const GUARDIAN_LEVELS = ["calm", "watching", "decision", "urgent"];

const HEADLINE = {
  calm: "Your money is keeping its promises.",
  watching: "Guardian is keeping an eye on something.",
  decision: "A choice is waiting for you.",
  urgent: "Your money needs attention now.",
};

const RANK = { calm: 0, watching: 1, decision: 2, urgent: 3 };

// A money move / plan collision reads as a "decision"; a shortfall or a
// failed/blocked payment reads as "urgent".
function looksLikeCollision(m) {
  return /collision|compete|competing|overload|two plans|both plans/i.test(`${m.kind ?? ""} ${m.title ?? ""} ${m.summary ?? ""}`);
}

export function reduceGuardianStatus(mm = {}) {
  const moments = (mm.moments ?? []).filter((m) => m.state === "new");
  const bankNow = mm.bankNow ?? null;
  const planMovement = mm.planMovement ?? [];

  if (mm.isEmpty) {
    return {
      level: "calm",
      headline: "Add your money and Guardian starts protecting it.",
      cause: "Guardian works from your real accounts, bills and plans — there is nothing to watch yet.",
      primaryAction: { label: "Add a money source", route: "reality" },
      momentKey: null,
      needsSetup: true,
    };
  }

  const actionMoment = moments.find((m) => m.severity === "action_required");
  const turningMoment = moments.find((m) => m.sourceType === "turning_point");
  const planImpactMoment = moments.find((m) => m.sourceType === "plan_impact" || looksLikeCollision(m));
  const watchMoment = moments.find((m) => m.severity === "watch");
  const belowFloor = Boolean(bankNow?.belowProtectedFloor);

  const candidates = [];

  if (belowFloor) {
    candidates.push({
      level: "urgent",
      headline: HEADLINE.urgent,
      cause:
        actionMoment?.summary ??
        "Your upcoming bills and safety buffer need more than the money available before your next income.",
      primaryAction: actionMoment?.nextActions?.[0] ?? { label: "Open Money Rescue", route: "rescue" },
      momentKey: actionMoment?.id ?? "bank:below_floor",
    });
  }
  if (actionMoment) {
    const collision = looksLikeCollision(actionMoment);
    candidates.push({
      level: collision ? "decision" : "urgent",
      headline: collision ? HEADLINE.decision : HEADLINE.urgent,
      cause: actionMoment.summary || actionMoment.title,
      primaryAction: actionMoment.nextActions?.[0] ?? null,
      momentKey: actionMoment.id,
    });
  }
  if (planImpactMoment || (turningMoment && (planMovement?.length ?? 0) > 0)) {
    const m = planImpactMoment ?? turningMoment;
    candidates.push({
      level: "decision",
      headline: HEADLINE.decision,
      cause: m.summary || m.title,
      primaryAction: m.nextActions?.[0] ?? { label: "See what changed", route: "life" },
      momentKey: m.id,
    });
  }
  if (turningMoment) {
    candidates.push({
      level: "decision",
      headline: HEADLINE.decision,
      cause: turningMoment.summary || turningMoment.title,
      primaryAction: turningMoment.nextActions?.[0] ?? null,
      momentKey: turningMoment.id,
    });
  }
  if (watchMoment) {
    candidates.push({
      level: "watching",
      headline: HEADLINE.watching,
      cause: watchMoment.summary || watchMoment.title,
      primaryAction: watchMoment.nextActions?.[0] ?? null,
      momentKey: watchMoment.id,
    });
  }

  if (candidates.length === 0) {
    return {
      level: "calm",
      headline: HEADLINE.calm,
      cause: "Bills, safety buffer and every active plan are covered by the money you have and expect.",
      primaryAction: null,
      momentKey: null,
    };
  }

  // exactly one: the highest-ranked candidate (ties -> first, which is the
  // higher-priority source because moments come pre-ordered)
  candidates.sort((a, b) => RANK[b.level] - RANK[a.level]);
  return candidates[0];
}
