import { getCurrentUserId } from "../../../../lib/auth.js";
import { getPreferences } from "../../../../lib/preferences-store.js";
import { getExpenseHistory } from "../../../../lib/expense-store.js";
import { computeSmoothedExpenses } from "../../../../lib/expense-finance.js";
import { resolveAssetPromptContext } from "../../../../lib/liquid-savings-context.js";
import { getOrCreateSession, getLatestArtifact, getSavingsCheckins, saveArtifact, updateSessionStatus } from "../../../../lib/home-store.js";
import { computeHomeGoalShiftMoment } from "../../../../lib/moment-engine.js";
import { computeReadyDateForMonthlyAmount, FIRST_HOME_DOWN_PAYMENT_RATE } from "../../../../lib/home-draft-finance.js";
import { createCommitment } from "../../../../lib/goal-commitment-store.js";
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
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const monthlyContribution = numberValue(body.monthlyContribution, NaN);
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }
  const language = body.language === "zh" ? "zh" : "en";

  const [preferences, expenseHistory] = await Promise.all([getPreferences(userId), getExpenseHistory(userId)]);
  const statedExpenses = numberValue(preferences?.profile?.monthlyExpenses, 0);
  const statedSavings = numberValue(preferences?.profile?.currentSavings, 0);
  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, statedExpenses);
  const assetContext = await resolveAssetPromptContext(userId, statedSavings, smoothedExpenses.effectiveMonthlyExpenses, "flexible");

  const homeSession = await getOrCreateSession(userId);
  const [confirmedPlan, confirmedSavingsPlan, savingsCheckins] = await Promise.all([
    getLatestArtifact(homeSession.id, "stage1", "confirmed_plan"),
    getLatestArtifact(homeSession.id, "stage2", "confirmed_savings_plan"),
    getSavingsCheckins(homeSession.id),
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

  const effectiveMonth = nextMonthKey();
  const downPaymentNeeded = Math.round(confirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
  const readiness = computeReadyDateForMonthlyAmount({
    downPaymentNeeded,
    currentSavings: assetContext.availableLiquidSavings,
    monthlyAmount: monthlyContribution,
  });

  const commitment = await createCommitment(userId, {
    domain: "home",
    monthlyContribution,
    effectiveMonth,
    pauseIfEmergencyMonthsBelow: EMERGENCY_FUND_MONTHS_TARGET,
    sourceMoment,
  });

  // Keeps every existing consumer of confirmed_savings_plan (Strategic
  // Balance, Loan Planner's otherGoalsMonthlyOutflow, simulatorInputs) in
  // sync - a direct structured write, not a second AI call, since the
  // amount is already fully known and every other field here is real
  // computed math, not a narrative the customer needs to read.
  const notes =
    language === "zh"
      ? "在检测到储蓄节奏偏离后，由 Guardian 直接更新了每月储蓄金额。"
      : "Monthly contribution updated directly by Guardian after a detected pace shift.";
  await saveArtifact(homeSession.id, "stage2", "confirmed_savings_plan", {
    strategy_id: "goal-commitment-adjusted",
    monthly_contribution: monthlyContribution,
    allocation: [{ vehicle: "savingsAccount", monthly_amount: monthlyContribution }],
    start_month: effectiveMonth,
    target_complete_month: readiness.readyMonth ?? confirmedSavingsPlan.target_complete_month,
    notes,
  });
  await updateSessionStatus(homeSession.id, { stage2Status: "confirmed" });

  return Response.json({ commitment, readiness });
}
