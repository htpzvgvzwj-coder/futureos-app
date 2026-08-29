import { getCurrentUserId } from "../../../../lib/auth.js";
import { getPreferences } from "../../../../lib/preferences-store.js";
import { getExpenseHistory } from "../../../../lib/expense-store.js";
import { getIncomeHistory } from "../../../../lib/income-store.js";
import { computeSmoothedExpenses } from "../../../../lib/expense-finance.js";
import { computeSmoothedIncome } from "../../../../lib/income-finance.js";
import { resolveAssetPromptContext } from "../../../../lib/liquid-savings-context.js";
import { getStrategicBalanceSnapshot } from "../../../../lib/strategic-balance-context.js";
import { buildShadowPreview } from "../../../../lib/guardian/shadow-guardian.js";

export const runtime = "nodejs";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Shadow Guardian rehearses a shock against the customer's sealed
// commitments. It never runs unprompted from the client's point of view -
// this endpoint is only hit when the customer opens the quiet entry. Body:
// { trigger: { kind: "expense_shock"|"income_drop", detail: {...} } }.
// With no trigger it rehearses "keep everything as-is" and returns
// allClear / needsAChoice.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

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

  const [asset, strategic] = await Promise.all([
    resolveAssetPromptContext(userId, statedSavings, smoothedExpenses.effectiveMonthlyExpenses, "flexible"),
    getStrategicBalanceSnapshot(userId),
  ]);

  const monthlyExpenses = smoothedExpenses.effectiveMonthlyExpenses;
  const monthlyIncome = smoothedIncome.effectiveMonthlyIncome;
  const monthlyFreeCashflow = monthlyIncome > 0 ? monthlyIncome - monthlyExpenses : 0;

  const commitments = [
    ...strategic.savings.map((s) => ({ id: `savings:${s.domain}`, domain: s.domain, monthlyContribution: num(s.monthlyContribution) })),
    ...strategic.loans.map((l) => ({ id: `loan:${l.purpose}`, domain: "loan", monthlyContribution: num(l.monthlyInstallment) })),
  ].filter((c) => c.monthlyContribution > 0);

  // Default trigger: a modest "what if a recurring expense appeared" probe,
  // sized to a fraction of current free cashflow, so the rehearsal is
  // meaningful rather than trivial. The customer can pass their own.
  const trigger =
    body.trigger && body.trigger.kind
      ? body.trigger
      : { kind: "expense_shock", detail: { extraMonthlyExpense: Math.round(Math.max(200, monthlyFreeCashflow * 0.4)) } };

  const preview = buildShadowPreview({
    trigger,
    commitments,
    context: {
      monthlyFreeCashflow,
      emergencyBufferMonths: asset.emergencyBufferMonths,
      monthlyExpenses,
      emergencyFloorMonths: 6,
    },
  });

  return Response.json({ preview: preview ?? { state: "watching", needsAChoice: false } });
}
