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
import * as weddingStore from "../wedding-store.js";
import { FIRST_HOME_DOWN_PAYMENT_RATE, computeReadyDateForMonthlyAmount } from "../home-draft-finance.js";
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

  const monthlyIncome = smoothedIncome.effectiveMonthlyIncome;
  const monthlyExpenses = smoothedExpenses.effectiveMonthlyExpenses;

  // Always read the home plan too - even for a non-home domain - because
  // the home deposit is a real node on every Living Plan's field, and its
  // monthly contribution is part of what the current domain has to fit
  // around.
  const homeSession = await homeStore.getOrCreateSession(profileKey);
  const [homeConfirmedPlan, homeConfirmedSavingsPlan] = await Promise.all([
    homeStore.getLatestArtifact(homeSession.id, "stage1", "confirmed_plan"),
    homeStore.getLatestArtifact(homeSession.id, "stage2", "confirmed_savings_plan"),
  ]);

  let confirmedPlan = null;
  let confirmedSavingsPlan = null;
  let realityPlanData = null;

  if (domain === "home") {
    confirmedPlan = homeConfirmedPlan;
    confirmedSavingsPlan = homeConfirmedSavingsPlan;
    realityPlanData = confirmedPlan
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
  } else if (domain === "wedding") {
    const wSession = await weddingStore.getOrCreateSession(profileKey);
    [confirmedPlan, confirmedSavingsPlan] = await Promise.all([
      weddingStore.getLatestArtifact(wSession.id, "stage1", "confirmed_budget"),
      weddingStore.getLatestArtifact(wSession.id, "stage2", "confirmed_savings_plan"),
    ]);
    realityPlanData = confirmedPlan
      ? {
          wedding_date: confirmedPlan.wedding_date ?? null,
          guest_count: num(confirmedPlan.guest_count),
          venue_tier: confirmedPlan.venue_tier ?? "mid_range",
          venue_type: confirmedPlan.venue_type ?? "hotel",
          photography_tier: confirmedPlan.photography_tier ?? "mid_range",
          attire_tier: confirmedPlan.attire_tier ?? "mid_range",
          total_budget: num(confirmedPlan.total_budget) || null,
          monthly_contribution: num(confirmedSavingsPlan?.monthly_contribution),
          partner_contribution: num(confirmedSavingsPlan?.partner_contribution),
          current_savings: assetContext.availableLiquidSavings,
        }
      : null;
  } else if (domain === "emergency") {
    // The emergency reservoir needs no confirmed artifact - the reality
    // path is always available once we know real expenses + savings.
    realityPlanData =
      monthlyExpenses > 0
        ? {
            monthly_expenses: monthlyExpenses,
            current_savings: assetContext.availableLiquidSavings,
            target_months: 6,
            floor_months: 6,
            monthly_contribution: 0,
          }
        : null;
  }

  const committedExcludingDomain =
    crossGoal.committedMonthlyTotal - num(confirmedSavingsPlan?.monthly_contribution);

  // Cross-goal nodes rendered alongside the current domain on the same time
  // field. Real numbers only.
  const crossGoalNodes = [];
  if (domain !== "home" && homeConfirmedPlan) {
    const dpNeeded = Math.round(homeConfirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
    const homeMonthly = num(homeConfirmedSavingsPlan?.monthly_contribution);
    const proj = computeReadyDateForMonthlyAmount({
      downPaymentNeeded: dpNeeded,
      currentSavings: assetContext.availableLiquidSavings,
      monthlyAmount: homeMonthly,
    });
    crossGoalNodes.push({
      goalId: "home",
      label: "Home deposit",
      monthlyContribution: homeMonthly,
      downPaymentNeeded: dpNeeded,
      readyMonth: proj.readyMonth,
      monthsToReady: proj.monthsToReady,
    });
  }
  crossGoalNodes.push({
    goalId: "emergency",
    label: "Emergency fund",
    bufferMonths: assetContext.emergencyBufferMonths,
    floorMonths: 6,
    safe: assetContext.emergencyBufferMonths >= 6,
  });

  // Everything except this domain's own confirmed savings plan - what the
  // domain's contribution has to fit around. Used by cross-goal projection.
  const committedExcludingWedding = crossGoal.committedMonthlyTotal - num(confirmedSavingsPlan?.monthly_contribution);
  const homeProjectionNode = homeConfirmedPlan
    ? {
        monthlyContribution: num(homeConfirmedSavingsPlan?.monthly_contribution),
        downPaymentNeeded: Math.round(homeConfirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE),
        currentSavings: assetContext.availableLiquidSavings,
      }
    : null;

  return {
    domain,
    monthlyIncome,
    monthlyExpenses,
    availableLiquidSavings: assetContext.availableLiquidSavings,
    emergencyBufferMonths: assetContext.emergencyBufferMonths,
    committedMonthlyTotal: crossGoal.committedMonthlyTotal,
    committedExcludingWedding,
    availableMonthlyCashflow: monthlyIncome > 0 ? monthlyIncome - monthlyExpenses - committedExcludingDomain : null,
    confirmedPlan,
    confirmedSavingsPlan,
    realityPlanData,
    crossGoalNodes,
    // The shape lib/wedding/cross-goal-projection.js's `context` expects.
    projectionContext: {
      monthlyIncome,
      monthlyExpenses,
      committedExcludingWedding,
      emergencyBufferMonths: assetContext.emergencyBufferMonths,
      home: homeProjectionNode,
    },
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
