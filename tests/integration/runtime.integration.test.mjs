// Integration tests - exercise Plan Runtime, Future Field, and the Change
// Ledger against the REAL database, then clean up every row they create.
//
// Run: node --env-file=.env --test "tests/integration/**/*.test.mjs"
//   (npm run test:integration)
//
// If DATABASE_URL is not set these are skipped, not failed - a machine
// without DB access still runs the unit suite. They never touch a real
// user's data: append-only tables use a throwaway profile_key; the one
// Future Field case that needs a confirmed home plan runs against the
// pre-seeded fixture account and deletes only the plan-runtime rows it
// creates.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

// Lazy imports so a no-DB run doesn't even construct the pg pool.
async function mods() {
  const [store, clStore, clHome, fmt, ff, ffAdapters, ffService, db] = await Promise.all([
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/change-ledger/store.js"),
    import("../../lib/change-ledger/producers/home.js"),
    import("../../lib/change-ledger/format.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/future-field/adapters.js"),
    import("../../lib/future-field/service.js"),
    import("../../lib/db.js"),
  ]);
  return { store, clStore, clHome, fmt, ff, ffAdapters, ffService, pool: db.pool };
}

// The pre-seeded fixture account (karina@demo.futureos) - a normal-looking
// account with real confirmed plans, used only where a test needs one.
const FIXTURE_HOME_USER = "315b3838-54c8-4c5c-9000-7fd3cc28f499";

