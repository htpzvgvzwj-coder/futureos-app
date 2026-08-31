import { getCurrentUserId } from "../../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../../lib/future-field/service.js";
import { planStore, peelBranch, compareBranches, mergeBranches } from "../../../../lib/plan-runtime/index.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import {
  buildBranchCreatedEvent,
  buildBranchMergedEvent,
  buildAllocationSetEvent,
} from "../../../../lib/change-ledger/producers/future-field.js";
import { validateAllocation } from "../../../../lib/living-plan/allocation.js";

export const runtime = "nodejs";

const ALLOWED_OVERRIDES = {
  home: new Set([
    "estimated_price",
    "target_complete_month",
    "monthly_contribution",
    "property_type",
    "down_payment_needed",
    "down_payment_ratio",
    "loan_tenure",
    "rate_assumption",
    "renovation_reserve",
    "keep_emergency_months",
    "partner_contribution",
  ]),
  wedding: new Set([
    "wedding_date",
    "guest_count",
    "venue_tier",
    "venue_type",
    "photography_tier",
    "attire_tier",
    "total_budget",
    "monthly_contribution",
    "partner_contribution",
  ]),
  emergency: new Set(["target_months", "floor_months", "monthly_contribution", "protected_commitments", "essential_share", "fund_goals_anyway"]),
  loan: new Set(["extra_repayment", "monthly_installment", "one_off_payment", "target_debt", "breathing_room_floor", "repayment_strategy", "excluded_debt_ids"]),
  retirement: new Set(["monthly_contribution", "target_monthly_income", "future_day", "future_age", "inflation_assumption", "longevity_years", "real_return_assumption", "minimum_current_breathing_room"]),
  travel: new Set(["travellers", "nights", "comfort_tier", "destination_type", "trip_month", "total_budget", "monthly_contribution", "latest_trip_month", "minimum_current_breathing_room"]),
  investment: new Set(["monthly_commitment", "target_pool", "horizon_years", "jobs", "liquidity_gate_years", "real_return_assumption"]),
  insurance: new Set(["monthly_premium_now", "income_protection_months", "existing_income_protection", "existing_life_cover", "existing_ci_cover", "home_loan_outstanding", "dependents", "desired_cover", "minimum_current_breathing_room", "minimum_income_protection_months"]),
  family: new Set(["shared_monthly_contribution", "partner_share_ratio", "minimum_current_breathing_room"]),
};

