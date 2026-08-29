import { getCurrentUserId } from "../../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../../lib/future-field/service.js";
import { planStore, peelBranch, compareBranches, mergeBranches } from "../../../../lib/plan-runtime/index.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { buildBranchCreatedEvent, buildBranchMergedEvent } from "../../../../lib/change-ledger/producers/future-field.js";

export const runtime = "nodejs";

const ALLOWED_OVERRIDES = {
  home: new Set(["estimated_price", "target_complete_month", "monthly_contribution", "property_type", "down_payment_needed"]),
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
  const branch = await planStore.createBranch(plan.id, userId, {
    label,
    baseVersion: currentVersion?.version ?? "0",
    data: peeled.data,
    delta: peeled.delta,
    feasibility: peeled.feasibility,
  });
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

  return Response.json({
    branch: { id: branch.id, label, delta: peeled.delta, feasibility: peeled.feasibility, projectedImpacts },
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