test("Plan Runtime: plan + immutable versions + branch + constraint survive a reload", opts, async (t) => {
  const { store, pool } = await mods();
  const pk = `itest-pr-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plan_constraints where profile_key = $1", [pk]);
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "home", goalKey: "home", title: "itest" });
  assert.ok(plan.id);
  assert.equal(plan.state, "draft");

  const v1 = await store.appendPlanVersion(plan.id, pk, { patch: { price: 500000 }, cause: { trigger: "seed" }, actor: "system" });
  assert.equal(v1.version, "1");
  const v2 = await store.appendPlanVersion(plan.id, pk, { patch: { price: 470000 }, cause: { trigger: "user_edit" }, actor: "user" });
  assert.equal(v2.version, "2");
  assert.equal(v2.supersedes_version, "1");

  // reload
  const reloadedPlan = await store.getPlanById(plan.id, pk);
  assert.equal(reloadedPlan.current_version, "2");
  const versions = await store.listPlanVersions(plan.id);
  assert.equal(versions.length, 2);
  assert.equal(Number(versions[1].data.price), 470000);
  assert.equal(Number(versions[0].data.price), 500000, "v1 snapshot is frozen, not rewritten");

  const branch = await store.createBranch(plan.id, pk, { label: "cheaper", baseVersion: "2", data: { price: 420000 }, delta: { changedKeys: ["price"] }, feasibility: {} });
  assert.ok(branch.id);
  const branchesReloaded = await store.listBranches(plan.id);
  assert.equal(branchesReloaded.length, 1);
  assert.equal(branchesReloaded[0].label, "cheaper");

  const pin = await store.setConstraint(pk, { planId: plan.id, kind: "emergency_floor_months", operator: "gte", value: 6, scope: "domain" });
  assert.ok(pin.id);
  const applicable = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "home" });
  assert.ok(applicable.some((c) => c.id === pin.id), "constraint reloads and applies");

  // setting the same kind again replaces (releases) the old one, keeps history
  await store.setConstraint(pk, { planId: plan.id, kind: "emergency_floor_months", operator: "gte", value: 3, scope: "domain" });
  const afterReplace = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "home" });
  const active = afterReplace.filter((c) => c.kind === "emergency_floor_months");
  assert.equal(active.length, 1, "only one active emergency_floor pin");
  assert.equal(Number(active[0].value), 3);
});

test("Plan Runtime: state machine transitions are enforced on the real row", opts, async (t) => {
  const { store, pool } = await mods();
  const pk = `itest-sm-${Date.now()}`;
  t.after(async () => {
    await pool.query("delete from plan_versions where profile_key = $1", [pk]);
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "home", goalKey: "home" });
  const scheduled = await store.transitionPlan(plan.id, pk, "scheduled", "user").catch((e) => e);
  // draft -> proposed -> scheduled is the legal path; draft -> scheduled is not
  assert.ok(scheduled instanceof Error && scheduled.code === "ILLEGAL_TRANSITION");
  await store.transitionPlan(plan.id, pk, "proposed", "user");
  const ok = await store.transitionPlan(plan.id, pk, "scheduled", "user");
  assert.equal(ok.state, "scheduled");
  const byPartner = await store.transitionPlan(plan.id, pk, "revoked", "partner").catch((e) => e);
  assert.ok(byPartner instanceof Error && byPartner.code === "ACTOR_NOT_PERMITTED", "partner cannot revoke a scheduled plan");
});

test("Change Ledger: write -> list -> replay chain -> idempotency -> shared redaction (real DB)", opts, async (t) => {
  const { clStore, clHome, fmt, pool } = await mods();
  const pk = `itest-cl-${Date.now()}`;
  const commitId = crypto.randomUUID();
  t.after(async () => {
    await pool.query("delete from change_ledger_events where profile_key = $1", [pk]);
  });

  const createDraft = clHome.buildHomeCommitmentCreatedEvent({
    profileKey: pk, commitmentId: commitId,
    priorMonthlyContribution: 800, newMonthlyContribution: 1250,
    effectiveMonth: "2026-10", readyMonthBefore: "2032-01", readyMonthAfter: "2030-09",
    monthsDelta: -16, reasonCode: "behind_pace", reasonParams: {}, emergencyFloorMonths: 6,
  });
  const r1 = await clStore.recordEvent(createDraft);
  const r1dup = await clStore.recordEvent(createDraft);
  assert.equal(r1dup.duplicate, true, "same dedupe_key does not create a 2nd row");
  assert.equal(r1dup.event.id, r1.event.id);

  const revoke = clHome.buildHomeCommitmentRevokedEvent({
    profileKey: pk, commitmentId: commitId, supersedesEventId: r1.event.id,
    restoredMonthlyContribution: 800, adjustedMonthlyContribution: 1250,
  });
  const r2 = await clStore.recordEvent(revoke);
  assert.equal(r2.event.supersedes_event_id, r1.event.id);

  // shared visibility redacts the other party's raw finances
  const shared = await clStore.recordEvent({
    profileKey: pk, actor: "user", sourceFeature: "wedding", actionType: "joint_confirmed", status: "scheduled",
    visibility: "shared", relatedGoalIds: ["wedding"], cause: { trigger: "itest" },
    beforeSnapshot: { monthlyIncome: 9000, jointMonthlyContribution: 900 },
    afterSnapshot: { jointMonthlyContribution: 1100 },
    impactSet: [{ goalId: "wedding", metric: "monthlyContribution", before: 900, after: 1100, delta: 200, unit: "sgd_per_month" }],
    confidence: "high", messageKey: "changeLedger.event.savings_plan_confirmed.headline", messageParams: { domain: "wedding", amount: 1100 },
    dedupeKey: `${pk}:shared`,
  });
  const storedShared = await clStore.getEvent(shared.event.id, pk);
  assert.equal(storedShared.before_snapshot.monthlyIncome, "[redacted]");
  assert.equal(storedShared.before_snapshot.jointMonthlyContribution, 900);

  const all = await clStore.listEvents(pk, { filter: "all" });
  assert.equal(all.length, 3);
  const mine = await clStore.listEvents(pk, { filter: "mine" });
  assert.ok(mine.every((e) => e.actor === "user"));

  // replay chain: create is superseded by revoke
  const recent = await clStore.listEvents(pk, { filter: "all", limit: 100 });
  const supersededBy = recent.find((e) => e.supersedes_event_id === r1.event.id);
  assert.equal(supersededBy.id, r2.event.id);

  const t2 = (k) => k; // formatter smoke - resolves without throwing
  const view = fmt.formatEvent(await clStore.getEvent(r1.event.id, pk), (key, p) => {
    if (key === "changeLedger.event.commitment_created.headline") return `set {amount}/mo from {month}`.replace("{amount}", p.amount).replace("{month}", p.month);
    return key;
  });
  assert.ok(view.headline.includes("1250"));
  assert.equal(view.isActual, false, "scheduled is not an actual state");
  void t2;
});

test("Future Field: peel a real branch off the fixture home plan, reload it, then Bend solves a real monthly amount", opts, async (t) => {
  const { ff, ffService, ffAdapters, store, pool } = await mods();
  const ctx = await ffService.loadDomainContext(FIXTURE_HOME_USER, "home");
  if (!ctx.realityPlanData) {
    t.skip("fixture account has no confirmed home plan");
    return;
  }
  const plan = await ffService.ensurePlan(FIXTURE_HOME_USER, "home", ctx);
  t.after(async () => {
    await pool.query("delete from plan_branches where plan_id = $1", [plan.id]);
    await pool.query("delete from plan_constraints where plan_id = $1", [plan.id]);
    await pool.query("delete from plan_versions where plan_id = $1", [plan.id]);
    await pool.query("delete from plans where id = $1", [plan.id]);
  });

  const adapter = ffAdapters.getFutureFieldAdapter("home");
  const feas = adapter.feasibility(ctx.realityPlanData);
  assert.ok(feas.available && feas.monthly_installment > 0, "real MAS/IRAS feasibility");

  const cheaperPrice = Math.round(ctx.realityPlanData.estimated_price * 0.85);
  const peeled = ff.peelBranch({
    baseData: ctx.realityPlanData,
    overrides: { estimated_price: cheaperPrice },
    feasibilityFn: (d) => adapter.feasibility(d),
  });
  assert.deepEqual(peeled.delta.changedKeys, ["estimated_price"]);
  assert.ok(peeled.feasibility.monthly_installment < feas.monthly_installment, "cheaper flat -> lower installment");

  const branch = await store.createBranch(plan.id, FIXTURE_HOME_USER, {
    label: "itest cheaper flat", baseVersion: "1", data: peeled.data, delta: peeled.delta, feasibility: peeled.feasibility,
  });
  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === branch.id), "branch persists and reloads");

  // Bend: solve the monthly amount to hit a sooner date
  const projector = adapter.projector(ctx.realityPlanData);
  const currentMonths = projector(ctx.realityPlanData.monthly_contribution || 500);
  const target = Math.max(6, Math.round((currentMonths ?? 60) * 0.6));
  const solved = ff.solveMonthlyForTargetMonths({
    targetMonths: target, projectMonthsFn: projector, highAmount: Math.max(20000, (ctx.availableMonthlyCashflow ?? 5000) * 3),
  });
  assert.ok(solved.achievable === false || (solved.amount > 0 && solved.projectedMonths <= target), JSON.stringify(solved));
});

test("Cross-goal: a Wedding-sized monthly commitment is visible against the fixture's whole picture", opts, async () => {
  const { pool } = await mods();
  const { getCrossGoalSnapshot } = await import("../../lib/cross-goal-context.js");
  const snap = await getCrossGoalSnapshot(FIXTURE_HOME_USER);
  assert.ok(typeof snap.committedMonthlyTotal === "number", "real committed monthly total is computed");
  assert.ok(Array.isArray(snap.loans) && Array.isArray(snap.investments));
  void pool;
});

test("Wedding Living Plan: 150->~90 guests recomputes wedding + Home + Emergency, persists, Seals into a commitment, revokes back", opts, async (t) => {
  const { ffService, ffAdapters, store, ff, pool } = await mods();
  const { computeWeddingPlanFinance } = await import("../../lib/wedding/plan-finance.js");
  const { projectWeddingBranchImpact } = await import("../../lib/wedding/cross-goal-projection.js");
  const gcStore = await import("../../lib/goal-commitment-store.js");

  const ctx = await ffService.loadDomainContext(FIXTURE_HOME_USER, "wedding");
  if (!ctx.realityPlanData) {
    t.skip("fixture account has no confirmed wedding budget");
    return;
  }
  const nodeIds = (ctx.crossGoalNodes ?? []).map((n) => n.goalId);
  assert.ok(nodeIds.includes("emergency"), "emergency fund node present on the wedding field");

  const plan = await ffService.ensurePlan(FIXTURE_HOME_USER, "wedding", ctx);
  let commitmentId = null;
  t.after(async () => {
    if (commitmentId) await pool.query("delete from goal_commitments where id = $1", [commitmentId]);
    await pool.query("delete from plan_branches where plan_id = $1", [plan.id]);
    await pool.query("delete from plan_constraints where plan_id = $1", [plan.id]);
    await pool.query("delete from plan_versions where plan_id = $1", [plan.id]);
    await pool.query("delete from plans where id = $1", [plan.id]);
  });

  const adapter = ffAdapters.getFutureFieldAdapter("wedding");

  // --- baseline: record the reality numbers -------------------------
  const realityFin = computeWeddingPlanFinance({ planData: ctx.realityPlanData });
  assert.ok(realityFin.available && realityFin.computedCoreTotal > 0, "real banquet math");
  const homeReadyBefore = ctx.crossGoalNodes.find((n) => n.goalId === "home")?.readyMonth ?? null;
  const emergencyBefore = ctx.crossGoalNodes.find((n) => n.goalId === "emergency")?.bufferMonths ?? null;

  // --- Peel to ~90 guests -----------------------------------------
  const fewer = Math.max(20, Math.round(Number(ctx.realityPlanData.guest_count) * 0.6));
  const peeled = ff.peelBranch({
    baseData: ctx.realityPlanData,
    overrides: { guest_count: fewer },
    feasibilityFn: (d) => adapter.feasibility(d),
  });
  assert.ok(peeled.feasibility.computedCoreTotal < realityFin.computedCoreTotal, "wedding total DOWN");
  assert.ok(peeled.feasibility.userRequiredMonthly <= realityFin.userRequiredMonthly, "personal required monthly DOWN or equal");

  // Project against a controlled savings figure so fewer guests
  // deterministically frees a positive amount (the fixture account's real
  // savings may already cover the whole wedding, which is a valid but
  // uninteresting "neutral" case for this assertion).
  // total_budget=null so the plan total tracks the computed core cost
  // (a fixed ceiling above core would mean fewer guests frees nothing -
  // itself correct, but not what this assertion is about).
  const realityData = { ...ctx.realityPlanData, current_savings: 8000, total_budget: null };
  const branchData = { ...peeled.data, current_savings: 8000, total_budget: null };
  const realityFinCtl = computeWeddingPlanFinance({ planData: realityData });

  // No allocation yet -> the freed money is Available, nothing moved.
  const noAlloc = projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: branchData }),
    realityFinance: realityFinCtl,
    context: ctx.projectionContext,
  });
  assert.equal(noAlloc.mode, "freed", "fewer guests frees cashflow");
  assert.ok(noAlloc.freedCashflow > 0);
  assert.equal(noAlloc.allocatedImpact, null, "NO allocation -> Home is NOT auto-accelerated");
  assert.equal(noAlloc.emergency.direction, "flat", "NO allocation -> Emergency unchanged");
  assert.ok(noAlloc.availableImpact.maxHomeMonthsEarlier >= 0, "shows what the freed money COULD do");

  // Allocate all of it to Home -> now (and only now) Home moves earlier.
  const toHome = { goalMonthly: noAlloc.freedCashflow, emergencyMonthly: 0, flexibleMonthly: 0 };
  const allocHome = projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: { ...branchData, allocation: toHome } }),
    realityFinance: realityFinCtl,
    context: ctx.projectionContext,
    allocation: toHome,
  });
  assert.ok(allocHome.allocatedImpact, "allocatedImpact appears once allocated");
  if (allocHome.allocatedImpact.home.monthsToReadyBefore != null) {
    assert.ok(allocHome.allocatedImpact.home.monthsDelta <= 0, "Home deposit the same or EARLIER");
  }
  assert.equal(allocHome.allocatedImpact.emergency.direction, "flat", "Emergency untouched by a home-only allocation");

  // Allocate all of it to Emergency -> buffer rises, Home unchanged.
  const toEmg = { goalMonthly: 0, emergencyMonthly: noAlloc.freedCashflow, flexibleMonthly: 0 };
  const allocEmg = projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: { ...branchData, allocation: toEmg } }),
    realityFinance: realityFinCtl,
    context: ctx.projectionContext,
    allocation: toEmg,
  });
  assert.ok(allocEmg.allocatedImpact.emergency.bufferAfter >= allocEmg.allocatedImpact.emergency.bufferBefore, "Emergency buffer does NOT fall");
  assert.equal(allocEmg.allocatedImpact.home?.monthsDelta ?? 0, 0, "Home unchanged by an emergency-only allocation");

  // --- persist the branch WITH its allocation, reload, projection stable
  const branch = await store.createBranch(plan.id, FIXTURE_HOME_USER, {
    label: "itest 90 guests", baseVersion: "1",
    data: { ...branchData, allocation: toHome, allocationGoalId: "home" },
    delta: peeled.delta, feasibility: peeled.feasibility,
  });
  const reloadedBranch = (await store.listBranches(plan.id)).find((b) => b.id === branch.id);
  assert.equal(Number(reloadedBranch.data.guest_count), fewer, "branch survives reload");
  assert.deepEqual(reloadedBranch.data.allocation, toHome, "allocation persists on the branch after reload");
  const impactAfterReload = projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: reloadedBranch.data }),
    realityFinance: realityFinCtl,
    context: ctx.projectionContext,
    allocation: reloadedBranch.data.allocation,
  });
  assert.deepEqual(impactAfterReload.wedding, allocHome.wedding, "projected wedding impact identical after reload");
  assert.deepEqual(impactAfterReload.allocatedImpact.home, allocHome.allocatedImpact.home, "projected home impact identical after reload");

  // --- Seal into a real commitment - the confirmed allocation rides along
  const sealAmount = peeled.feasibility.userRequiredMonthly || 500;
  const commitment = await gcStore.createCommitment(FIXTURE_HOME_USER, {
    domain: "wedding",
    monthlyContribution: sealAmount,
    effectiveMonth: new Date().toISOString().slice(0, 7),
    pauseIfEmergencyMonthsBelow: 6,
    sourceMoment: { source: "itest_future_field_seal", branchId: branch.id, allocation: reloadedBranch.data.allocation, allocationGoalId: "home" },
    supersededSavingsPlan: null,
    priorMonthlyContribution: ctx.realityPlanData.monthly_contribution || 0,
    planId: plan.id,
    planBranchId: branch.id,
  });
  commitmentId = commitment.id;
  assert.equal(commitment.status, "active");
  assert.deepEqual(commitment.source_moment.allocation, toHome, "Guardian's commitment carries the confirmed allocation");
  const activeAfterSeal = await gcStore.getActiveCommitment(FIXTURE_HOME_USER, "wedding");
  assert.equal(activeAfterSeal.id, commitment.id, "Seal is the active wedding commitment");

  // --- Revoke -> back to pre-Seal state -------------------------
  const revoked = await gcStore.revokeCommitment(commitment.id, FIXTURE_HOME_USER);
  assert.equal(revoked.status, "revoked");
  const activeAfterRevoke = await gcStore.getActiveCommitment(FIXTURE_HOME_USER, "wedding");
  assert.equal(activeAfterRevoke, null, "no active wedding commitment after revoke");

  void homeReadyBefore;
  void emergencyBefore;
});
