import { getCurrentUserId } from "../../../../lib/auth.js";
import { getPreferences } from "../../../../lib/preferences-store.js";
import { getExpenseHistory } from "../../../../lib/expense-store.js";
import { computeSmoothedExpenses } from "../../../../lib/expense-finance.js";
import { getIncomeHistory } from "../../../../lib/income-store.js";
import { computeSmoothedIncome } from "../../../../lib/income-finance.js";
import { resolveAssetPromptContext } from "../../../../lib/liquid-savings-context.js";
import { getOrCreateSession, getLatestArtifact, getSavingsCheckins, saveArtifact, updateSessionStatus } from "../../../../lib/home-store.js";
import { computeHomeGoalShiftMoment } from "../../../../lib/moment-engine.js";
import { computeReadyDateForMonthlyAmount, FIRST_HOME_DOWN_PAYMENT_RATE } from "../../../../lib/home-draft-finance.js";
import { createCommitment } from "../../../../lib/goal-commitment-store.js";
import { getCrossGoalSnapshot } from "../../../../lib/cross-goal-context.js";
import { validateCommitmentAmount, buildAdjustedSavingsPlanPayload } from "../../../../lib/plan-runtime/commitment.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { buildHomeCommitmentCreatedEvent } from "../../../../lib/change-ledger/producers/home.js";
import { EMERGENCY_FUND_MONTHS_TARGET } from "../../../../lib/investment-readiness-finance.js";

export const runtime = "nodejs";

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nextMonthKey() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

