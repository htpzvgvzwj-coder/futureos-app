import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { detectDecisionEchoes } from "../../../lib/living-plan/decision-echo.js";
import { computeCalendarOrbit, requiredMonthlyForTripMonth } from "../../../lib/travel/calendar-orbit-finance.js";
import { projectCalendarOrbitImpact } from "../../../lib/travel/calendar-orbit-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

const ORBIT_KEYS = ["travellers", "nights", "comfort_tier", "destination_type", "trip_month", "total_budget", "monthly_contribution", "current_savings", "latest_trip_month", "minimum_current_breathing_room"];
function orbitPlan(reality, branchData) {
  const out = {};
  for (const k of ORBIT_KEYS) {
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

  const context = await loadDomainContext(userId, "travel");
  if (!context.realityPlanData) {
    return Response.json({ domain: "travel", hasReality: false, reason: "no_trip_plan", unknowns: ["trip_month", "current_savings"] });
  }
  const plan = await ensurePlan(userId, "travel", context);
  const [branches, constraints, prefs, ledger] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "travel" }),
    getPreferences(userId),
    listEvents(userId, { filter: "all", limit: 120 }),
  ]);

  const reality = context.realityPlanData;
  const orbitCtx = {
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    otherGoalsMonthlyOutflow: Math.round(context.committedMonthlyTotal || 0),
    currentSavings: reality.current_savings ?? context.currentSavings ?? null,
    emergencyBufferMonths: context.emergencyBufferMonths ?? null,
  };

  const realityOrbit = computeCalendarOrbit({ planData: orbitPlan(reality, null), context: orbitCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selPlan = selected ? orbitPlan(reality, selected.data) : null;
  const selectedOrbit = selPlan ? computeCalendarOrbit({ planData: selPlan, context: orbitCtx }) : null;

  const impactSet = selPlan
    ? projectCalendarOrbitImpact({ branchPlan: selPlan, realityPlan: orbitPlan(reality, null), context: orbitCtx, allocation: selected?.data?.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  // Real Decision Echo - the >=3 user-confirmed similar Ledger actions gate
  // is inside detectDecisionEchoes; one slider move can't manufacture one.
  const { echoes } = detectDecisionEchoes({ events: ledger, dismissed: new Set(prefs?.dismissedEchoes ?? []) });
  const travelEcho = echoes.find((e) => /travel|trip|holiday|vacation|contribution/i.test(`${e.actionType ?? ""} ${e.domain ?? ""}`)) ?? null;

  const o = selectedOrbit ?? realityOrbit;
  const laterMonth = o.available && o.tripMonthNum ? shiftMonthKey(reality.trip_month, 2) : null;
  const laterPace = laterMonth ? requiredMonthlyForTripMonth({ planData: orbitPlan(reality, selected?.data ?? null), context: orbitCtx, tripMonth: laterMonth }) : null;

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'travel' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "travel",
    reality: { data: reality, orbit: realityOrbit },
    currentMoment: sealed ? "committed" : selPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: selPlan, orbit: selectedOrbit } : null,
    projection: { requiredMonthlyIfLater: laterPace, decisionEcho: travelEcho, paceState: o.paceState, fundedFraction: o.fundedFraction },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["home", "retirement", "wedding", "emergency", "flexible_cash"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(o?.available && o.sealable), reason: o?.sealableReason ?? "no_reality" },
    turningPoints: orbitTurningPoints({ orbit: o }),
    guardianState: sealed
      ? { state: "watching", watching: ["payment_windows", "fare_assumption_freshness", "contribution"], commitmentId: sealed.id, mayNot: ["auto_book", "auto_transfer", "auto_move_trip_month"] }
      : { state: "idle" },
    provenance: {
      referenceRates: "system_estimate",
      earmarkedSavings: orbitCtx.currentSavings != null ? "bank_confirmed" : "unknown",
      seasonality: "system_estimate",
      fares: "no_fare_prediction_reference_rates_only",
    },
    unknowns: realityOrbit.available ? realityOrbit.unknowns : ["trip_month", "current_savings"],
  });
}

function shiftMonthKey(m, by) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [y, mo] = s.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + by;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function orbitTurningPoints({ orbit }) {
  if (!orbit?.available) return [];
  const tps = [];
  if (orbit.liquidityConflict) {
    tps.push({ id: "orbit-liquidity-conflict", whyNowKey: "calendarOrbit.tp.liquidityConflict", ifYouWaitKey: "calendarOrbit.tp.liquidityConflictWait" });
  } else if (orbit.belowBreathing) {
    tps.push({ id: "orbit-below-breathing", whyNowKey: "calendarOrbit.tp.belowBreathing" });
  }
  if (orbit.pastLatest) {
    tps.push({ id: "orbit-past-latest", whyNowKey: "calendarOrbit.tp.pastLatest" });
  }
  if (orbit.paceState === "short" && orbit.requiredMonthly != null) {
    tps.push({ id: "orbit-behind-pace", whyNowKey: "calendarOrbit.tp.behindPace", whyNowParams: { need: orbit.requiredMonthly } });
  }
  return tps;
}
