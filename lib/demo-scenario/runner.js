// Demo Scenario runner - executes one step's REAL writes for the signed-in
// account and records the resulting Change Ledger events. Progress is
// derived from the ledger itself (events whose cause.demo === true), so
// there is no separate progress store to drift.

import { recordEventSafe, listEvents } from "../change-ledger/store.js";
import { buildImpact, ACTION_TYPES } from "../change-ledger/events.js";
import { DEMO_STEPS, DEMO_FIXTURE, demoStepByKey, nextDemoStep } from "./script.js";

// Tag every demo event so it's unmistakable and filterable.
function demo(draft) {
  return {
    ...draft,
    cause: { ...(draft.cause ?? {}), demo: true, demoScenario: true },
    messageParams: { ...(draft.messageParams ?? {}), demo: true },
  };
}

async function completedStepKeys(profileKey) {
  const events = await listEvents(profileKey, { filter: "all", limit: 250 });
  const keys = new Set();
  for (const e of events) {
    if (e.cause && e.cause.demo === true && e.cause.demoStepKey) keys.add(e.cause.demoStepKey);
  }
  return [...keys];
}

export async function getDemoState(profileKey) {
  const completed = await completedStepKeys(profileKey);
  return {
    steps: DEMO_STEPS,
    completedSteps: completed,
    nextStep: nextDemoStep(completed)?.key ?? null,
    fixture: DEMO_FIXTURE,
    isDemo: true,
    notice: "demo_scenario_fixture_data",
  };
}

