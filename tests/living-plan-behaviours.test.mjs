import test from "node:test";
import assert from "node:assert/strict";
import { computePromiseWeight } from "../lib/living-plan/promise-weight.js";
import { deriveTurningPoints } from "../lib/living-plan/turning-point.js";
import { buildHandoffCandidate, handoffAffectsOtherGoals, HANDOFF_STATES } from "../lib/living-plan/future-handoff.js";
import { detectDecisionEchoes, ECHO_STATES } from "../lib/living-plan/decision-echo.js";
import { buildShadowPreview, SHADOW_STATES } from "../lib/guardian/shadow-guardian.js";
import { buildMemoryLens, MEMORY_NODE_TYPES } from "../lib/living-plan/memory-lens.js";

const NOW = new Date("2026-09-15T00:00:00Z");

// ---- Promise Weight ---------------------------------------------------
test("promise weight: calm when commitments fit inside free cashflow", () => {
  const pw = computePromiseWeight({
    commitments: [{ id: "a", domain: "home", monthlyAmount: 900 }, { id: "b", domain: "wedding", monthlyAmount: 600 }],
    context: { monthlyFreeCashflow: 3000 },
    now: NOW,
  });
  assert.equal(pw.status, "calm");
  assert.equal(pw.activeCommitmentCount, 2);
  assert.equal(pw.pressureWindow, null);
});

test("promise weight: needs_a_decision + a real Pressure Window when a month can't be covered", () => {
  const pw = computePromiseWeight({
    commitments: [
      { id: "a", domain: "home", monthlyAmount: 1200 },
      { id: "b", domain: "wedding", monthlyAmount: 900, milestones: [{ id: "dep", label: "Deposit", amount: 5000, dueMonth: "2026-12" }] },
    ],
    context: { monthlyFreeCashflow: 1800, monthlyExpenses: 4000 },
    now: NOW,
  });
  assert.equal(pw.status, "needs_a_decision");
  assert.equal(pw.pressureWindow.month, "2026-12");
  assert.ok(pw.pressureWindow.shortfall > 0);
  assert.ok(pw.pressureWindow.driverCommitments.length >= 2);
  assert.match(pw.headlineKey, /needs_a_decision$/);
});

test("promise weight: no fear language - only status + evidence", () => {
  const pw = computePromiseWeight({ commitments: [{ id: "a", domain: "loan", monthlyAmount: 500 }], context: { monthlyFreeCashflow: 2000 }, now: NOW });
  assert.ok(["calm", "tightening", "needs_a_decision"].includes(pw.status));
  assert.ok(pw.evidence.computedFrom.includes("real free cashflow"));
});

// ---- Turning Point --------------------------------------------------
test("turning point: an underfunded payment within 3 months is Open/Approaching with why-now + if-you-wait", () => {
  const tp = deriveTurningPoints({
    sources: {
      paymentMilestones: [{ commitmentId: "w1", domain: "wedding", label: "Venue deposit", amount: 4000, dueMonth: "2026-11", fundedByDue: false }],
    },
    now: NOW,
  });
  assert.equal(tp.points.length, 1);
  assert.equal(tp.points[0].kind, "payment_due_underfunded");
  assert.ok(["open", "approaching"].includes(tp.points[0].state));
  assert.ok(tp.points[0].whyNowKey && tp.points[0].ifYouWaitKey);
  assert.ok(tp.points[0].openFutures.length >= 2);
});

test("turning point: a funded payment produces no turning point; a budget gap does", () => {
  const tp = deriveTurningPoints({
    sources: {
      paymentMilestones: [{ commitmentId: "w1", domain: "wedding", label: "x", amount: 1000, dueMonth: "2026-10", fundedByDue: true }],
      budgetGaps: [{ domain: "wedding", planId: "p1", gapAmount: 3200 }],
      emergencyFloor: { bufferMonths: 8, floorMonths: 6 },
    },
    now: NOW,
  });
  assert.equal(tp.points.length, 1);
  assert.equal(tp.points[0].kind, "budget_below_core");
  assert.equal(tp.points[0].state, "open");
});

test("turning point: emergency floor within half a month is surfaced", () => {
  const tp = deriveTurningPoints({ sources: { emergencyFloor: { bufferMonths: 6.3, floorMonths: 6, breachedByDomain: "home" } }, now: NOW });
  assert.equal(tp.points[0].kind, "emergency_floor_near");
  assert.equal(tp.points[0].domain, "home");
});

