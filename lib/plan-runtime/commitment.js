// Plan Runtime - commitment slice (pure, no DB/AI).
//
// This is the first extracted piece of a single, auditable plan kernel. It
// owns the rules that were previously scattered inline across
// app/api/home/goal-commitment/route.js and its revoke sibling:
//
//   1. what a commitment amount is ALLOWED to be (server-side truth, never
//      "whatever the slider sent"),
//   2. how a commitment maps to the confirmed_savings_plan artifact every
//      downstream consumer already reads (Strategic Balance, Loan Planner's
//      otherGoalsMonthlyOutflow, hardship, follow-through, open-loops, ...),
//   3. how a REVOKED commitment restores the plan that was in force before
//      it, so a cancel actually propagates instead of leaving Guardian's
//      adjusted amount stuck in every cross-goal calculation,
//   4. what monthly outflow a cross-goal reader should count for a
//      commitment given its live execution state (revoked / paused / active).
//
// Same discipline as every lib/*-finance.js: pure functions, code owns the
// numbers, nothing here is invented or AI-sourced.

export const SUPPORTED_COMMITMENT_DOMAINS = ["home"];

// The slider on the Moment card is already clamped to [sliderMin, sliderMax]
// (lib/moment-engine.js computes both from real pace math). The server
// recomputes the same Moment and re-checks here, because the client value is
// untrusted - a replayed or hand-crafted request must not be able to commit
// an amount outside the range the real math supports, or one larger than the
// customer's real monthly headroom.
//
// step is the slider's own increment (10) - the only tolerance allowed on
// the range edges, so an exact-max drag isn't rejected by a rounding cent.
export function validateCommitmentAmount({
  monthlyContribution,
  sliderMin,
  sliderMax,
  availableMonthlyCashflow = null,
  step = 10,
}) {
  const amount = Number(monthlyContribution);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  if (Number.isFinite(sliderMin) && amount < sliderMin - step) {
    return { ok: false, error: "amount_out_of_range" };
  }
  if (Number.isFinite(sliderMax) && amount > sliderMax + step) {
    return { ok: false, error: "amount_out_of_range" };
  }
  // Only enforced when we have a real income figure to evaluate against -
  // with no logged/declared income there's no honest headroom number, so we
  // don't guess one (same "insufficient data excluded" rule as the finance
  // modules). availableMonthlyCashflow is expected to already exclude this
  // domain's own prior contribution, i.e. it's the room a NEW home amount
  // has to fit into.
  if (availableMonthlyCashflow != null && Number.isFinite(availableMonthlyCashflow)) {
    if (amount > availableMonthlyCashflow) {
      return { ok: false, error: "amount_exceeds_cashflow" };
    }
  }
  return { ok: true, error: null };
}

// The confirmed_savings_plan payload a newly-adopted commitment writes.
// Extracted verbatim from the old inline object in
// app/api/home/goal-commitment/route.js so the shape has exactly one
// definition. Keeps every existing consumer in sync via a direct structured
// write (not a second AI call) - the amount is a known number and every
// other field is real computed math, not narrative.
export function buildAdjustedSavingsPlanPayload({
  priorPlan,
  monthlyContribution,
  effectiveMonth,
  readyMonth,
  notes,
}) {
  return {
    strategy_id: "goal-commitment-adjusted",
    monthly_contribution: monthlyContribution,
    allocation: [{ vehicle: "savingsAccount", monthly_amount: monthlyContribution }],
    start_month: effectiveMonth,
    target_complete_month: readyMonth ?? priorPlan?.target_complete_month ?? null,
    notes,
    // Breadcrumb so a reader (and a future Plan Runtime consumer) can tell a
    // Guardian-adjusted plan apart from one the customer confirmed directly.
    adjusted_by: "goal_commitment",
  };
}

// The confirmed_savings_plan payload a REVOKE writes: the plan that was in
// force before the commitment, restored verbatim. Without this, revoke only
// flips goal_commitments.status and every downstream consumer keeps reading
// Guardian's adjusted monthly_contribution as an active commitment.
export function buildRevertSavingsPlanPayload({ supersededPlan, notes }) {
  if (!supersededPlan) return null;
  return {
    ...supersededPlan,
    notes: notes ?? supersededPlan.notes ?? null,
    // Mark provenance without touching any of the real numbers the
    // restored plan carries (monthly_contribution, start_month,
    // target_complete_month all come straight from the snapshot).
    adjusted_by: undefined,
    restored_from: "goal_commitment_revoke",
  };
}

// What monthly outflow a cross-goal reader should count for this commitment,
// given its live execution state. A revoked commitment contributes nothing.
// A PAUSED commitment also contributes nothing right now - Guardian is not
// moving that money while the emergency buffer is below the floor - so
// counting the full adjusted amount would overstate the customer's real
// committed outflow. Only an actively-executing commitment counts at face
// value.
export function deriveCommittedMonthlyOutflow({ commitment, executionState }) {
  if (!commitment) return 0;
  if (executionState === "revoked" || executionState === "paused") return 0;
  const amount = Number(commitment.monthly_contribution);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

// Pure merge: given one { domain, monthlyContribution } savings row and the
// live commitment resolution for that domain (or null), return the row a
// cross-goal reader should use. Untouched when there's no active commitment
// or its live state matches the artifact; otherwise the counted outflow is
// substituted and the raw amount + execution state are kept alongside for
// display/audit. Split out of applyCommitmentStateToSavings so it's
// testable without a database.
export function reconcileSavingsRow(row, resolution) {
  if (!resolution) return row;
  const counted = Number(resolution.countedMonthlyOutflow);
  const raw = Number(row.monthlyContribution);
  if (!Number.isFinite(counted) || counted === raw) return row;
  return {
    ...row,
    monthlyContribution: counted,
    rawMonthlyContribution: Number.isFinite(raw) ? raw : null,
    commitmentExecutionState: resolution.executionState,
  };
}