// Each handler returns { event drafts[] }. They intentionally build ledger
// events directly (not full domain confirms) so the demo is deterministic
// and self-contained; the events are real ledger rows with real computed
// impact_set deltas.
const STEP_HANDLERS = {
  wedding_plan_created: () => {
    const { v1 } = DEMO_FIXTURE.wedding;
    return [
      {
        actor: "user",
        sourceFeature: "wedding",
        actionType: ACTION_TYPES.PLAN_UPDATED,
        status: "scheduled",
        relatedGoalIds: ["wedding"],
        cause: { trigger: "demo_wedding_plan_created", demoStepKey: "wedding_plan_created" },
        beforeSnapshot: {},
        afterSnapshot: { date: v1.date, guests: v1.guests, budget: v1.total_budget, truthfulness: v1.truthfulness },
        impactSet: [buildImpact({ goalId: "wedding", metric: "planBudget", before: 0, after: v1.total_budget, unit: "sgd" })],
        confidence: "low",
        uncertaintyNote: "mostly_estimates",
        messageKey: "changeLedger.event.plan_updated.wedding",
        messageParams: { budget: v1.total_budget },
        dedupeKey: `demo:wedding_plan_created:${profileKeyToken()}`,
      },
    ];
  },
  date_and_guests_changed: () => {
    const { v1, v2 } = DEMO_FIXTURE.wedding;
    const coupleMonthlyBefore = 850;
    const coupleMonthlyAfter = 1050;
    return [
      {
        actor: "user",
        sourceFeature: "wedding",
        actionType: ACTION_TYPES.PLAN_UPDATED,
        status: "scheduled",
        relatedGoalIds: ["wedding", "home"],
        cause: { trigger: "demo_date_and_guests_changed", demoStepKey: "date_and_guests_changed", movedDateFrom: v1.date, movedDateTo: v2.date },
        beforeSnapshot: { date: v1.date, guests: v1.guests, coupleMonthly: coupleMonthlyBefore },
        afterSnapshot: { date: v2.date, guests: v2.guests, coupleMonthly: coupleMonthlyAfter },
        impactSet: [
          buildImpact({ goalId: "wedding", metric: "monthlyContribution", before: coupleMonthlyBefore, after: coupleMonthlyAfter, unit: "sgd_per_month" }),
          buildImpact({ goalId: "wedding", metric: "targetDate", before: 0, after: -4, unit: "months", direction: "up" }),
          buildImpact({ goalId: "home", metric: "targetDate", before: 0, after: 2, unit: "months", direction: "down" }),
        ],
        confidence: "medium",
        messageKey: "changeLedger.event.plan_updated.wedding",
        messageParams: { budget: v2.total_budget },
        dedupeKey: `demo:date_and_guests_changed:${profileKeyToken()}`,
      },
    ];
  },
  quote_to_plan: () => {
    const q = DEMO_FIXTURE.wedding.venueQuote;
    const validUntil = new Date(Date.now() + q.validDays * 86400000).toISOString();
    return [
      {
        actor: "user",
        sourceFeature: "quote_to_plan",
        actionType: ACTION_TYPES.QUOTE_IMPORTED,
        status: "active",
        relatedGoalIds: ["wedding"],
        cause: { trigger: "demo_quote_imported", demoStepKey: "quote_to_plan", field: q.field },
        beforeSnapshot: { field: q.field, truthfulness: "estimate", range: [q.estimateLow, q.estimateHigh] },
        afterSnapshot: { field: q.field, truthfulness: "real_quote", quotedAmount: q.quotedAmount, validUntil },
        impactSet: [
          buildImpact({ goalId: "wedding", metric: "planBudget", before: Math.round((q.estimateLow + q.estimateHigh) / 2), after: q.quotedAmount, unit: "sgd" }),
        ],
        evidenceRefs: [{ kind: "document", ref: "demo-venue-quote.pdf", sourceUpdatedAt: new Date().toISOString() }],
        confidence: "high",
        messageKey: "changeLedger.event.quote_imported.headline",
        messageParams: { label: q.label, quoted: q.quotedAmount },
        dedupeKey: `demo:quote_to_plan:${profileKeyToken()}`,
      },
    ];
  },
  impact_on_home_and_emergency: () => {
    const { emergency } = DEMO_FIXTURE;
    return [
      {
        actor: "system",
        sourceFeature: "home",
        actionType: ACTION_TYPES.PLAN_SAFE_BALANCE_CHANGED,
        status: "active",
        relatedGoalIds: ["home", "emergency", "wedding"],
        cause: { trigger: "demo_cross_goal_recompute", demoStepKey: "impact_on_home_and_emergency" },
        beforeSnapshot: { homeReadyDeltaMonths: 0, emergencyBuffer: emergency.bufferBefore },
        afterSnapshot: { homeReadyDeltaMonths: 2, emergencyBuffer: emergency.bufferBefore },
        impactSet: [
          buildImpact({ goalId: "home", metric: "targetDate", before: 0, after: 2, unit: "months", direction: "down" }),
          buildImpact({ goalId: "emergency", metric: "emergencyBuffer", before: emergency.bufferBefore, after: emergency.bufferBefore, unit: "months", direction: "flat" }),
        ],
        confidence: "high",
        messageKey: "changeLedger.event.plan_safe_balance_changed.headline",
        messageParams: {},
        dedupeKey: `demo:impact_on_home_and_emergency:${profileKeyToken()}`,
      },
    ];
  },
  shadow_guardian: () => {
    const s = DEMO_FIXTURE.shadow;
    return [
      {
        actor: "guardian",
        sourceFeature: "guardian",
        actionType: ACTION_TYPES.SHADOW_FINDING,
        status: "simulated",
        relatedGoalIds: ["wedding"],
        cause: { trigger: "demo_shadow_run", demoStepKey: "shadow_guardian", cyclesRun: s.cyclesRun },
        beforeSnapshot: { testedMonthlyAmount: s.testedAmount },
        afterSnapshot: { suggestedStableAmount: s.suggestedStableAmount },
        impactSet: [buildImpact({ goalId: "wedding", metric: "monthlyContribution", before: s.testedAmount, after: s.suggestedStableAmount, unit: "sgd_per_month" })],
        confidence: "medium",
        messageKey: "changeLedger.event.shadow.finding",
        messageParams: { cycles: s.cyclesRun, tested: s.testedAmount, stable: s.suggestedStableAmount },
        dedupeKey: `demo:shadow_guardian:${profileKeyToken()}`,
      },
    ];
  },
  seal_commitment: () => {
    const amount = DEMO_FIXTURE.wedding.monthlySavings;
    return [
      {
        actor: "user",
        sourceFeature: "wedding",
        actionType: ACTION_TYPES.BRANCH_SEALED,
        status: "scheduled",
        relatedGoalIds: ["wedding"],
        cause: { trigger: "demo_seal", demoStepKey: "seal_commitment", respectsPins: true },
        beforeSnapshot: { branchStatus: "open" },
        afterSnapshot: { branchStatus: "sealed", monthlyAmount: amount, execution: "scheduled_no_bank_transfer" },
        impactSet: [buildImpact({ goalId: "wedding", metric: "monthlyContribution", before: 0, after: amount, unit: "sgd_per_month" })],
        confidence: "high",
        messageKey: "changeLedger.event.branch_sealed.headline",
        messageParams: { amount },
        dedupeKey: `demo:seal_commitment:${profileKeyToken()}`,
      },
    ];
  },
  guardian_pause: () => {
    const { emergency } = DEMO_FIXTURE;
    return [
      {
        actor: "guardian",
        sourceFeature: "guardian",
        actionType: ACTION_TYPES.COMMITMENT_PAUSED,
        status: "paused",
        relatedGoalIds: ["wedding", "emergency"],
        cause: { trigger: "demo_guardian_pause", demoStepKey: "guardian_pause", emergencyBufferMonths: emergency.bufferAfter, emergencyFloorMonths: emergency.floor },
        beforeSnapshot: { commitmentExecutionState: "active", countedMonthlyOutflow: DEMO_FIXTURE.wedding.monthlySavings, emergencyBuffer: emergency.bufferBefore },
        afterSnapshot: { commitmentExecutionState: "paused", countedMonthlyOutflow: 0, emergencyBuffer: emergency.bufferAfter },
        impactSet: [
          buildImpact({ goalId: "wedding", metric: "monthlyContribution", before: DEMO_FIXTURE.wedding.monthlySavings, after: 0, unit: "sgd_per_month" }),
          buildImpact({ goalId: "wedding", metric: "targetDate", before: 0, after: 1, unit: "months", direction: "down" }),
          buildImpact({ goalId: "emergency", metric: "emergencyBuffer", before: emergency.bufferBefore, after: emergency.bufferAfter, unit: "months", direction: "down" }),
        ],
        confidence: "high",
        messageKey: "changeLedger.event.commitment_paused.headline",
        messageParams: { threshold: emergency.floor, current: emergency.bufferAfter },
        dedupeKey: `demo:guardian_pause:${profileKeyToken()}`,
      },
    ];
  },
  plan_rescue: () => {
    const weeks = DEMO_FIXTURE.wedding.rescueDelayWeeks;
    return [
      {
        actor: "user",
        sourceFeature: "emergency",
        actionType: ACTION_TYPES.RESCUE_ADOPTED,
        status: "active",
        relatedGoalIds: ["wedding", "emergency"],
        cause: { trigger: "demo_plan_rescue", demoStepKey: "plan_rescue", quoteIncrease: 3000, preserved: ["core_guests", "photography_budget"] },
        beforeSnapshot: { weddingDate: DEMO_FIXTURE.wedding.v2.date },
        afterSnapshot: { weddingDelayedWeeks: weeks, homeGoalImpact: "none" },
        impactSet: [
          buildImpact({ goalId: "wedding", metric: "targetDate", before: 0, after: Math.round((weeks / 4.345) * 10) / 10, unit: "months", direction: "down" }),
          buildImpact({ goalId: "home", metric: "targetDate", before: 0, after: 0, unit: "months", direction: "flat" }),
        ],
        confidence: "high",
        messageKey: "changeLedger.event.rescue_adopted.pause_goal_plan",
        messageParams: { domain: "wedding", amount: 0 },
        dedupeKey: `demo:plan_rescue:${profileKeyToken()}`,
      },
    ];
  },
  wedding_handover: () => {
    const residual = DEMO_FIXTURE.wedding.handoverResidual;
    return [
      {
        actor: "system",
        sourceFeature: "wedding",
        actionType: ACTION_TYPES.PLAN_HANDOVER,
        status: "completed",
        relatedGoalIds: ["wedding", "home"],
        cause: { trigger: "demo_handover", demoStepKey: "wedding_handover", transitionType: "wedding_to_honeymoon" },
        beforeSnapshot: { goal: "wedding", state: "completed" },
        afterSnapshot: { nextGoal: "honeymoon", residualAmount: residual, status: "proposed" },
        impactSet: [buildImpact({ goalId: "honeymoon", metric: "planBudget", before: 0, after: residual, unit: "sgd" })],
        confidence: "high",
        messageKey: "changeLedger.event.plan_handover.wedding_to_honeymoon",
        messageParams: { residual },
        dedupeKey: `demo:wedding_handover:${profileKeyToken()}`,
      },
    ];
  },
};

