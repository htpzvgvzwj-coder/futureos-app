import { getCurrentUserId } from "../../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../../lib/future-field/service.js";
import {
  planStore,
  buildSealPreview,
  checkConstraints,
  validateCommitmentAmount,
  buildAdjustedSavingsPlanPayload,
} from "../../../../lib/plan-runtime/index.js";
import { sealAtomic, resolveAllowedTargets, findSealByIdempotencyKey } from "../../../../lib/plan-runtime/atomic-seal.js";
import { checkSealBranch, serverResourceDelta } from "../../../../lib/plan-runtime/seal-guards.js";
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

  // Server-authoritative Seal (causal-spine round): re-read the locked
  // branch + the current plan version from the DB and REFUSE a stale
  // branch instead of overwriting the newer plan.
  const currentVersionRow = await planStore.getCurrentPlanVersion(plan.id);
  const branchGuard = checkSealBranch({ branch, planId: plan.id, currentPlanVersion: currentVersionRow?.version ?? null });
  if (!branchGuard.ok) {
    return Response.json({ error: branchGuard.error, ...branchGuard.detail }, { status: branchGuard.status });
  }

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

  // Server-recomputed freed / added pressure from the locked branch - the
  // ONLY figures the Seal trusts (the client's are ignored entirely).
  const serverAllocationInput = body.allocation ?? branch?.data?.allocation ?? null;
  let serverDelta = { freedCashflow: 0, addedPressure: 0 };
  if (typeof context.adapter.projectImpacts === "function") {
    try {
      const srvImpact = context.adapter.projectImpacts(
        branch?.data ?? context.realityPlanData,
        context.realityPlanData,
        context.projectionContext ?? {},
        serverAllocationInput,
      );
      serverDelta = serverResourceDelta(srvImpact);
    } catch {
      serverDelta = { freedCashflow: 0, addedPressure: 0 };
    }
  }
  const serverFreed = serverDelta.freedCashflow;
  const serverAddedPressure = serverDelta.addedPressure;

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
        // server-computed - the client cannot influence these
        serverFreedCashflow: serverFreed,
        serverAddedPressure,
      },
    });
  }

  // confirm --------------------------------------------------------------
  // A confirm MUST carry an idempotency key (per user).
  const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim().slice(0, 120) : null;
  if (!idempotencyKey) {
    return Response.json({ error: "idempotency_key_required", hint: "resend confirm with a stable idempotencyKey" }, { status: 400 });
  }
  const existing = await findSealByIdempotencyKey(userId, idempotencyKey);
  if (existing) {
    return Response.json({ commitment: existing, preview, idempotent: true });
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
  const { rows: planRows } = await query(`select distinct domain from plans where profile_key = $1`, [userId]);
  const allowedTargets = resolveAllowedTargets(planRows.map((r) => r.domain));

  // The one authoritative recompute - runs INSIDE the transaction, on the
  // FOR-UPDATE-locked branch data. Never reads the client's numbers.
  const recompute = (lockedData, priorReality) => {
    const feasibility = context.adapter.feasibility(lockedData, context.projectionContext ?? {});
    const projFn = context.adapter.projector(lockedData);
    const pm = projFn(monthlyAmount);
    const pr = projFn(Number(priorReality?.monthly_contribution) || 0);
    const dMonths = pm != null && pr != null ? Math.max(0, pm - pr) : null;
    const metrics = context.adapter.constraintMetrics(lockedData, feasibility, {
      emergencyBufferMonths: context.emergencyBufferMonths,
      proposedMonthly: monthlyAmount,
      delayMonths: dMonths,
      guardianAutoMove: false,
    });
    const cc = checkConstraints(pins, metrics);
    let srv = { freedCashflow: 0, addedPressure: 0 };
    if (typeof context.adapter.projectImpacts === "function") {
      try {
        srv = serverResourceDelta(
          context.adapter.projectImpacts(lockedData, priorReality, context.projectionContext ?? {}, body.allocation ?? lockedData?.allocation ?? null),
        );
      } catch {
        srv = { freedCashflow: 0, addedPressure: 0 };
      }
    }
    return { feasibility, constraintCheck: cc, serverFreed: srv.freedCashflow, serverAddedPressure: srv.addedPressure };
  };

  let sealResult;
  try {
    sealResult = await sealAtomic({
      profileKey: userId,
      domain,
      planId: plan.id,
      branchId: branch?.id ?? null,
      monthlyAmount,
      effectiveMonth,
      readyMonth,
      delayMonths,
      priorMonthlyContribution: context.realityPlanData.monthly_contribution || 0,
      supersededSavingsPlan: context.confirmedSavingsPlan,
      emergencyFloorMonths: EMERGENCY_FUND_MONTHS_TARGET,
      allocationInput: body.allocation ?? branch?.data?.allocation ?? null,
      allocationTargetGoalId: body.allocationTargetGoalId ?? branch?.data?.allocationGoalId ?? null,
      allowedTargets,
      realityData: context.realityPlanData,
      recompute,
      sealPreview: preview,
      idempotencyKey,
    });
  } catch (error) {
    const c = error?.code;
    if (c === "STALE_BRANCH") {
      return Response.json({ error: "stale_branch", branchBaseVersion: error.branchBaseVersion, currentPlanVersion: error.currentPlanVersion }, { status: 409 });
    }
    if (c === "NOT_SEALABLE") {
      return Response.json({ error: "budget_below_core", reason: error.reason, budgetGap: error.budgetGap, preview }, { status: 422 });
    }
    if (c === "VIOLATES_PINS") {
      return Response.json({ error: "violates_pins", violations: error.violations, preview }, { status: 422 });
    }
    if (c === "BAD_ALLOCATION") {
      return Response.json({ error: error.allocationError ?? "bad_allocation", allowedTargets: error.allowedTargets ?? allowedTargets }, { status: 422 });
    }
    if (c === "SEAL_UNIQUE_VIOLATION" || c === "23505") {
      const dup = await findSealByIdempotencyKey(userId, idempotencyKey);
      if (dup) return Response.json({ commitment: dup, preview, idempotent: true }, { status: 200 });
      return Response.json({ error: "duplicate_seal" }, { status: 409 });
    }
    if (c === "BRANCH_NOT_FOUND" || c === "BRANCH_PLAN_MISMATCH") {
      return Response.json({ error: c.toLowerCase() }, { status: 409 });
    }
    if (c === "BRANCH_NOT_SEALABLE") {
      return Response.json({ error: "branch_not_sealable", branchStatus: error.branchStatus }, { status: 409 });
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
    // echo what the SERVER computed inside the transaction and sealed
    // against - never the client's numbers.
    serverComputed: sealResult.serverComputed,
  });
}
