import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { detectDecisionEchoes } from "../../../lib/living-plan/decision-echo.js";
import { computeWeddingPlanFinance } from "../../../lib/wedding/plan-finance.js";
import { projectWeddingThreadImpact } from "../../../lib/wedding/wedding-thread-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

const WED_KEYS = ["wedding_date", "guest_count", "venue_tier", "venue_type", "photography_tier", "attire_tier", "total_budget", "monthly_contribution", "partner_contribution", "current_savings"];
function wedPlan(reality, branchData) {
  const out = {};
  for (const k of WED_KEYS) {
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

  const context = await loadDomainContext(userId, "wedding");
  if (!context.realityPlanData) {
    return Response.json({ domain: "wedding", hasReality: false, reason: "no_wedding_plan", unknowns: ["guest_count", "wedding_date"] });
  }
  const plan = await ensurePlan(userId, "wedding", context);
  const [branches, constraints, prefs, ledger] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "wedding" }),
    getPreferences(userId),
    listEvents(userId, { filter: "all", limit: 120 }),
  ]);

  const reality = context.realityPlanData;
  const wedCtx = {
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    committedExcludingWedding: Math.round(context.committedMonthlyTotal || 0),
  };

  const realityFin = computeWeddingPlanFinance({ planData: wedPlan(reality, null) });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selPlan = selected ? wedPlan(reality, selected.data) : null;
  const selectedFin = selPlan ? computeWeddingPlanFinance({ planData: selPlan }) : null;

  const impactSet = selPlan
    ? projectWeddingThreadImpact({ branchPlan: selPlan, realityPlan: wedPlan(reality, null), context: wedCtx, allocation: selected?.data?.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  const { echoes } = detectDecisionEchoes({ events: ledger, dismissed: new Set(prefs?.dismissedEchoes ?? []) });
  const weddingEcho = echoes.find((e) => /wedding|guest|venue|contribution/i.test(`${e.actionType ?? ""} ${e.domain ?? ""}`)) ?? null;

  const fin = selectedFin ?? realityFin;

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'wedding' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "wedding",
    reality: { data: reality, finance: realityFin },
    currentMoment: sealed ? "committed" : selPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: selPlan, finance: selectedFin } : null,
    projection: { decisionEcho: weddingEcho, planTotal: fin.available ? fin.planTotal : null, budgetGap: fin.available ? fin.budgetGap : null, userRequiredMonthly: fin.available ? fin.userRequiredMonthly : null },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["home", "retirement", "emergency", "flexible_cash"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(fin.available && fin.sealable), reason: fin.available ? (fin.feasible ? "ok" : "budget_below_core") : "no_reality" },
    turningPoints: weddingTurningPoints({ fin }),
    guardianState: sealed
      ? { state: "watching", watching: ["contribution", "reference_rate_freshness", "vendor_deposits"], commitmentId: sealed.id, mayNot: ["auto_book_vendor", "auto_transfer", "reveal_partner_savings"] }
      : { state: "idle" },
    provenance: {
      weddingCost: "system_estimate",
      partnerSavings: "never_returned",
      partnerMonthly: "user_confirmed",
      vendorQuotes: "no_vendor_quote_reference_rates_only",
    },
    unknowns: realityFin.available ? [] : ["guest_count", "wedding_date"],
  });
}

function weddingTurningPoints({ fin }) {
  if (!fin?.available) return [];
  const tps = [];
  if (fin.budgetGap > 0) {
    tps.push({ id: "wedding-budget-gap", whyNowKey: "weddingLivingPlan.tp.budgetGap", whyNowParams: { amount: fin.budgetGap } });
  }
  if (fin.onPace === false && fin.userRequiredMonthly != null) {
    tps.push({ id: "wedding-behind-pace", whyNowKey: "weddingLivingPlan.tp.behindPace", whyNowParams: { need: fin.userRequiredMonthly } });
  }
  return tps;
}