// ---- Future Handoff -----------------------------------------------
test("future handoff: a completed commitment releases its full monthly; nothing moves until confirmed", () => {
  const h = buildHandoffCandidate({
    commitment: { id: "c1", domain: "wedding", monthly_contribution: 1100, status: "active", effectiveMonth: "2026-01", endMonth: "2027-07" },
    reason: "completed",
    activeGoals: ["home", "retirement", "wedding"],
    now: NOW,
  });
  assert.equal(h.releasedMonthly, 1100);
  assert.equal(h.unallocatedMonthly, 1100);
  assert.equal(h.state, "candidate");
  assert.equal(handoffAffectsOtherGoals(h), false);
  // Part 0.2: targets are the customer's REAL active goals, minus the
  // source (wedding), plus emergency + flexible. Never a hardcoded list.
  assert.ok(h.targets.includes("home") && h.targets.includes("retirement") && h.targets.includes("emergency") && h.targets.includes("flexible"));
  assert.ok(!h.targets.includes("wedding"), "source goal is not a destination for a completed handoff");
  assert.equal(h.targetGoalId, null, "no target chosen yet");
});

test("future handoff: with no active goals, only emergency + flexible are offered (never a default Home)", () => {
  const h = buildHandoffCandidate({
    commitment: { id: "c2", domain: "loan", monthly_contribution: 400, status: "active" },
    reason: "revoked",
    now: NOW,
  });
  assert.deepEqual(h.targets, ["emergency", "flexible"]);
  assert.ok(!h.targets.includes("home"));
});

test("future handoff: a 'reduced' commitment only releases the difference", () => {
  const h = buildHandoffCandidate({
    commitment: { id: "c1", domain: "loan", monthly_contribution: 800, status: "active" },
    reason: "reduced",
    reducedToMonthly: 500,
    allocation: { emergencyMonthly: 300 },
    now: NOW,
  });
  assert.equal(h.releasedMonthly, 300);
  assert.equal(h.state, "allocated");
  assert.equal(h.unallocatedMonthly, 0);
});

test("future handoff: no released resource -> no candidate; states enumerated", () => {
  assert.equal(buildHandoffCandidate({ commitment: { id: "x", monthly_contribution: 0, status: "active" }, reason: "completed" }), null);
  for (const s of ["candidate", "allocated", "confirmed", "deferred", "dismissed"]) assert.ok(HANDOFF_STATES.includes(s));
});

// ---- Decision Echo -----------------------------------------------
function ev(action_type, after, daysAgo, sf = "wedding") {
  return {
    id: `e${Math.random()}`,
    actor: "user",
    action_type,
    source_feature: sf,
    occurred_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
    after_snapshot: after,
  };
}

test("decision echo: forms only after 3+ similar confirmed actions in the window", () => {
  const events = [
    ev("allocation_set", { flexibleMonthly: 200, goalMonthly: 0, emergencyMonthly: 0 }, 5),
    ev("allocation_set", { flexibleMonthly: 150, goalMonthly: 20, emergencyMonthly: 0 }, 20),
    ev("allocation_set", { flexibleMonthly: 300, goalMonthly: 0, emergencyMonthly: 0 }, 40),
  ];
  const { echoes } = detectDecisionEchoes({ events, now: NOW });
  assert.equal(echoes.length, 1);
  assert.equal(echoes[0].pattern, "keeps_freed_cash_flexible");
  assert.equal(echoes[0].occurrences, 3);
  assert.ok(echoes[0].actions.includes("dismiss") && echoes[0].actions.includes("ask_why"));
});

test("decision echo: two occurrences is NOT an echo; a dismissed pattern stays quiet", () => {
  const two = [
    ev("allocation_set", { flexibleMonthly: 200 }, 5),
    ev("allocation_set", { flexibleMonthly: 200 }, 10),
  ];
  assert.equal(detectDecisionEchoes({ events: two, now: NOW }).echoes.length, 0);

  const three = [...two, ev("allocation_set", { flexibleMonthly: 200 }, 15)];
  assert.equal(detectDecisionEchoes({ events: three, now: NOW }).echoes.length, 1);
  assert.equal(detectDecisionEchoes({ events: three, dismissed: new Set(["keeps_freed_cash_flexible"]), now: NOW }).echoes.length, 0);
});