// Peel: create a possible future off the reality path. Also handles
// ?action=compare and ?action=merge on the same resource.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "peel";
  const domain = url.searchParams.get("domain") ?? "home";
  const body = await request.json();

  const context = await loadDomainContext(userId, domain);
  if (!context.realityPlanData || !context.adapter) {
    return Response.json({ error: "no_reality_path" }, { status: 409 });
  }
  const plan = await ensurePlan(userId, domain, context);
  const currentVersion = await planStore.getCurrentPlanVersion(plan.id);
  const baseData = currentVersion?.data ?? context.realityPlanData;

  if (action === "compare") {
    const branches = await planStore.listBranches(plan.id);
    const table = compareBranches(
      [{ label: "reality", data: baseData, feasibility: context.adapter.feasibility(baseData) }, ...branches.map((b) => ({ label: b.label, data: b.data, feasibility: b.feasibility }))],
      {
        price: (d) => d.estimated_price ?? null,
        monthly: (_d, f) => f?.monthly_installment ?? null,
        withinAffordability: (_d, f) => (f?.within_affordability == null ? null : f.within_affordability ? 1 : 0),
      },
    );
    return Response.json({ compare: table });
  }

  // Allocate a freed amount across { goal, emergency, flexible }. Updates
  // the branch's own data.allocation, records it to the Change Ledger, and
  // returns the recomputed projection so the field can move.
  if (action === "allocate") {
    const branch = await planStore.getBranch(body.branchId, userId);
    if (!branch) return Response.json({ error: "branch_not_found" }, { status: 404 });

    const projBefore = context.adapter.projectImpacts(branch.data, context.realityPlanData, context.projectionContext ?? {}, null);
    // Living Thread: every Studio adapter now emits the shared
    // Studio-Contract impactSet (resourceDelta.freedMonthly). Fall back to
    // the legacy monthly-shift field for any adapter not yet aligned.
    const freed = projBefore?.resourceDelta?.freedMonthly ?? projBefore?.freedCashflow ?? 0;
    const check = validateAllocation({ freedCashflow: freed, allocation: body.allocation });
    if (!check.ok) {
      return Response.json({ error: check.error, freedCashflow: freed }, { status: 422 });
    }

    const nextData = { ...branch.data, allocation: check.allocation, allocationGoalId: body.goalId ?? "home" };
    await planStore.updateBranch(body.branchId, userId, { data: nextData });
    const projAfter = context.adapter.projectImpacts(nextData, context.realityPlanData, context.projectionContext ?? {}, check.allocation);

    const ledger = await recordEventSafe(
      buildAllocationSetEvent({
        profileKey: userId,
        domain,
        planId: plan.id,
        branchId: body.branchId,
        freedCashflow: freed,
        allocation: check.allocation,
        allocatedImpact: projAfter?.allocatedImpact ?? null,
      }),
    );

    return Response.json({
      branch: { id: branch.id, label: branch.label, allocation: check.allocation, projectedImpacts: projAfter },
      unallocated: check.unallocated,
      ledgerEventId: ledger?.event?.id ?? null,
    });
  }

  // Undo a possible future - the branch is kept in history as `discarded`,
  // never hard-deleted (the Change Ledger causal chain stays intact).
  if (action === "discard") {
    const branch = await planStore.getBranch(body.branchId, userId);
    if (!branch) return Response.json({ error: "branch_not_found" }, { status: 404 });
    await planStore.updateBranch(body.branchId, userId, { status: "discarded" });
    return Response.json({ ok: true, branchId: body.branchId, status: "discarded" });
  }

  // Make ONE branch the active moment. Exactly one branch per plan may be
  // `active`; every other open branch is an `alternative` (compare only,
  // it does not drive the global Life Thread). Passing branchId: null
  // deactivates all -> the moment falls back to `reality`.
  if (action === "activate") {
    try {
      const res = await planStore.setActiveBranchAtomic(plan.id, body.branchId ?? null, userId);
      return Response.json({ ok: true, activeBranchId: res.activeBranchId });
    } catch (error) {
      if (error?.code === "23505") {
        return Response.json({ error: "activation_conflict", hint: "another activate won the race - re-read the branches" }, { status: 409 });
      }
      if (error?.code === "BRANCH_NOT_FOUND") return Response.json({ error: "branch_not_found" }, { status: 404 });
      if (error?.code === "BRANCH_PLAN_MISMATCH") return Response.json({ error: "branch_plan_mismatch" }, { status: 409 });
      if (error?.code === "BRANCH_NOT_ACTIVATABLE") return Response.json({ error: "branch_not_activatable", status: error.branchStatus }, { status: 409 });
      throw error;
    }
  }

  if (action === "merge") {
    const { branchIdA, branchIdB, pickMap } = body;
    const [a, b] = await Promise.all([planStore.getBranch(branchIdA, userId), planStore.getBranch(branchIdB, userId)]);
    if (!a || !b) return Response.json({ error: "branch_not_found" }, { status: 404 });
    const mergedData = mergeBranches({ data: a.data }, { data: b.data }, pickMap ?? {});
    const feasibility = context.adapter.feasibility(mergedData);
    const version = await planStore.appendPlanVersion(plan.id, userId, {
      patch: mergedData,
      cause: { trigger: "future_field_merge", fromBranchIds: [branchIdA, branchIdB], pickMap: pickMap ?? {} },
      actor: "user",
    });
    await planStore.updateBranch(branchIdA, userId, { status: "merged" });
    await planStore.updateBranch(branchIdB, userId, { status: "merged" });
    const ledger = await recordEventSafe(
      buildBranchMergedEvent({ profileKey: userId, domain, planId: plan.id, fromBranchIds: [branchIdA, branchIdB], resultVersion: version.version, pickMap: pickMap ?? {} }),
    );
    return Response.json({ mergedVersion: version.version, data: mergedData, feasibility, ledgerEventId: ledger?.event?.id ?? null });
  }

  // peel
  const allowed = ALLOWED_OVERRIDES[domain] ?? ALLOWED_OVERRIDES.home;
  const overrides = {};
  for (const [k, v] of Object.entries(body.overrides ?? {})) {
    if (allowed.has(k)) overrides[k] = v;
  }
  if (Object.keys(overrides).length === 0) {
    return Response.json({ error: "no_valid_overrides", allowed: [...allowed] }, { status: 422 });
  }
  const label = String(body.label ?? "").slice(0, 80) || "Possible future";

  const peeled = peelBranch({ baseData, overrides, feasibilityFn: (data) => context.adapter.feasibility(data) });
  // A freshly peeled branch is the one the customer is now experiencing:
  // demote any prior active branch AND insert this one active, in ONE
  // transaction, so there is never a window with two active branches.
  let branch;
  try {
    branch = await planStore.createActiveBranchAtomic(plan.id, userId, {
      label,
      baseVersion: currentVersion?.version ?? "0",
      data: peeled.data,
      delta: peeled.delta,
      feasibility: peeled.feasibility,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return Response.json({ error: "activation_conflict", hint: "a concurrent peel won the race - re-read the branches" }, { status: 409 });
    }
    throw error;
  }
  const ledger = await recordEventSafe(
    buildBranchCreatedEvent({
      profileKey: userId,
      domain,
      planId: plan.id,
      branchId: branch.id,
      label,
      baseVersion: currentVersion?.version ?? "0",
      delta: peeled.delta,
      feasibility: peeled.feasibility,
    }),
  );

  // Real cross-goal projection for the branch just created - so the UI can
  // show "Home earlier / Emergency unchanged" immediately without a
  // full reload.
  const projectedImpacts =
    typeof context.adapter.projectImpacts === "function"
      ? context.adapter.projectImpacts(peeled.data, context.realityPlanData, context.projectionContext ?? {})
      : null;

  // Explicit sealability verdict (Part 0.4) - never "missing means true".
  const sealableVerdict =
    peeled.feasibility && typeof peeled.feasibility.sealable === "boolean"
      ? { sealable: peeled.feasibility.sealable, reason: peeled.feasibility.sealableReason ?? (peeled.feasibility.sealable ? "ok" : "blocked") }
      : { sealable: false, reason: "sealability_not_computed" };

  return Response.json({
    branch: { id: branch.id, label, delta: peeled.delta, feasibility: peeled.feasibility, sealableVerdict, projectedImpacts },
    ledgerEventId: ledger?.event?.id ?? null,
  });
}

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") ?? "home";
  const plan = await planStore.getPlan(userId, { domain, goalKey: domain });
  if (!plan) return Response.json({ branches: [] });
  const branches = await planStore.listBranches(plan.id, { includeWithdrawn: true });
  return Response.json({
    branches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, feasibility: b.feasibility })),
  });
}
