import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { computeHomeHorizon, safePriceForMonth } from "../../../lib/home/horizon-finance.js";
import { projectHomeImpact } from "../../../lib/home/horizon-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

// GET /api/home-horizon[?branchId=...] - the Home Studio's unified domain
// API (Living Thread spec, Part B). Everything numeric is real, computed
// here from the customer's confirmed plan + cashflow, with provenance.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  const context = await loadDomainContext(userId, "home");
  if (!context.realityPlanData) {
    return Response.json({ domain: "home", hasReality: false, reason: "no_confirmed_home_plan", unknowns: ["estimated_price", "target_complete_month", "current_savings"] });
  }
  const plan = await ensurePlan(userId, "home", context);
  const [branches, constraints] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "home" }),
  ]);

  const projCtx = {
    committedMonthlyTotalExcludingHome: context.committedExcludingWedding ?? 0,
    emergencyBufferMonths: context.emergencyBufferMonths ?? null,
    weddingActive: Boolean(context.crossGoalNodes?.some((n) => n.goalId === "wedding")),
    retirementActive: false,
  };

  const realityData = context.realityPlanData;
  const realityHorizon = computeHomeHorizon({ planData: realityData, context: projCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selectedData = selected?.data ?? null;
  const selectedHorizon = selectedData ? computeHomeHorizon({ planData: selectedData, context: projCtx }) : null;
  const impactSet = selectedData
    ? projectHomeImpact({ branchData: selectedData, realityData, context: projCtx, allocation: selectedData.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  // Safe Price Shadow for the (branch or reality) target month.
  const targetMonth = selectedData?.target_complete_month ?? realityData.target_complete_month ?? null;
  const safePrice = targetMonth ? safePriceForMonth({ purchaseMonth: targetMonth, planData: selectedData ?? realityData, context: projCtx }) : null;

  // Active commitment => sealed identity (same as /api/future-field sceneSeal).
  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, effective_month, source_moment from goal_commitments
     where profile_key = $1 and domain = 'home' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;

  const h = selectedHorizon ?? realityHorizon;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "home",
    reality: { data: realityData, horizon: realityHorizon },
    currentMoment: sealed ? "committed" : selectedData ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, data: selectedData, horizon: selectedHorizon, baseVersion: selected.base_version } : null,
    projection: { safePriceForTargetMonth: safePrice, targetMonth },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, upfrontFreed: Math.max(0, -impactSet.resourceDelta.upfrontDelta), allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, extraUpfront: Math.max(0, impactSet.resourceDelta.upfrontDelta), sources: ["flexible_cash", "wedding", "investment", "retirement"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(h?.available && h.sealable), reason: h?.sealableReason ?? "no_reality" },
    turningPoints: homeTurningPoints({ horizon: h, context: projCtx, constraints }),
    guardianState: sealed
      ? { state: "watching", watching: ["deposit_progress", "rate_assumption_freshness", "emergency_rail"], commitmentId: sealed.id }
      : { state: "idle" },
    provenance: {
      price: realityData.estimated_price != null ? "user_confirmed" : "system_estimate",
      currentSavings: realityData.current_savings != null ? "bank_confirmed" : "unknown",
      rules: `MAS/IRAS rules as of ${realityHorizon.available ? realityHorizon.regulatory.asOf : "unknown"}`,
      fees: "system_estimate",
      cpf: realityData.cpf_available != null ? "user_confirmed" : "unknown",
      partnerContribution: realityData.partner_contribution != null ? "user_confirmed" : "unknown",
    },
    unknowns: [
      realityData.current_savings == null ? "current_savings" : null,
      realityData.cpf_available == null ? "cpf_available" : null,
      realityData.partner_contribution == null ? "partner_contribution" : null,
      realityData.renovation_reserve == null ? "renovation_reserve" : null,
    ].filter(Boolean),
  });
}

function homeTurningPoints({ horizon, constraints }) {
  if (!horizon?.available) return [];
  const tps = [];
  const floorPin = constraints.find((c) => c.kind === "minimum_emergency_months" || c.kind === "emergency_floor_months");
  const floor = floorPin ? Number(floorPin.value) : horizon.afterlife.keepEmergencyMonths;
  if (horizon.afterlife.postPurchaseEmergencyMonths != null && horizon.afterlife.postPurchaseEmergencyMonths < floor + 1 && horizon.afterlife.postPurchaseEmergencyMonths >= floor) {
    tps.push({ id: "home-emergency-near-rail", whyNowKey: "homeHorizon.tp.emergencyNearRail", whyNowParams: { months: horizon.afterlife.postPurchaseEmergencyMonths } });
  }
  if (horizon.afterlife.belowEmergencyFloor) {
    tps.push({ id: "home-below-floor", whyNowKey: "homeHorizon.tp.belowFloor", ifYouWaitKey: "homeHorizon.tp.belowFloorWait" });
  }
  if (horizon.readiness.shortfall.value <= 0) {
    tps.push({ id: "home-deposit-ready", whyNowKey: "homeHorizon.tp.depositReady" });
  }
  if (!horizon.regulatory.withinCeiling) {
    tps.push({ id: "home-over-ceiling", whyNowKey: "homeHorizon.tp.overCeiling", whyNowParams: { factor: horizon.regulatory.limitingFactor } });
  }
  return tps;
}
