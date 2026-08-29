import { getCurrentUserId } from "../../../../lib/auth.js";
import { getPreferences } from "../../../../lib/preferences-store.js";
import { getExpenseHistory } from "../../../../lib/expense-store.js";
import { getIncomeHistory } from "../../../../lib/income-store.js";
import { computeSmoothedExpenses } from "../../../../lib/expense-finance.js";
import { computeSmoothedIncome } from "../../../../lib/income-finance.js";
import { resolveAssetPromptContext } from "../../../../lib/liquid-savings-context.js";
import { getStrategicBalanceSnapshot } from "../../../../lib/strategic-balance-context.js";
import { getCrossGoalSnapshot } from "../../../../lib/cross-goal-context.js";
import { listEvents } from "../../../../lib/change-ledger/store.js";
import { computePromiseWeight } from "../../../../lib/living-plan/promise-weight.js";
import { deriveTurningPoints } from "../../../../lib/living-plan/turning-point.js";
import { detectDecisionEchoes } from "../../../../lib/living-plan/decision-echo.js";

export const runtime = "nodejs";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// The Today status layer: Promise Weight (one calm word + the pressure
// window), the next Turning Point, and any Decision Echo. Everything is
// computed from real sealed commitments + real cashflow + the real Change
// Ledger. No new tables - promise_weight / turning_point are projections.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [preferences, expenseHistory, incomeHistory] = await Promise.all([
    getPreferences(userId),
    getExpenseHistory(userId),
    getIncomeHistory(userId),
  ]);
  const statedExpenses = num(preferences?.profile?.monthlyExpenses);
  const statedIncome = num(preferences?.profile?.statedMonthlyIncome);
  const statedSavings = num(preferences?.profile?.currentSavings);
  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, statedExpenses);
  const smoothedIncome = computeSmoothedIncome(incomeHistory, statedIncome);

  const [assetContext, strategic, crossGoal, ledgerEvents] = await Promise.all([
    resolveAssetPromptContext(userId, statedSavings, smoothedExpenses.effectiveMonthlyExpenses, "flexible"),
    getStrategicBalanceSnapshot(userId),
    getCrossGoalSnapshot(userId),
    listEvents(userId, { filter: "all", limit: 250 }),
  ]);

  const monthlyIncome = smoothedIncome.effectiveMonthlyIncome;
  const monthlyExpenses = smoothedExpenses.effectiveMonthlyExpenses;
  const monthlyFreeCashflow = monthlyIncome > 0 ? monthlyIncome - monthlyExpenses : null;

  // Sealed commitments -> weighable promises. Real monthly amounts from
  // Strategic Balance (savings plans) + loans.
  const commitments = [
    ...strategic.savings.map((s) => ({
      id: `savings:${s.domain}`,
      domain: s.domain,
      label: s.domain,
      monthlyAmount: num(s.monthlyContribution),
    })),
    ...strategic.loans.map((l) => ({
      id: `loan:${l.purpose}`,
      domain: "loan",
      label: l.purpose,
      monthlyAmount: num(l.monthlyInstallment),
    })),
  ].filter((c) => c.monthlyAmount > 0);

  const promiseWeight = computePromiseWeight({
    commitments,
    context: { monthlyFreeCashflow: monthlyFreeCashflow ?? 0, emergencyFloorMonths: 6, monthlyExpenses },
  });

  const turningPoints = deriveTurningPoints({
    sources: {
      emergencyFloor: { bufferMonths: assetContext.emergencyBufferMonths, floorMonths: 6 },
      completions: [],
      paymentMilestones: [],
      budgetGaps: [],
      fragments: [],
    },
  });

  const { echoes } = detectDecisionEchoes({
    events: ledgerEvents,
    dismissed: new Set(preferences?.dismissedEchoes ?? []),
  });

  return Response.json({
    promiseWeight: {
      status: promiseWeight.status,
      activeCommitmentCount: promiseWeight.activeCommitmentCount,
      pressureWindow: promiseWeight.pressureWindow,
      headlineKey: promiseWeight.headlineKey,
    },
    nextTurningPoint: turningPoints.nextDecision,
    turningPointCounts: { open: turningPoints.openCount, approaching: turningPoints.approachingCount },
    decisionEchoes: echoes,
    context: {
      monthlyFreeCashflow,
      emergencyBufferMonths: assetContext.emergencyBufferMonths,
      committedMonthlyTotal: Math.round(crossGoal.committedMonthlyTotal),
    },
    evidence: {
      commitmentCount: commitments.length,
      computedFrom: "sealed savings plans + loans + real cashflow + Change Ledger",
    },
  });
}
