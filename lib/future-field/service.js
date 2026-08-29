// Future Field service - assembles the real per-domain context the pure
// solvers need, and reads/writes plan-runtime state. Routes stay thin.

import { getPreferences } from "../preferences-store.js";
import { getExpenseHistory } from "../expense-store.js";
import { getIncomeHistory } from "../income-store.js";
import { computeSmoothedExpenses } from "../expense-finance.js";
import { computeSmoothedIncome } from "../income-finance.js";
import { resolveAssetPromptContext } from "../liquid-savings-context.js";
import { getCrossGoalSnapshot } from "../cross-goal-context.js";
import * as homeStore from "../home-store.js";
import { FIRST_HOME_DOWN_PAYMENT_RATE } from "../home-draft-finance.js";
import { getFutureFieldAdapter } from "./adapters.js";
import { planStore } from "../plan-runtime/index.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// The real "reality path" for a domain: the customer's confirmed plan +
// their real cashflow / savings / buffer, shaped into the planData every
// adapter expects.
export async function loadDomainContext(profileKey, domain) {
  const [preferences, expenseHistory, incomeHistory, crossGoal] = await Promise.all([
    getPreferences(profileKey),
    getExpenseHistory(profileKey),
    getIncomeHistory(profileKey),
    getCrossGoalSnapshot(profileKey),
  ]);
  const statedExpenses = num(preferences?.profile?.monthlyExpenses);
  const statedIncome = num(preferences?.profile?.statedMonthlyIncome);
  const statedSavings = num(preferences?.profile?.currentSavings);
  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, statedExpenses);
  const smoothedIncome = computeSmoothedIncome(incomeHistory, statedIncome);
  const assetContext = await resolveAssetPromptContext(
    profileKey,
    statedSavings,
    smoothedExpenses.effectiveMonthlyExpenses,
    "flexible",
  );

  let confirmedPlan = null;
  let confirmedSavingsPlan = null;
  if (domain === "home") {
    const session = await homeStore.getOrCreateSession(profileKey);
    [confirmedPlan, confirmedSavingsPlan] = await Promise.all([
      homeStore.getLatestArtifact(session.id, "stage1", "confirmed_plan"),
      homeStore.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan"),
    ]);
  }

  const monthlyIncome = smoothedIncome.effectiveMonthlyIncome;
  const monthlyExpenses = smoothedExpenses.effectiveMonthlyExpenses;
  const committedExcludingDomain =
    crossGoal.committedMonthlyTotal - num(confirmedSavingsPlan?.monthly_contribution);

  const realityPlanData =
    domain === "home" && confirmedPlan
      ? {
          estimated_price: confirmedPlan.estimated_price,
          property_type: confirmedPlan.property_type,
          monthly_income: monthlyIncome,
          monthly_expenses: monthlyExpenses,
          down_payment_needed: Math.round(confirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE),
          current_savings: assetContext.availableLiquidSavings,
          monthly_contribution: num(confirmedSavingsPlan?.monthly_contribution),
          target_complete_month: confirmedSavingsPlan?.target_complete_month ?? null,
        }
      : null;

  return {
    domain,
    monthlyIncome,
    monthlyExpenses,
    availableLiquidSavings: assetContext.availableLiquidSavings,
    emergencyBufferMonths: assetContext.emergencyBufferMonths,
    committedMonthlyTotal: crossGoal.committedMonthlyTotal,
    availableMonthlyCashflow: monthlyIncome > 0 ? monthlyIncome - monthlyExpenses - committedExcludingDomain : null,
    confirmedPlan,
    confirmedSavingsPlan,
    realityPlanData,
    adapter: getFutureFieldAdapter(domain),
  };
}

// Get or lazily create the plan-runtime plan row for a domain, seeded from
// the confirmed artifact so branches have a real base version to peel from.
export async function ensurePlan(profileKey, domain, context) {
  const plan = await planStore.getOrCreatePlan(profileKey, { domain, goalKey: domain, title: domain });
  const current = await planStore.getCurrentPlanVersion(plan.id);
  if (!current && context.realityPlanData) {
    await planStore.appendPlanVersion(plan.id, profileKey, {
      patch: context.realityPlanData,
      cause: { trigger: "seeded_from_confirmed_plan" },
      evidence: [],
      actor: "system",
    });
  }
  return planStore.getPlanById(plan.id, profileKey);
}
