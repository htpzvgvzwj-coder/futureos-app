import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { futureFieldSupportedDomains } from "../../../lib/future-field/adapters.js";
import { planStore, compareRealityToCommitted } from "../../../lib/plan-runtime/index.js";

export const runtime = "nodejs";

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

  const realityFeasibility = context.adapter.feasibility(context.realityPlanData);
  const projector = context.adapter.projector(context.realityPlanData);

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
    realityPath: {
      data: context.realityPlanData,
      feasibility: realityFeasibility,
    },
    possiblePaths: branches.map((b) => ({
      id: b.id,
      label: b.label,
      status: b.status,
      baseVersion: b.base_version,
      delta: b.delta,
      feasibility: b.feasibility,
    })),
    committedPath: context.confirmedSavingsPlan
      ? {
          monthlyContribution: Number(context.confirmedSavingsPlan.monthly_contribution) || 0,
          targetMonth: context.confirmedSavingsPlan.target_complete_month ?? null,
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
    context: {
      monthlyIncome: context.monthlyIncome,
      monthlyExpenses: context.monthlyExpenses,
      availableMonthlyCashflow: context.availableMonthlyCashflow,
      emergencyBufferMonths: context.emergencyBufferMonths,
      availableLiquidSavings: context.availableLiquidSavings,
    },
  });
}
