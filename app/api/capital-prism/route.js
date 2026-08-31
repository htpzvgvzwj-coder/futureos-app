import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { detectDecisionEchoes } from "../../../lib/living-plan/decision-echo.js";
import { computeCapitalPrism, requiredInvestingForTargetYears, PRISM_BANDS } from "../../../lib/investment/capital-prism-finance.js";
import { projectCapitalPrismImpact } from "../../../lib/investment/capital-prism-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

const PRISM_KEYS = ["jobs", "monthly_commitment", "liquidity_gate_years", "horizon_years", "target_pool", "current_savings", "credit_card_outstanding", "monthly_income", "monthly_expenses", "real_return_assumption"];
function prismPlan(reality, branchData) {
  const out = {};
  for (const k of PRISM_KEYS) {
    if (branchData && branchData[k] != null) out[k] = branchData[k];
    else if (reality[k] != null) out[k] = reality[k];
  }
  return out;
}

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  const context = await loadDomainContext(userId, "investment");
  if (!context.realityPlanData) {
    return Response.json({ domain: "investment", hasReality: false, reason: "no_confirmed_recurring_investment", bands: PRISM_BANDS.map((b) => b.id), unknowns: ["available_monthly_cashflow", "current_savings"] });
  }
  const plan = await ensurePlan(userId, "investment", context);
  const [branches, constraints, prefs, ledger] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "investment" }),
    getPreferences(userId),
    listEvents(userId, { filter: "all", limit: 120 }),
  ]);

  const reality = context.realityPlanData;
  const prismCtx = {
    availableMonthlyCashflow: context.availableMonthlyCashflow ?? reality.available_monthly_cashflow ?? null,
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    emergencyBufferMonths: context.emergencyBufferMonths ?? null,
  };

  const realityPrism = computeCapitalPrism({ planData: prismPlan(reality, null), context: prismCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selPlan = selected ? prismPlan(reality, selected.data) : null;
  const selectedPrism = selPlan ? computeCapitalPrism({ planData: selPlan, context: prismCtx }) : null;

  const impactSet = selPlan
    ? projectCapitalPrismImpact({ branchPlan: selPlan, realityPlan: prismPlan(reality, null), context: prismCtx, allocation: selected?.data?.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  // Real Decision Echo - the >=3 user-confirmed similar Ledger actions gate
  // is inside detectDecisionEchoes; one seam drag can't manufacture one.
  const { echoes } = detectDecisionEchoes({ events: ledger, dismissed: new Set(prefs?.dismissedEchoes ?? []) });
  const investmentEcho = echoes.find((e) => /invest|capital|portfolio|rsp|contribution/i.test(`${e.actionType ?? ""} ${e.domain ?? ""}`)) ?? null;

  const p = selectedPrism ?? realityPrism;
  const bySolve = requiredInvestingForTargetYears({ prism: p, byYears: p.available ? Math.max(1, p.gateYears) : 1 });

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'investment' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "investment",
    reality: { data: reality, prism: realityPrism },
    bands: PRISM_BANDS,
    currentMoment: sealed ? "committed" : selPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: selPlan, prism: selectedPrism } : null,
    projection: { requiredInvestingForGateYears: bySolve, decisionEcho: investmentEcho, openHorizonBand: p.openHorizonBand, yearsToTarget: p.yearsToTarget },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["safety", "wedding", "home", "flexible_cash"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(p?.available && p.sealable), reason: p?.sealableReason ?? "no_reality" },
    turningPoints: prismTurningPoints({ prism: p }),
    guardianState: sealed
      ? { state: "watching", watching: ["contribution", "readiness_gate", "liquidity_gate"], commitmentId: sealed.id, mayNot: ["execute_trades", "auto_rebalance", "auto_increase_commitment", "treat_liquidity_split_as_authorization"] }
      : { state: "idle" },
    provenance: {
      capitalPool: prismCtx.availableMonthlyCashflow != null ? "bank_confirmed" : "system_estimate",
      currentSavings: reality.current_savings != null ? "user_confirmed" : "unknown",
      returns: "no_return_assumed_in_base",
      readinessGate: "system_estimate",
    },
    unknowns: realityPrism.available ? realityPrism.unknowns : ["available_monthly_cashflow", "current_savings"],
  });
}

function prismTurningPoints({ prism }) {
  if (!prism?.available) return [];
  const tps = [];
  if (prism.over) {
    tps.push({ id: "prism-over-allocated", whyNowKey: "capitalPrism.tp.overAllocated" });
  }
  if (prism.investingBlockedByGate) {
    tps.push({ id: "prism-readiness-gate", whyNowKey: "capitalPrism.tp.readinessGate", whyNowParams: { gate: prism.readiness } });
  }
  return tps;
}
