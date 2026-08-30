import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { detectDecisionEchoes } from "../../../lib/living-plan/decision-echo.js";
import { computeFutureLoom, requiredContributionForFutureDay, FUTURE_DAY_QUESTIONS } from "../../../lib/retirement/future-day-finance.js";
import { projectFutureDayImpact } from "../../../lib/retirement/future-day-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

function loomPlan(reality, branchData) {
  return {
    future_day: branchData?.future_day ?? reality.future_day ?? {},
    future_age: branchData?.future_age ?? reality.future_age ?? null,
    current_age: reality.current_age ?? null,
    monthly_contribution: Number(branchData?.monthly_contribution ?? reality.monthly_contribution) || 0,
    inflation_assumption: branchData?.inflation_assumption ?? reality.inflation_assumption ?? null,
    longevity_years: branchData?.longevity_years ?? reality.longevity_years ?? 25,
    real_return_assumption: branchData?.real_return_assumption ?? reality.real_return_assumption ?? null,
    minimum_current_breathing_room: Number(reality.minimum_current_breathing_room) || 0,
  };
}

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  const context = await loadDomainContext(userId, "retirement");
  if (!context.realityPlanData) {
    return Response.json({ domain: "retirement", hasReality: false, reason: "no_confirmed_retirement_plan", questions: FUTURE_DAY_QUESTIONS.map((q) => q.id), unknowns: ["target_monthly_income", "cpf_life_monthly", "current_age"] });
  }
  const plan = await ensurePlan(userId, "retirement", context);
  const [branches, constraints, prefs, ledger] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "retirement" }),
    getPreferences(userId),
    listEvents(userId, { filter: "all", limit: 120 }),
  ]);

  const reality = context.realityPlanData;
  const cpfLife = Number(reality.target_monthly_income) - Number(reality.gap_monthly);
  const loomCtx = {
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    otherGoalsMonthlyOutflow: Math.round(context.committedMonthlyTotal || 0),
    cpfLifeMonthly: Number.isFinite(cpfLife) && cpfLife > 0 ? cpfLife : null,
    existingRetirementAssets: prefs?.profile?.existingRetirementAssets ?? null,
    emergencyBufferMonths: context.emergencyBufferMonths ?? null,
  };

  const realityLoom = computeFutureLoom({ planData: loomPlan(reality, null), context: loomCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selBranchPlan = selected ? loomPlan(reality, selected.data) : null;
  const selectedLoom = selBranchPlan ? computeFutureLoom({ planData: selBranchPlan, context: loomCtx }) : null;

  const impactSet = selBranchPlan
    ? projectFutureDayImpact({ branchPlan: selBranchPlan, realityPlan: loomPlan(reality, null), context: loomCtx, allocation: selected?.data?.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  // Real Decision Echo - the >=3 user-confirmed similar Ledger actions gate
  // is inside detectDecisionEchoes; a single slider adjustment can't make one.
  const { echoes } = detectDecisionEchoes({ events: ledger, dismissed: new Set(prefs?.dismissedEchoes ?? []) });
  const retirementEcho = echoes.find((e) => /retirement|future_day|contribution/i.test(`${e.actionType ?? ""} ${e.domain ?? ""}`)) ?? null;

  const l = selectedLoom ?? realityLoom;
  const bySolve = requiredContributionForFutureDay({ loom: l, byYears: l.yearsToAccumulate });

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'retirement' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "retirement",
    reality: { data: reality, loom: realityLoom },
    questions: FUTURE_DAY_QUESTIONS,
    currentMoment: sealed ? "committed" : selBranchPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: selBranchPlan, loom: selectedLoom } : null,
    projection: { requiredContributionForFutureDay: bySolve, decisionEcho: retirementEcho, openFutureBand: l.openFutureBand },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["investment", "home", "family", "insurance", "travel", "flexible_cash"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(l?.available && l.sealable), reason: l?.sealableReason ?? "no_reality" },
    turningPoints: loomTurningPoints({ loom: l }),
    guardianState: sealed
      ? { state: "watching", watching: ["contribution", "assumption_freshness", "life_thread_changes"], commitmentId: sealed.id, mayNot: ["auto_increase_contribution", "execute_trades", "treat_decision_echo_as_authorization"] }
      : { state: "idle" },
    provenance: {
      futureDayBaseline: loomCtx.monthlyExpenses > 0 ? "user_confirmed" : "system_estimate",
      cpfLife: loomCtx.cpfLifeMonthly != null ? "bank_confirmed" : "unknown",
      existingRetirementAssets: loomCtx.existingRetirementAssets != null ? "user_confirmed" : "unknown",
      inflation: "system_estimate",
      returns: "no_return_assumed_in_base",
    },
    unknowns: realityLoom.available ? realityLoom.unknowns : ["target_monthly_income", "cpf_life_monthly"],
  });
}

function loomTurningPoints({ loom }) {
  if (!loom?.available) return [];
  const tps = [];
  if (loom.liquidityConflict) {
    tps.push({ id: "loom-liquidity-conflict", whyNowKey: "futureDayLoom.tp.liquidityConflict", ifYouWaitKey: "futureDayLoom.tp.liquidityConflictWait" });
  } else if (loom.belowBreathing) {
    tps.push({ id: "loom-below-breathing", whyNowKey: "futureDayLoom.tp.belowBreathing" });
  }
  if (!loom.coversExpected && loom.currentContribution.value > 0) {
    tps.push({ id: "loom-gap-threshold", whyNowKey: "futureDayLoom.tp.gapThreshold", whyNowParams: { needLow: loom.requiredContributionRange.expected } });
  }
  return tps;
}