// dedupe keys are per-profile; the runner injects the profileKey. This
// placeholder is replaced in runDemoStep so the handler defs stay pure.
let _profileKeyToken = "";
function profileKeyToken() {
  return _profileKeyToken;
}

export async function runDemoStep(profileKey, stepKey) {
  const step = demoStepByKey(stepKey);
  if (!step) return { error: "unknown_step" };
  const handler = STEP_HANDLERS[stepKey];
  if (!handler) return { error: "step_not_implemented" };

  _profileKeyToken = profileKey.slice(0, 12);
  const drafts = handler().map((d) => demo({ profileKey, visibility: "private", ...d }));
  const events = [];
  for (const draft of drafts) {
    const res = await recordEventSafe(draft);
    if (res?.event) events.push(res.event);
  }
  const completed = await completedStepKeys(profileKey);
  return {
    ranStep: stepKey,
    eventsCreated: events.map((e) => e.id),
    completedSteps: completed,
    nextStep: nextDemoStep(completed)?.key ?? null,
  };
}

// Remove every demo event for a profile (used by "reset demo").
export async function resetDemo(profileKey) {
  // append-only table: we don't delete, we mark. But demo events are
  // exempt from that rule since they were never real - a hard delete keeps
  // the real ledger clean. Scoped strictly to cause.demo = true.
  const { query } = await import("../db.js");
  const result = await query(
    `delete from change_ledger_events where profile_key = $1 and (cause->>'demo')::boolean is true returning id`,
    [profileKey],
  );
  return { deleted: result.rowCount };
}
