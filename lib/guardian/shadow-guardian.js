// Guardian - Shadow Guardian (pure, no DB/AI).
//
// Guardian can rehearse, in the background, what a real change would do to
// the customer's sealed commitments - but it never changes a plan, moves
// money, or raises a loud alarm. "Let the customer see first; don't take
// control."
//
// A preview is only generated on a real trigger (a transaction / income
// change touching a sealed commitment, an approaching Turning Point, a
// Promise Weight pressure window, a possible emergency-floor breach, a
// milestone that might be underfunded). Every preview carries its
// assumptions, its confidence, and the evidence it used.

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export const SHADOW_STATES = ["watching", "preview_ready", "viewed", "accepted", "dismissed", "expired"];

// trigger: { kind, detail } - one of:
//   "expense_shock"   { extraMonthlyExpense }
//   "income_drop"     { newMonthlyIncome, priorMonthlyIncome }
//   "milestone_risk"  { commitmentId, dueMonth, amount, fundedByDue }
// commitments: [{ id, domain, monthlyContribution, pauseIfEmergencyMonthsBelow }]
// context: { monthlyFreeCashflow, emergencyBufferMonths, monthlyExpenses,
//            emergencyFloorMonths }
export function buildShadowPreview({ trigger, commitments = [], context = {}, now = new Date() }) {
  if (!trigger || !trigger.kind) return null;

  const free = num(context.monthlyFreeCashflow);
  const buffer = num(context.emergencyBufferMonths);
  const floor = num(context.emergencyFloorMonths, 6);
  const expenses = num(context.monthlyExpenses);
  const totalCommitted = commitments.reduce((s, c) => s + num(c.monthlyContribution), 0);

  let freeAfter = free;
  let bufferAfter = buffer;
  const assumptions = ["No plan is changed and no money is moved - this is a rehearsal."];
  let confidence = "medium";

  if (trigger.kind === "expense_shock") {
    const extra = num(trigger.detail?.extraMonthlyExpense);
    freeAfter = free - extra;
    assumptions.push(`Assumes an extra ${Math.round(extra)}/month expense continues for the rehearsal window.`);
    if (freeAfter < 0 && expenses > 0) bufferAfter = Math.round((buffer - (-freeAfter * 12) / expenses) * 10) / 10;
    confidence = expenses > 0 ? "high" : "low";
  } else if (trigger.kind === "income_drop") {
    const drop = num(trigger.detail?.priorMonthlyIncome) - num(trigger.detail?.newMonthlyIncome);
    freeAfter = free - Math.max(0, drop);
    assumptions.push(`Assumes income stays at the lower level for the rehearsal window.`);
    if (freeAfter < 0 && expenses > 0) bufferAfter = Math.round((buffer - (-freeAfter * 12) / expenses) * 10) / 10;
    confidence = "high";
  } else if (trigger.kind === "milestone_risk") {
    assumptions.push(`Based on the confirmed payment schedule and current saving pace.`);
    confidence = trigger.detail?.fundedByDue == null ? "low" : "high";
  }

  const floorWouldBreak = bufferAfter < floor;
  const cashflowWouldGoNegative = freeAfter < 0;
  const milestoneWouldMiss = trigger.kind === "milestone_risk" && trigger.detail?.fundedByDue === false;

  const needsAChoice = floorWouldBreak || cashflowWouldGoNegative || milestoneWouldMiss;

  // Up to three rescues - options, not a recommendation.
  const rescues = [];
  if (needsAChoice) {
    rescues.push({ key: "keep_plan_watch", changesNothing: true });
    rescues.push({ key: "adjust_one_variable", exampleDomain: commitments[0]?.domain ?? null });
    rescues.push({ key: "use_available_future" });
    if (commitments.length) rescues.push({ key: "pause_or_defer_a_commitment", commitmentId: commitments[0].id });
  }

  return {
    state: "preview_ready",
    trigger: { kind: trigger.kind },
    needsAChoice,
    findings: {
      freeCashflowBefore: Math.round(free),
      freeCashflowAfter: Math.round(freeAfter),
      emergencyBufferBefore: buffer,
      emergencyBufferAfter: bufferAfter,
      emergencyFloorMonths: floor,
      floorWouldBreak,
      cashflowWouldGoNegative,
      milestoneWouldMiss,
    },
    rescues: rescues.slice(0, 3),
    assumptions,
    confidence,
    evidence: {
      commitmentIds: commitments.map((c) => c.id),
      totalCommittedMonthly: Math.round(totalCommitted),
      computedFrom: "sealed commitments + real cashflow + the trigger",
    },
    // A quiet entry point only - not a push alert.
    entryKey: needsAChoice ? "shadowGuardian.entry.needsAChoice" : "shadowGuardian.entry.allClear",
  };
}
