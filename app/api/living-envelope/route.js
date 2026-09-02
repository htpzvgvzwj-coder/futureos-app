import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { detectDecisionEchoes } from "../../../lib/living-plan/decision-echo.js";
import { computeLivingEnvelope, PROTECTION_NODES } from "../../../lib/insurance/living-envelope-finance.js";
import { projectLivingEnvelopeImpact } from "../../../lib/insurance/living-envelope-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

const ENV_KEYS = ["monthly_premium_now", "income_protection_months", "existing_income_protection", "existing_life_cover", "existing_ci_cover", "home_loan_outstanding", "dependents", "annual_care_cost", "care_years", "years_of_support_per_dependent", "monthly_expenses", "monthly_income", "desired_cover", "minimum_current_breathing_room", "minimum_income_protection_months"];
function envPlan(reality, branchData) {
  const out = {};
  for (const k of ENV_KEYS) {
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

  const context = await loadDomainContext(userId, "insurance");
  if (!context.realityPlanData) {
    return Response.json({ domain: "insurance", hasReality: false, reason: "no_declared_coverage", nodes: PROTECTION_NODES.map((n) => n.id), unknowns: ["income_cover_or_need", "home_loan_cover_or_need"] });
  }
  const plan = await ensurePlan(userId, "insurance", context);
  const [branches, constraints, prefs, ledger] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "insurance" }),
    getPreferences(userId),
    listEvents(userId, { filter: "all", limit: 120 }),
  ]);

  const reality = context.realityPlanData;
  const envCtx = {
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    otherGoalsMonthlyOutflow: Math.round(context.committedMonthlyTotal || 0),
  };

  const realityEnv = computeLivingEnvelope({ planData: envPlan(reality, null), context: envCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selPlan = selected ? envPlan(reality, selected.data) : null;
  const selectedEnv = selPlan ? computeLivingEnvelope({ planData: selPlan, context: envCtx }) : null;

  const impactSet = selPlan
    ? projectLivingEnvelopeImpact({ branchPlan: selPlan, realityPlan: envPlan(reality, null), context: envCtx, allocation: selected?.data?.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  const { echoes } = detectDecisionEchoes({ events: ledger, dismissed: new Set(prefs?.dismissedEchoes ?? []) });
  const insuranceEcho = echoes.find((e) => /insur|protection|cover|premium/i.test(`${e.actionType ?? ""} ${e.domain ?? ""}`)) ?? null;

  const l = selectedEnv ?? realityEnv;

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'insurance' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "insurance",
    reality: { data: reality, envelope: realityEnv },
    nodes: PROTECTION_NODES,
    currentMoment: sealed ? "committed" : selPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: selPlan, envelope: selectedEnv } : null,
    projection: { decisionEcho: insuranceEcho, knownExposure: l.knownExposure, envelopeStatus: l.envelopeStatus },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["home", "family", "retirement", "flexible_cash"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(l?.available && l.sealable), reason: l?.sealableReason ?? "no_reality" },
    turningPoints: envelopeTurningPoints({ envelope: l }),
    guardianState: sealed
      ? { state: "watching", watching: ["premium", "declared_coverage_freshness", "life_thread_changes"], commitmentId: sealed.id, mayNot: ["buy_policy", "run_underwriting", "auto_increase_premium", "share_health_data"] }
      : { state: "idle" },
    provenance: {
      declaredCoverage: "user_confirmed",
      premiumRate: "system_estimate",
      underwriting: "never_run_here",
      unknownNodes: "shown_as_unknown_never_a_gap",
    },
    unknowns: realityEnv.available ? realityEnv.unknowns : ["income_cover_or_need"],
  });
}

function envelopeTurningPoints({ envelope }) {
  if (!envelope?.available) return [];
  const tps = [];
  if (envelope.liquidityConflict) {
    tps.push({ id: "envelope-liquidity", whyNowKey: "livingEnvelope.tp.liquidityConflict", ifYouWaitKey: "livingEnvelope.tp.liquidityConflictWait" });
  } else if (envelope.belowBreathing) {
    tps.push({ id: "envelope-below-breathing", whyNowKey: "livingEnvelope.tp.belowBreathing" });
  }
  if (envelope.belowIncomeFloor) {
    tps.push({ id: "envelope-income-floor", whyNowKey: "livingEnvelope.tp.belowIncomeFloor" });
  }
  const exposed = (envelope.membrane ?? []).filter((m) => m.state === "gap");
  if (exposed.length > 0) {
    tps.push({ id: "envelope-exposure", whyNowKey: "livingEnvelope.tp.exposure", whyNowParams: { nodes: exposed.length } });
  }
  return tps;
}
