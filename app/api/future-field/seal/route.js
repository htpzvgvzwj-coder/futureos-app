import { getCurrentUserId } from "../../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../../lib/future-field/service.js";
import {
  planStore,
  buildSealPreview,
  checkConstraints,
  validateCommitmentAmount,
  buildAdjustedSavingsPlanPayload,
} from "../../../../lib/plan-runtime/index.js";
import { createCommitment } from "../../../../lib/goal-commitment-store.js";
import * as homeStore from "../../../../lib/home-store.js";
import * as weddingStore from "../../../../lib/wedding-store.js";
import { EMERGENCY_FUND_MONTHS_TARGET } from "../../../../lib/investment-readiness-finance.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { buildBranchSealedEvent } from "../../../../lib/change-ledger/producers/future-field.js";
import { buildHomeCommitmentCreatedEvent } from "../../../../lib/change-ledger/producers/home.js";
import { buildSavingsPlanConfirmedEvent } from "../../../../lib/change-ledger/producers/goal-plan.js";

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
  // The customer's allocation of any freed cashflow travels WITH the seal.
  // Guardian only ever tracks legs the customer explicitly set; an
  // unallocated remainder is never quietly pushed into another goal.
  const sealAllocation = branch?.data?.allocation ?? null;
  const sealAllocationGoalId = branch?.data?.allocationGoalId ?? "home";
  let commitment;
  try {
    commitment = await createCommitment(userId, {
      domain,
      monthlyContribution: monthlyAmount,
      effectiveMonth,
      pauseIfEmergencyMonthsBelow: EMERGENCY_FUND_MONTHS_TARGET,
      sourceMoment: {
        source: "future_field_seal",
        branchId: branch?.id ?? null,
        delayMonths,
        allocation: sealAllocation,
        allocationGoalId: sealAllocationGoalId,
      },
      supersededSavingsPlan: context.confirmedSavingsPlan,
      priorMonthlyContribution: context.realityPlanData.monthly_contribution || 0,
      planId: plan.id,
      planBranchId: branch?.id ?? null,
    });
  } catch (error) {
    if (error?.code === "ACTIVE_COMMITMENT_EXISTS") {
      return Response.json({ error: "active_commitment_exists" }, { status: 409 });
    }
    throw error;
  }

  await planStore.upsertGuardianPolicy(userId, {
    planId: plan.id,
    commitmentId: commitment.id,
    canMoveMoney: false, // no real bank-transfer integration exists
    canReschedule: false,
    canNotify: true,
    // pause_conditions is the only structured jsonb on guardian_policies -
    // the confirmed allocation legs ride along here so Guardian tracks
    // exactly what the customer set (never the flexible / unallocated
    // remainder). The commitment's source_moment.allocation is the
    // canonical copy.
    pauseConditions: [
      { kind: "emergency_floor_months", operator: "lt", value: EMERGENCY_FUND_MONTHS_TARGET },
      ...(sealAllocation
        ? [
            {
              kind: "tracked_allocation",
              goalId: sealAllocationGoalId,
              goalMonthly: Number(sealAllocation.goalMonthly) || 0,
              emergencyMonthly: Number(sealAllocation.emergencyMonthly) || 0,
            },
          ]
        : []),
    ],
    reconfirmAfterDays: 180,
  });

  // Keep the confirmed_savings_plan artifact in sync for downstream
  // consumers (Strategic Balance, cross-goal), exactly like the Moment-
  // driven route. Same shape for home and wedding.
  const domainStore = domain === "wedding" ? weddingStore : domain === "home" ? homeStore : null;
  if (domainStore) {
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
        notes: "Sealed from Future Field.",
      }),
    );
    await domainStore.updateSessionStatus(session.id, { stage2Status: "confirmed" });
  }

  if (branch) {
    await planStore.updateBranch(branch.id, userId, { status: "sealed", sealedCommitmentId: commitment.id });
  }
  await planStore.transitionPlan(plan.id, userId, "scheduled", "user").catch(() => {});

  const sealedLedger = await recordEventSafe(
    buildBranchSealedEvent({ profileKey: userId, domain, planId: plan.id, branchId: branch?.id ?? null, monthlyAmount, sealPreview: preview }),
  );
  const commitmentLedger = await recordEventSafe(
    domain === "home"
      ? buildHomeCommitmentCreatedEvent({
          profileKey: userId,
          commitmentId: commitment.id,
          priorMonthlyContribution: context.realityPlanData.monthly_contribution || 0,
          newMonthlyContribution: monthlyAmount,
          effectiveMonth,
          readyMonthBefore: null,
          readyMonthAfter: readyMonth,
          monthsDelta: delayMonths,
          reasonCode: "future_field_seal",
          reasonParams: {},
          emergencyFloorMonths: EMERGENCY_FUND_MONTHS_TARGET,
        })
      : buildSavingsPlanConfirmedEvent({
          profileKey: userId,
          domain,
          monthlyContribution: monthlyAmount,
          priorMonthlyContribution: context.realityPlanData.monthly_contribution || 0,
          targetCompleteMonth: readyMonth,
        }),
  );

  return Response.json({
    commitment,
    preview,
    ledgerEventIds: [sealedLedger?.event?.id ?? null, commitmentLedger?.event?.id ?? null].filter(Boolean),
  });
}