// The real structured commitment the "adopt this pace" action writes -
// replaces sending an AI-text message for this specific action (Phase 2 of
// the Home Goal Shift vertical: "确认后应生成结构化银行指令，而不是一段
// AI 文字"). The client sends only monthlyContribution (a genuine choice,
// not a computed fact); everything else - the moment this decision is
// responding to, the real down-payment math, the pause condition - is
// recomputed server-side so the audit trail this commitment later gets
// measured against (see computeHomeGoalRecoveryMoment) can never be
// client-manipulated.
//
// The amount itself is validated server-side too (lib/plan-runtime/
// commitment.js validateCommitmentAmount): it must fall inside the range
// the recomputed Moment's real pace math supports, and must fit the
// customer's real monthly headroom once every other confirmed commitment
// is accounted for. A second active commitment before the first is revoked
// is rejected with a 409 by the goal_commitments partial unique index.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const monthlyContribution = numberValue(body.monthlyContribution, NaN);
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }
  const language = body.language === "zh" ? "zh" : "en";

  const [preferences, expenseHistory, incomeHistory] = await Promise.all([
    getPreferences(userId),
    getExpenseHistory(userId),
    getIncomeHistory(userId),
  ]);
  const statedExpenses = numberValue(preferences?.profile?.monthlyExpenses, 0);
  const statedSavings = numberValue(preferences?.profile?.currentSavings, 0);
  const statedIncome = numberValue(preferences?.profile?.statedMonthlyIncome, 0);
  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, statedExpenses);
  const smoothedIncome = computeSmoothedIncome(incomeHistory, statedIncome);
  const assetContext = await resolveAssetPromptContext(userId, statedSavings, smoothedExpenses.effectiveMonthlyExpenses, "flexible");

  const homeSession = await getOrCreateSession(userId);
  const [confirmedPlan, confirmedSavingsPlan, savingsCheckins, crossGoal] = await Promise.all([
    getLatestArtifact(homeSession.id, "stage1", "confirmed_plan"),
    getLatestArtifact(homeSession.id, "stage2", "confirmed_savings_plan"),
    getSavingsCheckins(homeSession.id),
    getCrossGoalSnapshot(userId),
  ]);
  if (!confirmedPlan || !confirmedSavingsPlan) {
    return Response.json({ error: "no_confirmed_plan" }, { status: 409 });
  }

  const sourceMoment = computeHomeGoalShiftMoment({
    confirmedPlan,
    confirmedSavingsPlan,
    savingsCheckins,
    currentSavings: assetContext.availableLiquidSavings,
    expenseHistory,
    monthlyExpenses: smoothedExpenses.effectiveMonthlyExpenses,
  });
  if (!sourceMoment) {
    return Response.json({ error: "no_active_moment" }, { status: 409 });
  }

  // Real monthly headroom a NEW home contribution has to fit into: income
  // minus expenses minus every already-confirmed commitment EXCEPT this
  // domain's own current savings plan (which this commitment replaces).
  // crossGoal.committedMonthlyTotal already includes the home savings plan,
  // so subtract it back out. Only meaningful with a real income figure.
  const priorHomeContribution = numberValue(confirmedSavingsPlan.monthly_contribution, 0);
  const availableMonthlyCashflow =
    smoothedIncome.effectiveMonthlyIncome > 0
      ? smoothedIncome.effectiveMonthlyIncome -
        smoothedExpenses.effectiveMonthlyExpenses -
        (crossGoal.committedMonthlyTotal - priorHomeContribution)
      : null;

  const check = validateCommitmentAmount({
    monthlyContribution,
    sliderMin: sourceMoment.data.sliderMin,
    sliderMax: sourceMoment.data.sliderMax,
    availableMonthlyCashflow,
  });
  if (!check.ok) {
    return Response.json(
      { error: check.error, sliderMin: sourceMoment.data.sliderMin, sliderMax: sourceMoment.data.sliderMax, availableMonthlyCashflow },
      { status: 422 },
    );
  }

  const effectiveMonth = nextMonthKey();
  const downPaymentNeeded = Math.round(confirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
  const readiness = computeReadyDateForMonthlyAmount({
    downPaymentNeeded,
    currentSavings: assetContext.availableLiquidSavings,
    monthlyAmount: monthlyContribution,
  });

  let commitment;
  try {
    commitment = await createCommitment(userId, {
      domain: "home",
      monthlyContribution,
      effectiveMonth,
      pauseIfEmergencyMonthsBelow: EMERGENCY_FUND_MONTHS_TARGET,
      sourceMoment,
      // Captured verbatim so a later revoke can restore exactly this plan
      // (lib/plan-runtime/commitment.js buildRevertSavingsPlanPayload)
      // instead of leaving the adjusted amount stuck downstream.
      supersededSavingsPlan: confirmedSavingsPlan,
      priorMonthlyContribution: priorHomeContribution,
    });
  } catch (error) {
    if (error?.code === "ACTIVE_COMMITMENT_EXISTS") {
      return Response.json({ error: "active_commitment_exists" }, { status: 409 });
    }
    throw error;
  }

  // Keeps every existing consumer of confirmed_savings_plan (Strategic
  // Balance, Loan Planner's otherGoalsMonthlyOutflow, simulatorInputs) in
  // sync - a direct structured write, not a second AI call, since the
  // amount is already fully known and every other field here is real
  // computed math, not a narrative the customer needs to read.
  const notes =
    language === "zh"
      ? "在检测到储蓄节奏偏离后，由 Guardian 直接更新了每月储蓄金额。"
      : "Monthly contribution updated directly by Guardian after a detected pace shift.";
  await saveArtifact(
    homeSession.id,
    "stage2",
    "confirmed_savings_plan",
    buildAdjustedSavingsPlanPayload({
      priorPlan: confirmedSavingsPlan,
      monthlyContribution,
      effectiveMonth,
      readyMonth: readiness.readyMonth,
      notes,
    }),
  );
  await updateSessionStatus(homeSession.id, { stage2Status: "confirmed" });

  // Change Ledger: the causal record of this real state change. Written
  // AFTER the commitment + artifact are persisted (recordEventSafe never
  // throws, so a ledger hiccup can't undo a change that already landed).
  // status "scheduled" - the monthly move is arranged, not executed (no
  // real bank transfer exists).
  const readinessAtPriorPace = computeReadyDateForMonthlyAmount({
    downPaymentNeeded,
    currentSavings: assetContext.availableLiquidSavings,
    monthlyAmount: priorHomeContribution,
  });
  const monthsDelta =
    readiness.monthsToReady != null && readinessAtPriorPace.monthsToReady != null
      ? readiness.monthsToReady - readinessAtPriorPace.monthsToReady
      : null;
  const ledger = await recordEventSafe(
    buildHomeCommitmentCreatedEvent({
      profileKey: userId,
      commitmentId: commitment.id,
      priorMonthlyContribution: priorHomeContribution,
      newMonthlyContribution: monthlyContribution,
      effectiveMonth,
      readyMonthBefore: readinessAtPriorPace.readyMonth,
      readyMonthAfter: readiness.readyMonth,
      monthsDelta,
      reasonCode: sourceMoment.reasonCode,
      reasonParams: sourceMoment.reasonParams,
      emergencyFloorMonths: EMERGENCY_FUND_MONTHS_TARGET,
    }),
  );

  return Response.json({ commitment, readiness, ledgerEventId: ledger?.event?.id ?? null });
}
