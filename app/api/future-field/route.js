import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { futureFieldSupportedDomains } from "../../../lib/future-field/adapters.js";
import { planStore, compareRealityToCommitted } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";

export const runtime = "nodejs";

// Part 0.4: an explicit sealability verdict for a path - never "undefined
// means true". A path is sealable only when its feasibility SAYS so.
function sealabilityVerdict(feasibility) {
  if (!feasibility || feasibility.available === false) {
    return { sealable: false, reason: feasibility?.reason ?? "no_feasibility" };
  }
  if (typeof feasibility.sealable !== "boolean") {
    return { sealable: false, reason: "sealability_not_computed" };
  }
  return { sealable: feasibility.sealable, reason: feasibility.sealableReason ?? (feasibility.sealable ? "ok" : "blocked") };
}

// Assemble the Future Field for one domain: the reality path (confirmed
// plan + real feasibility), the possible paths (branches), the pins, and
// the live catch-up status (reality vs committed). Everything numeric is
// real - computed here from the customer's confirmed plan and cashflow,
// never from an AI.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const domain = new URL(request.url).searchParams.get("domain") ?? "home";
  if (!futureFieldSupportedDomains().includes(domain)) {
    return Response.json({ error: "domain_not_supported", supported: futureFieldSupportedDomains() }, { status: 400 });
  }

  const context = await loadDomainContext(userId, domain);
  if (!context.realityPlanData) {
    return Response.json({
      domain,
      hasRealityPath: false,
      reason: "no_confirmed_plan",
      supportedDomains: futureFieldSupportedDomains(),
    });
  }

  const plan = await ensurePlan(userId, domain, context);
  const [branches, constraints, currentVersion] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain }),
    planStore.getCurrentPlanVersion(plan.id),
  ]);

  // Part 0.3: the identity of THIS scene's seal. A scene is sealed only
  // when an active commitment for the same (domain, plan) exists. Any
  // generic confirmed_savings_plan is NOT this scene's seal.
  const { rows: commitRows } = await query(
    `select id, domain, plan_id, plan_branch_id, monthly_contribution, effective_month, source_moment
     from goal_commitments
     where profile_key = $1 and domain = $2 and plan_id = $3 and status = 'active'
     order by created_at desc limit 1`,
    [userId, domain, plan.id],
  );
  let sceneSeal = { sealed: false };
  if (commitRows[0]) {
    const c = commitRows[0];
    const sm = c.source_moment ?? {};
    const { rows: gpRows } = await query(
      `select id, pause_conditions, reconfirm_after_days from guardian_policies
       where profile_key = $1 and commitment_id = $2 and active = true order by created_at desc limit 1`,
      [userId, c.id],
    );
    sceneSeal = {
      sealed: true,
      commitmentId: c.id,
      domain: c.domain,
      planId: c.plan_id,
      branchId: c.plan_branch_id ?? null,
      baseVersion: sm.baseVersion ?? null,
      monthlyContribution: Number(c.monthly_contribution) || 0,
      effectiveMonth: c.effective_month,
      allocation: sm.allocation ?? null,
      allocationTargetGoalId: sm.allocationTargetGoalId ?? sm.allocationGoalId ?? null,
      guardianPolicy: gpRows[0]
        ? { id: gpRows[0].id, pauseConditions: gpRows[0].pause_conditions ?? [], reconfirmAfterDays: gpRows[0].reconfirm_after_days }
        : null,
      identityMatches: true,
    };
  }

  const realityFeasibility = context.adapter.feasibility(context.realityPlanData);
  const projector = context.adapter.projector(context.realityPlanData);

  // Ready-month for a given planData + monthly amount - the canvas places
  // every path's end node on the time axis with this. Real projector math,
  // never a guess; null when the amount can't reach a date.
  const readyMonthFor = (planData, monthlyAmount) => {
    const months = context.adapter.projector(planData)(monthlyAmount);
    if (months == null) return { monthsToReady: null, readyMonth: null };
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return { monthsToReady: months, readyMonth: d.toISOString().slice(0, 7) };
  };
  const realityReady = readyMonthFor(context.realityPlanData, context.realityPlanData.monthly_contribution || 0);

  // Catch-up: reality vs the committed monthly amount.
  let catchUp = null;
  if (context.confirmedSavingsPlan) {
    const committed = {
      monthlyContribution: Number(context.confirmedSavingsPlan.monthly_contribution) || 0,
      startMonth: context.confirmedSavingsPlan.start_month ?? new Date().toISOString().slice(0, 7),
      targetMonth: context.confirmedSavingsPlan.target_complete_month ?? null,
      downPaymentNeeded: context.realityPlanData.down_payment_needed,
      currentSavingsAtStart: context.availableLiquidSavings,
    };
    catchUp = compareRealityToCommitted({
      committed,
      realityCheckins: [],
      currentSavingsNow: context.availableLiquidSavings,
      projectFn: (savings, monthly) =>
        projector(monthly) == null ? null : projector(monthly), // savings baked into projector
    });
  }

  return Response.json({
    domain,
    planId: plan.id,
    state: plan.state,
    currentVersion: currentVersion?.version ?? "0",
    hasRealityPath: true,
    sceneSeal,
    realityPath: {
      data: context.realityPlanData,
      feasibility: realityFeasibility,
      sealableVerdict: sealabilityVerdict(realityFeasibility),
      monthlyContribution: context.realityPlanData.monthly_contribution || 0,
      ...realityReady,
    },
    possiblePaths: branches.map((b) => {
      const monthly = Number(b.data?.monthly_contribution) || context.realityPlanData.monthly_contribution || 0;
      // Real per-branch cross-goal projection (Home + Emergency + Cashflow
      // before/after). Only domains whose adapter implements projectImpacts
      // return this; others get null (honest).
      const projectedImpacts =
        typeof context.adapter.projectImpacts === "function"
          ? context.adapter.projectImpacts(b.data ?? context.realityPlanData, context.realityPlanData, context.projectionContext ?? {})
          : null;
      // Recompute the branch's feasibility now (its stored copy can be
      // stale) so the sealability verdict is current and explicit.
      const freshFeasibility = context.adapter.feasibility(b.data ?? context.realityPlanData);
      return {
        id: b.id,
        label: b.label,
        status: b.status,
        baseVersion: b.base_version,
        delta: b.delta,
        feasibility: freshFeasibility,
        sealableVerdict: sealabilityVerdict(freshFeasibility),
        monthlyContribution: monthly,
        projectedImpacts,
        ...readyMonthFor(b.data ?? context.realityPlanData, monthly),
      };
    }),
    committedPath: context.confirmedSavingsPlan
      ? {
          monthlyContribution: Number(context.confirmedSavingsPlan.monthly_contribution) || 0,
          targetMonth: context.confirmedSavingsPlan.target_complete_month ?? null,
          ...readyMonthFor(context.realityPlanData, Number(context.confirmedSavingsPlan.monthly_contribution) || 0),
        }
      : null,
    pins: constraints.map((c) => ({
      id: c.id,
      kind: c.kind,
      operator: c.operator,
      value: c.value == null ? null : Number(c.value),
      scope: c.scope,
    })),
    catchUp,
    // Other real goals sharing this time field - Home deposit and the
    // Emergency fund floor. Rendered as their own nodes so a change here is
    // seen moving them.
    crossGoalNodes: context.crossGoalNodes ?? [],
    context: {
      monthlyIncome: context.monthlyIncome,
      monthlyExpenses: context.monthlyExpenses,
      availableMonthlyCashflow: context.availableMonthlyCashflow,
      emergencyBufferMonths: context.emergencyBufferMonths,
      availableLiquidSavings: context.availableLiquidSavings,
      committedMonthlyTotal: context.committedMonthlyTotal,
    },
  });
}
