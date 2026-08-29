import { getCurrentUserId } from "../../../lib/auth.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { getIncomeHistory } from "../../../lib/income-store.js";
import { getExpenseHistory } from "../../../lib/expense-store.js";
import { computeSmoothedIncome } from "../../../lib/income-finance.js";
import { computeSmoothedExpenses } from "../../../lib/expense-finance.js";
import { resolveAssetPromptContext } from "../../../lib/liquid-savings-context.js";
import { getOrCreateSession, getLatestArtifact, getSavingsCheckins } from "../../../lib/home-store.js";
import { computeMoments } from "../../../lib/moment-engine.js";
import { getActiveCommitment } from "../../../lib/goal-commitment-store.js";
import { evaluateCommitmentExecutionState } from "../../../lib/goal-commitment-finance.js";
import { recordEventSafe } from "../../../lib/change-ledger/store.js";
import { buildHomeCommitmentPausedEvent } from "../../../lib/change-ledger/producers/home.js";
import { EMERGENCY_FUND_MONTHS_TARGET } from "../../../lib/investment-readiness-finance.js";

export const runtime = "nodejs";

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Zero-frontend-input by design: unlike every *-draft-finance.js consumer
// so far (which still needs the client to fetch and pass in real figures),
// this route aggregates everything itself from real stored data - the
// customer's own preferences profile, real income/expense_entries history,
// the real Asset Profile ledger (via resolveAssetPromptContext, same
// server-truth savings figure /api/home/stage2 uses at confirm time), and
// the real home savings session/check-ins. The frontend calls this with no
// query params at all.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [preferences, incomeHistory, expenseHistory] = await Promise.all([
    getPreferences(userId),
    getIncomeHistory(userId),
    getExpenseHistory(userId),
  ]);

  const statedIncome = numberValue(preferences?.profile?.statedMonthlyIncome, 0);
  const statedExpenses = numberValue(preferences?.profile?.monthlyExpenses, 0);
  const statedSavings = numberValue(preferences?.profile?.currentSavings, 0);

  const smoothedIncome = computeSmoothedIncome(incomeHistory, statedIncome);
  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, statedExpenses);
  const assetContext = await resolveAssetPromptContext(userId, statedSavings, smoothedExpenses.effectiveMonthlyExpenses, "flexible");

  const homeSession = await getOrCreateSession(userId);
  const [confirmedPlan, confirmedSavingsPlan, savingsCheckins, commitment] = await Promise.all([
    getLatestArtifact(homeSession.id, "stage1", "confirmed_plan"),
    getLatestArtifact(homeSession.id, "stage2", "confirmed_savings_plan"),
    getSavingsCheckins(homeSession.id),
    getActiveCommitment(userId, "home"),
  ]);

  const moments = computeMoments({
    home: {
      confirmedPlan,
      confirmedSavingsPlan,
      savingsCheckins,
      currentSavings: assetContext.availableLiquidSavings,
      expenseHistory,
      monthlyExpenses: smoothedExpenses.effectiveMonthlyExpenses,
      commitment,
    },
  });

  const executionState = commitment
    ? evaluateCommitmentExecutionState({ commitment, emergencyBufferMonths: assetContext.emergencyBufferMonths })
    : null;

  // Guardian pause is derived live, not a user action - so this read is
  // where it first becomes a real fact. Record it to the Change Ledger the
  // first time we see the flip (the producer's dedupe_key makes this
  // idempotent, so polling this route doesn't spam the ledger). A
  // "resumed" counterpart event is a follow-up (needs its own dedupe once
  // pause/resume can cycle).
  if (commitment && executionState === "paused") {
    await recordEventSafe(
      buildHomeCommitmentPausedEvent({
        profileKey: userId,
        commitmentId: commitment.id,
        monthlyContribution: Number(commitment.monthly_contribution),
        emergencyBufferMonths: assetContext.emergencyBufferMonths,
        emergencyFloorMonths: EMERGENCY_FUND_MONTHS_TARGET,
      }),
    );
  }

  return Response.json({
    moments,
    context: {
      monthlyIncome: smoothedIncome.effectiveMonthlyIncome,
      monthlyExpenses: smoothedExpenses.effectiveMonthlyExpenses,
      currentSavings: assetContext.availableLiquidSavings,
    },
    commitment: commitment
      ? {
          ...commitment,
          executionState,
          emergencyBufferMonths: assetContext.emergencyBufferMonths,
        }
      : null,
  });
}
