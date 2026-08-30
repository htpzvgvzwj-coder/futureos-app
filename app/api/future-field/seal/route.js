import { getCurrentUserId } from "../../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../../lib/future-field/service.js";
import {
  planStore,
  buildSealPreview,
  checkConstraints,
  validateCommitmentAmount,
  buildAdjustedSavingsPlanPayload,
} from "../../../../lib/plan-runtime/index.js";
import { sealAtomic, validateSealAllocation, resolveAllowedTargets, findSealByIdempotencyKey } from "../../../../lib/plan-runtime/atomic-seal.js";
import { query } from "../../../../lib/db.js";
import * as homeStore from "../../../../lib/home-store.js";
import * as weddingStore from "../../../../lib/wedding-store.js";
import { EMERGENCY_FUND_MONTHS_TARGET } from "../../../../lib/investment-readiness-finance.js";

export const runtime = "nodejs";

function nextMonthKey() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

// Seal turns a possible future into a commitment - but only through an
// explicit, understandable, revocable consent. mode "preview" returns the
// exact summary the customer must see (amounts, data sources, what Guardian
// may do, auto-pause conditions, whether it's only a shadow simulation,
// reversibility). mode "confirm" (with the same branchId + monthlyAmount)
// writes the real commitment + guardian policy.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const domain = body.domain ?? "home";
  const mode = body.mode === "confirm" ? "confirm" : "preview";
  const monthlyAmount = Number(body.monthlyAmount);
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }

  const context = await loadDomainContext(userId, domain);
  if (!context.realityPlanData || !context.adapter) {
    return Response.json({ error: "no_reality_path" }, { status: 409 });
  }
  const plan = await ensurePlan(userId, domain, context);
  const branch = body.branchId ? await planStore.getBranch(body.branchId, userId) : null;

  // Real pin check against this seal's numbers.
  const pins = await planStore.getApplicableConstraints(userId, { planId: plan.id, domain });
  const projector = context.adapter.projector(branch?.data ?? context.realityPlanData);
  const projectedMonths = projector(monthlyAmount);
  const priorMonths = projector(context.realityPlanData.monthly_contribution || 0);
  const delayMonths = projectedMonths != null && priorMonths != null ? projectedMonths - priorMonths : null;
  const metrics = context.adapter.constraintMetrics(branch?.data ?? context.realityPlanData, null, {
    emergencyBufferMonths: context.emergencyBufferMonths,
    proposedMonthly: monthlyAmount,
    delayMonths: delayMonths == null ? null : Math.max(0, delayMonths),
    guardianAutoMove: false,
  });
  const constraintCheck = checkConstraints(pins, metrics);

  // A plan whose budget does not cover its core cost cannot be Sealed - it
  // stays in Exploring / Needs Changes until the customer cuts guests,
  // changes the venue, adjusts items, or raises the budget.
  const sealFeasibility = context.adapter.feasibility(branch?.data ?? context.realityPlanData);
  const budgetBelowCore = sealFeasibility?.sealable === false;

  const readyMonth = (() => {
    if (projectedMonths == null) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + projectedMonths);
    return d.toISOString().slice(0, 7);
  })();

  const preview = buildSealPreview({
    branch: branch ?? { label: "reality path", feasibility: context.adapter.feasibility(context.realityPlanData) },
    planDomain: domain,
    monthlyAmount,
    effectiveMonth: nextMonthKey(),
    readyMonth,
    constraintCheck,
    guardianCapabilities: { moveMoney: false, reschedule: false, notify: true },
    autoPauseConditions: [{ kind: "emergency_floor_months", operator: "lt", value: EMERGENCY_FUND_MONTHS_TARGET }],
    isShadowOnly: true,
    reconfirmAfterDays: 180,
  });

  if (mode === "preview") {
    return Response.json({
      preview: {
        ...preview,
        sealable: !budgetBelowCore && constraintCheck.ok,
        budgetGap: sealFeasibility?.budgetGap ?? 0,
        unresolvedItems: sealFeasibility?.unresolvedItems ?? [],
      },
    });
  }

  // confirm --------------------------------------------------------------
  if (budgetBelowCore) {
    return Response.json(
      {
        error: "budget_below_core",
        budgetGap: sealFeasibility.budgetGap,
        computedCoreTotal: sealFeasibility.computedCoreTotal,
        userBudgetCeiling: sealFeasibility.userBudgetCeiling,
        unresolvedItems: sealFeasibility.unresolvedItems,
        preview,
      },
      { status: 422 },
    );
  }
  if (!constraintCheck.ok) {
    return Response.json({ error: "violates_pins", violations: constraintCheck.violations, preview }, { status: 422 });
  }
  const amountCheck = validateCommitmentAmount({
    monthlyContribution: monthlyAmount,
    sliderMin: 0,
    sliderMax: Number.POSITIVE_INFINITY,
    availableMonthlyCashflow: context.availableMonthlyCashflow,
  });
  if (!amountCheck.ok) {
    return Response.json({ error: amountCheck.error, availableMonthlyCashflow: context.availableMonthlyCashflow }, { status: 422 });
  }

  const effectiveMonth = nextMonthKey();

  // Part 0.1: allocation + Seal are ONE atomic operation. The client sends
  // the allocation, its explicit target goal and an idempotency key with
  // the confirm request - not as a separate /allocate call.
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 120) : null;
  const existing = await findSealByIdempotencyKey(userId, idempotencyKey);
  if (existing) {
    return Response.json({ commitment: existing, preview, idempotent: true });
  }

  // Allowed allocation targets = the customer's real active goal domains + emergency.
  const { rows: planRows } = await query(`select distinct domain from plans where profile_key = $1`, [userId]);
  const allowedTargets = resolveAllowedTargets(planRows.map((r) => r.domain));

  const allocationInput = body.allocation ?? branch?.data?.allocation ?? null;
  const targetInput = body.allocationTargetGoalId ?? branch?.data?.allocationGoalId ?? null;
  const allocCheck = validateSealAllocation({
    allocation: allocationInput,
    allocationTargetGoalId: targetInput,
    freedCashflow: Number(body.freedCashflow) || 0,
    addedPressure: Number(body.addedPressure) || 0,
    allowedTargets,
  });
  if (!allocCheck.ok) {
    return Response.json({ error: allocCheck.error, allowedTargets: allocCheck.allowedTargets ?? allowedTargets }, { status: 422 });
  }

  let sealResult;
  try {
    sealResult = await sealAtomic({
      profileKey: userId,
      domain,
      planId: plan.id,
      branchId: branch?.id ?? null,
      branchData: branch?.data ?? null,
      monthlyAmount,
      effectiveMonth,
      readyMonth,
      delayMonths,
      priorMonthlyContribution: context.realityPlanData.monthly_contribution || 0,
      supersededSavingsPlan: context.confirmedSavingsPlan,
      emergencyFloorMonths: EMERGENCY_FUND_MONTHS_TARGET,
      allocation: allocCheck.allocation,
      targetGoalId: allocCheck.targetGoalId,
      sealPreview: preview,
      idempotencyKey,
    });
  } catch (error) {
    if (error?.code === "ACTIVE_COMMITMENT_EXISTS") {
      return Response.json({ error: "active_commitment_exists" }, { status: 409 });
    }
    if (error?.code === "BRANCH_NOT_FOUND" || error?.code === "BRANCH_PLAN_MISMATCH") {
      return Response.json({ error: error.code.toLowerCase() }, { status: 409 });
    }
    throw error;
  }

  // Downstream cache sync (confirmed_savings_plan artifact) - NOT part of
  // the atomic core: it is a revocable projection Strategic Balance reads,
  // and a failure here must not undo a real sealed commitment.
  const domainStore = domain === "wedding" ? weddingStore : domain === "home" ? homeStore : null;
  if (domainStore) {
    try {
      const session = await domainStore.getOrCreateSession(userId);
      await domainStore.saveArtifact(
        session.id,
        "stage2",
        "confirmed_savings_plan",
        buildAdjustedSavingsPlanPayload({
          priorPlan: context.confirmedSavingsPlan,
          monthlyContribution: monthlyAmount,
          effectiveMonth,
          readyMonth,
          notes: "Sealed from the Life Thread.",
        }),
      );
      await domainStore.updateSessionStatus(session.id, { stage2Status: "confirmed" });
    } catch (error) {
      console.error("[seal] downstream artifact sync failed (commitment already sealed):", error?.message);
    }
  }

  return Response.json({
    commitment: sealResult.commitment,
    allocation: sealResult.allocation,
    allocationTargetGoalId: sealResult.targetGoalId,
    preview,
    ledgerEventIds: sealResult.ledgerEventIds,
  });
}
