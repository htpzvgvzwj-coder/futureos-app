import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import * as loanStore from "../../../lib/loan-store.js";
import { LOAN_PURPOSES } from "../../../lib/loan-finance.js";
import { computeDebtGravity, strategyComparison, requiredExtraForPayoffMonth } from "../../../lib/loan/debt-gravity-finance.js";
import { projectDebtImpact } from "../../../lib/loan/debt-gravity-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

// Every real debt: all confirmed loans + a confirmed card balance. Nothing
// fabricated; unknown APR / fees stay unknown.
async function realDebts(userId) {
  const debts = [];
  for (const purpose of Object.keys(LOAN_PURPOSES)) {
    const s = await loanStore.getOrCreateSession(userId, purpose);
    const loan = await loanStore.getLatestArtifact(s.id, "stage1", "confirmed_loan");
    if (loan && Number(loan.loan_amount) > 0) {
      debts.push({
        id: `loan:${purpose}`,
        label: purpose,
        kind: "loan",
        balance: Number(loan.loan_amount),
        annualRatePercent: loan.annual_rate_percent != null ? Number(loan.annual_rate_percent) : null,
        minimumMonthly: Number(loan.monthly_installment) || 0,
        feeConfirmed: loan.early_repayment_fee != null ? Number(loan.early_repayment_fee) : null,
        provenance: "bank_confirmed",
      });
    }
  }
  const prefs = await getPreferences(userId);
  const card = Number(prefs?.profile?.creditCardOutstanding) || 0;
  if (card > 0 && prefs?.profileVersion != null) {
    debts.push({ id: "card:primary", label: "credit_card", kind: "card", balance: card, annualRatePercent: 26, minimumMonthly: Math.max(50, Math.round(card * 0.03)), feeConfirmed: 0, provenance: "user_confirmed" });
  }
  return debts;
}

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  const [context, debts] = await Promise.all([loadDomainContext(userId, "loan"), realDebts(userId)]);
  if (debts.length === 0) {
    return Response.json({ domain: "loan", hasReality: false, reason: "no_confirmed_debt", unknowns: ["confirmed_debt"] });
  }
  const plan = context.realityPlanData ? await ensurePlan(userId, "loan", context) : await planStore.getOrCreatePlan(userId, { domain: "loan", goalKey: "loan", title: "loan" });
  const [branches, constraints] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "loan" }),
  ]);

  const gravityCtx = {
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    otherGoalsMonthlyOutflow: Math.round(context.committedMonthlyTotal || 0),
    emergencyBufferMonths: context.emergencyBufferMonths ?? null,
    currentSavings: context.availableLiquidSavings ?? 0,
    protectedSavings: 0,
  };

  const realityPlan = { target_debt: debts[0].id, extra_monthly: 0, one_off_payment: 0, breathing_room_floor: 0, excluded_debt_ids: [] };
  const realityGravity = computeDebtGravity({ debts, planData: realityPlan, context: gravityCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selBranchPlan = selected
    ? {
        ...realityPlan,
        extra_monthly: Number(selected.data?.extra_repayment) || 0,
        one_off_payment: Number(selected.data?.one_off_payment) || 0,
        target_debt: selected.data?.target_debt ?? realityPlan.target_debt,
        breathing_room_floor: Number(selected.data?.breathing_room_floor) || 0,
      }
    : null;
  const selectedGravity = selBranchPlan ? computeDebtGravity({ debts, planData: selBranchPlan, context: gravityCtx }) : null;

  const impactSet = selBranchPlan
    ? projectDebtImpact({ branchPlan: selBranchPlan, realityPlan, debts, context: gravityCtx, allocation: selected?.data?.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  const totalExtraBudget = Number(url.searchParams.get("extraBudget")) || (context.availableMonthlyCashflow != null ? Math.max(0, Math.round(context.availableMonthlyCashflow / 2)) : 0);
  const strategy = strategyComparison({ debts, extraBudget: totalExtraBudget, context: gravityCtx });

  const g = selectedGravity ?? realityGravity;
  const targetBody = debts.find((d) => d.id === g.targetDebtId) ?? debts[0];
  const requiredExtra12 = requiredExtraForPayoffMonth({ debt: targetBody, byMonths: 12 });
  const requiredExtra36 = requiredExtraForPayoffMonth({ debt: targetBody, byMonths: 36 });

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'loan' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;

  return Response.json({
    domain: "loan",
    reality: { plan: realityPlan, gravity: realityGravity, debts },
    currentMoment: sealed ? "committed" : selBranchPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: selBranchPlan, gravity: selectedGravity } : null,
    projection: { strategyComparison: strategy, requiredExtraForPayoff: { in12: requiredExtra12, in36: requiredExtra36 } },
    impactSet,
    futureFragment: null, // the loan Fragment appears AT payoff, not now - see futureHandoffPreview
    futureHandoffPreview: g.futureHandoffPreview,
    addedPressure: g.extraMonthly.value > 0 ? { extraMonthly: g.extraMonthly.value, sources: ["flexible_cash", "home", "wedding", "investment", "retirement"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(g?.available && g.sealable), reason: g?.sealableReason ?? "no_reality" },
    turningPoints: gravityTurningPoints({ gravity: g }),
    guardianState: sealed
      ? { state: "watching", watching: ["due_dates", "breathing_room_floor"], onPayoff: "propose_future_handoff", commitmentId: sealed.id, mayNot: ["auto_repay", "auto_select_debt", "auto_redistribute_released_monthly"] }
      : { state: "idle" },
    provenance: {
      balances: "bank_confirmed",
      apr: debts.every((d) => d.annualRatePercent != null) ? "bank_confirmed" : "partly_unknown",
      fees: debts.every((d) => d.feeConfirmed != null) ? "user_confirmed" : "unknown",
      breathingRoom: gravityCtx.monthlyIncome > 0 ? "system_estimate" : "unknown",
    },
    unknowns: realityGravity.available ? realityGravity.unknowns : ["confirmed_debt"],
  });
}

function gravityTurningPoints({ gravity }) {
  if (!gravity?.available) return [];
  const tps = [];
  for (const b of gravity.bodies) {
    if (b.monthsToPayoff != null && b.monthsToPayoff <= 12 && b.monthsToPayoff > 0) {
      tps.push({ id: `gravity-near-payoff-${b.id}`, whyNowKey: "debtGravity.tp.nearPayoff", whyNowParams: { label: b.label, months: b.monthsToPayoff } });
    }
  }
  if (gravity.belowBreathingFloor) {
    tps.push({ id: "gravity-below-breathing", whyNowKey: "debtGravity.tp.belowBreathing", ifYouWaitKey: "debtGravity.tp.belowBreathingWait" });
  }
  if (gravity.bodies.some((b) => b.annualRatePercent.provenance === "unknown")) {
    tps.push({ id: "gravity-apr-unknown", whyNowKey: "debtGravity.tp.aprUnknown" });
  }
  return tps;
}