test("decision echo: ignores non-user actors and events outside the window", () => {
  const events = [
    { ...ev("allocation_set", { flexibleMonthly: 200 }, 5), actor: "guardian" },
    ev("allocation_set", { flexibleMonthly: 200 }, 200),
    ev("allocation_set", { flexibleMonthly: 200 }, 300),
  ];
  assert.equal(detectDecisionEchoes({ events, now: NOW }).echoes.length, 0);
  for (const s of ["observed", "surfaced", "pinned", "converted", "dismissed", "expired"]) assert.ok(ECHO_STATES.includes(s));
});

// ---- Shadow Guardian --------------------------------------------
test("shadow guardian: an expense shock that breaks the floor produces a preview with rescues + assumptions", () => {
  const p = buildShadowPreview({
    trigger: { kind: "expense_shock", detail: { extraMonthlyExpense: 1500 } },
    commitments: [{ id: "c1", domain: "home", monthlyContribution: 900 }],
    context: { monthlyFreeCashflow: 1000, emergencyBufferMonths: 6.2, monthlyExpenses: 4000, emergencyFloorMonths: 6 },
    now: NOW,
  });
  assert.equal(p.state, "preview_ready");
  assert.equal(p.needsAChoice, true);
  assert.equal(p.findings.cashflowWouldGoNegative, true);
  assert.ok(p.rescues.length >= 1 && p.rescues.length <= 3);
  assert.ok(p.rescues.some((r) => r.changesNothing));
  assert.ok(p.assumptions.some((a) => /rehearsal|no plan is changed/i.test(a)));
  assert.equal(p.entryKey, "shadowGuardian.entry.needsAChoice");
});

test("shadow guardian: a mild shock that changes nothing still returns a calm 'all clear' entry", () => {
  const p = buildShadowPreview({
    trigger: { kind: "expense_shock", detail: { extraMonthlyExpense: 100 } },
    commitments: [{ id: "c1", domain: "home", monthlyContribution: 500 }],
    context: { monthlyFreeCashflow: 3000, emergencyBufferMonths: 9, monthlyExpenses: 3500, emergencyFloorMonths: 6 },
    now: NOW,
  });
  assert.equal(p.needsAChoice, false);
  assert.equal(p.entryKey, "shadowGuardian.entry.allClear");
  for (const s of ["watching", "preview_ready", "viewed", "accepted", "dismissed", "expired"]) assert.ok(SHADOW_STATES.includes(s));
});

test("shadow guardian: no trigger -> no preview (it never runs unprompted)", () => {
  assert.equal(buildShadowPreview({ trigger: null, commitments: [], context: {} }), null);
});

// ---- Memory Lens ----------------------------------------------
test("memory lens: stitches a goal's ledger events into a tagged causal chain", () => {
  const events = [
    {
      id: "e1", actor: "user", action_type: "plan_updated", status: "scheduled",
      related_goal_ids: ["wedding"], occurred_at: "2026-06-01T00:00:00Z",
      before_snapshot: { guests: 150 }, after_snapshot: { guests: 90 },
      impact_set: [{ goalId: "wedding", metric: "planBudget", before: 34000, after: 22000, unit: "sgd" }],
      cause: { trigger: "guest_count_change" }, message_key: "k",
    },
    {
      id: "e2", actor: "system", action_type: "plan_safe_balance_changed", status: "active",
      related_goal_ids: ["wedding", "home"], occurred_at: "2026-06-02T00:00:00Z",
      before_snapshot: {}, after_snapshot: {},
      impact_set: [{ goalId: "home", metric: "targetDate", before: 0, after: 2, unit: "months" }],
      cause: {}, message_key: "k2",
    },
  ];
  const lens = buildMemoryLens({ goalId: "wedding", events, planVersions: [] });
  assert.equal(lens.chain.length, 2);
  assert.equal(lens.chain[0].nodeType, "user_choice");
  assert.equal(lens.chain[1].nodeType, "inference");
  assert.equal(lens.chain[0].evidenceKnown, true);
  assert.equal(lens.hasEnoughEvidence, true);
  for (const tName of MEMORY_NODE_TYPES) assert.equal(typeof tName, "string");
});

test("memory lens: no events for the goal -> honest 'no record', not fabricated causality", () => {
  const lens = buildMemoryLens({ goalId: "retirement", events: [], planVersions: [] });
  assert.equal(lens.hasEnoughEvidence, false);
  assert.equal(lens.unknownReasonKey, "memoryLens.unknown.noRecord");
  assert.equal(lens.currentState, null);
});
