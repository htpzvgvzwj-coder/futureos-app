// The canonical Life Thread.
//
// ONE server-owned, versioned snapshot that every top-level surface reads:
// Today, Life, Explore and Guardian. One customer action invalidates it and
// all four re-read the same new snapshot - no screen derives its main state
// from `preferences`, `simulatorInputs` or `sessionStorage` any more.
//
// Rule: defaultProfile / demo values are NEVER treated as confirmed
// customer facts. A field the customer has not actually provided is
// reported as `unknown`, not as a number.

import { createHash } from "node:crypto";
import { getPreferences } from "../preferences-store.js";
import { getExpenseHistory } from "../expense-store.js";
import { getIncomeHistory } from "../income-store.js";
import { computeSmoothedExpenses } from "../expense-finance.js";
import { computeSmoothedIncome } from "../income-finance.js";
import { resolveAssetPromptContext } from "../liquid-savings-context.js";
import { getCrossGoalSnapshot } from "../cross-goal-context.js";
import { listEvents } from "../change-ledger/store.js";
import { formatEvent } from "../change-ledger/format.js";
import { computePromiseWeight } from "../living-plan/promise-weight.js";
import { deriveTurningPoints } from "../living-plan/turning-point.js";
import { detectDecisionEchoes } from "../living-plan/decision-echo.js";
import { buildHandoffCandidate } from "../living-plan/future-handoff.js";
import { planStore } from "../plan-runtime/index.js";
import { query } from "../db.js";
import { collectStudioImpacts, enrichCrossGoalEdges } from "./cross-studio-impact.js";
import { buildCanonicalSnapshot } from "./canonical-snapshot.js";

const EMERGENCY_FLOOR_MONTHS = 6;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// A stated profile figure counts as KNOWN only when the customer has saved
// their profile (profileVersion present) and the figure is a real positive
// number. Everything else is unknown - never a default.
function knownProfile(raw) {
  const p = raw?.profile ?? null;
  const saved = raw != null && raw.profileVersion != null && p != null;
  return {
    saved,
    monthlyIncome: saved && num(p.statedMonthlyIncome) > 0 ? num(p.statedMonthlyIncome) : null,
    monthlyExpenses: saved && num(p.monthlyExpenses) > 0 ? num(p.monthlyExpenses) : null,
    currentSavings: saved && num(p.currentSavings) != null ? num(p.currentSavings) : null,
  };
}

function nodeState({ value, moving, waiting, known }) {
  if (waiting) return "waiting_decision";
  if (!known) return "unknown";
  if (moving) return "moving";
  return "calm";
}

export async function buildLifeThread(userId) {
  const [rawPrefs, expenseHistory, incomeHistory] = await Promise.all([
    getPreferences(userId),
    getExpenseHistory(userId),
    getIncomeHistory(userId),
  ]);
  const known = knownProfile(rawPrefs);

  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, known.monthlyExpenses ?? 0);
  const smoothedIncome = computeSmoothedIncome(incomeHistory, known.monthlyIncome ?? 0);
  // "effective" figures are only meaningful when we have a real basis
  // (saved profile OR logged history).
  const hasIncomeBasis = known.monthlyIncome != null || (incomeHistory ?? []).length > 0;
  const hasExpenseBasis = known.monthlyExpenses != null || (expenseHistory ?? []).length > 0;
  const monthlyIncome = hasIncomeBasis ? smoothedIncome.effectiveMonthlyIncome : null;
  const monthlyExpenses = hasExpenseBasis ? smoothedExpenses.effectiveMonthlyExpenses : null;

  const [asset, crossGoal, ledgerEvents, plans, commitRes] = await Promise.all([
    resolveAssetPromptContext(userId, known.currentSavings ?? 0, monthlyExpenses ?? 0, "flexible"),
    getCrossGoalSnapshot(userId),
    listEvents(userId, { filter: "all", limit: 60 }),
    planStore.listPlans(userId),
    query(
      `select id, domain, monthly_contribution, effective_month, status, plan_id, plan_branch_id, source_moment, created_at, revoked_at
       from goal_commitments where profile_key = $1 order by created_at desc limit 40`,
      [userId],
    ),
  ]);

  // A commitment lives in one of two places depending on how it was made:
  // the per-Studio confirmed_savings_plan (crossGoal) OR the goal_commitments
  // table (Guardian's collision paths, the demo seed). Count whichever is
  // larger so Life and Guardian never disagree on "promised to your future".
  const goalCommitmentsMonthly = commitRes.rows
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + (num(c.monthly_contribution) ?? 0), 0);
  const committedMonthlyTotal = Math.round(Math.max(crossGoal.committedMonthlyTotal || 0, goalCommitmentsMonthly));
  const availableMonthlyCashflow =
    monthlyIncome != null && monthlyExpenses != null ? Math.round(monthlyIncome - monthlyExpenses - committedMonthlyTotal) : null;

  // ---- commitments + active plans + active drafts (server plan data) ----
  const commitments = commitRes.rows.map((c) => ({
    id: c.id,
    domain: c.domain,
    monthlyContribution: num(c.monthly_contribution) ?? 0,
    effectiveMonth: c.effective_month,
    status: c.status,
    planId: c.plan_id,
    branchId: c.plan_branch_id,
  }));
  const activeCommitments = commitments.filter((c) => c.status === "active");

  const branchesByPlan = await Promise.all(
    plans.map(async (p) => ({ plan: p, branches: await planStore.listBranches(p.id) })),
  );
  const activePlans = branchesByPlan
    .filter(({ plan }) => ["scheduled", "active", "paused", "needs_approval"].includes(plan.state))
    .map(({ plan }) => {
      const c = activeCommitments.find((x) => x.planId === plan.id);
      return { domain: plan.domain, planId: plan.id, state: plan.state, monthlyContribution: c?.monthlyContribution ?? null, effectiveMonth: c?.effectiveMonth ?? null };
    });
  // A "draft" for display = any open OR active branch. Only the single
  // `active` branch actually drives the cross-goal impacts (see
  // collectStudioImpacts); the rest are alternatives (compare only).
  const activeDrafts = branchesByPlan.flatMap(({ plan, branches }) =>
    branches
      .filter((b) => b.status === "open" || b.status === "active")
      .map((b) => ({ domain: plan.domain, planId: plan.id, branchId: b.id, label: b.label, isActive: b.status === "active", updatedAt: b.updated_at, delta: b.delta ?? {} })),
  );

  // ---- promise weight + turning point + decision echoes -----------------
  const weighable = [
    ...activeCommitments.map((c) => ({ id: `commit:${c.id}`, domain: c.domain, label: c.domain, monthlyAmount: c.monthlyContribution })),
  ].filter((c) => c.monthlyAmount > 0);
  const promiseWeight = computePromiseWeight({
    commitments: weighable,
    context: { monthlyFreeCashflow: availableMonthlyCashflow ?? 0, emergencyFloorMonths: EMERGENCY_FLOOR_MONTHS, monthlyExpenses: monthlyExpenses ?? 0 },
  });
  const turningPoints = deriveTurningPoints({
    sources: {
      emergencyFloor: { bufferMonths: asset.emergencyBufferMonths, floorMonths: EMERGENCY_FLOOR_MONTHS },
      completions: [],
      paymentMilestones: [],
      budgetGaps: [],
      fragments: [],
    },
  });
  const { echoes } = detectDecisionEchoes({
    events: ledgerEvents,
    dismissed: new Set(rawPrefs?.dismissedEchoes ?? []),
  });

  // ---- future handoffs (valid ones only) -------------------------------
  const activeGoals = Array.from(new Set([...activeCommitments.map((c) => c.domain), ...plans.map((p) => p.domain)]));
  const futureHandoffs = commitRes.rows
    .filter((c) => c.status === "revoked")
    .map((c) =>
      buildHandoffCandidate({
        commitment: { id: c.id, domain: c.domain, monthly_contribution: c.monthly_contribution, status: "active", effectiveMonth: c.effective_month, source_moment: c.source_moment },
        reason: "revoked",
        activeGoals,
      }),
    )
    .filter(Boolean);

  // ---- six life nodes + cross-goal edges ------------------------------
  const domainsWithDraft = new Set(activeDrafts.map((d) => d.domain));
  const domainsCommitted = new Set(activeCommitments.map((c) => c.domain));
  // A sealed Studio plan puts its node on the line even before it carries a
  // monthly commitment — the intent is real, the money is just not routed yet.
  const domainsWithPlan = new Set(plans.map((p) => p.domain));
  const nodeKnown = (...ds) => ds.some((d) => domainsCommitted.has(d) || domainsWithDraft.has(d) || domainsWithPlan.has(d));
  const safetyKnown = asset.emergencyBufferMonths != null && monthlyExpenses != null;
  const safetyWaiting = safetyKnown && asset.emergencyBufferMonths < EMERGENCY_FLOOR_MONTHS;
  const nodeFor = (id, extra) => ({ id, ...extra, state: nodeState(extra) });
  const lifeNodes = [
    nodeFor("income", { value: monthlyIncome, known: monthlyIncome != null, moving: domainsWithDraft.has("loan"), waiting: false }),
    nodeFor("safety", { value: asset.emergencyBufferMonths, known: safetyKnown, moving: domainsWithDraft.has("emergency"), waiting: safetyWaiting }),
    nodeFor("home", { value: null, known: nodeKnown("home"), moving: domainsWithDraft.has("home"), waiting: false }),
    nodeFor("relationships", { value: null, known: nodeKnown("wedding", "family"), moving: domainsWithDraft.has("wedding") || domainsWithDraft.has("family"), waiting: false }),
    nodeFor("freedom", { value: availableMonthlyCashflow, known: availableMonthlyCashflow != null, moving: domainsWithDraft.has("investment"), waiting: false }),
    nodeFor("future", { value: null, known: nodeKnown("retirement"), moving: domainsWithDraft.has("retirement"), waiting: false }),
  ];
  // Edges carry a real current pressure direction. "down" = this branch is
  // tightening the target; "up" = easing it; "flat" = no active change.
  const pressureDir = (fromDomain) => (domainsWithDraft.has(fromDomain) ? "down" : "flat");
  const baseCrossGoalEdges = [
    { from: "income", to: "freedom", direction: pressureDir("loan"), basis: "loan repayment vs monthly room" },
    { from: "home", to: "safety", direction: pressureDir("home"), basis: "deposit saving vs emergency floor" },
    { from: "relationships", to: "home", direction: pressureDir("wedding"), basis: "wedding spend vs home deposit" },
    { from: "freedom", to: "future", direction: pressureDir("investment"), basis: "near-term capital vs long-term" },
    { from: "safety", to: "future", direction: safetyWaiting ? "down" : "flat", basis: "buffer below floor delays long-term" },
  ];

  // ---- nine-Studio cross-goal integration (commit 11) -----------------
  // Run every active draft branch through its Studio adapter's unified
  // impactSet and fold the real freed/pressure magnitudes + ghost/solid
  // state into the canonical edges.
  const commitmentsByPlanId = {};
  for (const c of activeCommitments) if (c.planId) commitmentsByPlanId[c.planId] = { id: c.id, plan_branch_id: c.branchId ?? null };

  // ONE CanonicalMomentSnapshot for this request. Every Studio projector
  // and the cross-goal aggregation reads its baseline from here, and each
  // domain's own active commitment is removed from "committed elsewhere"
  // exactly once (no sealed-branch double count).
  const commitmentsByDomain = {};
  for (const c of activeCommitments) commitmentsByDomain[c.domain] = (commitmentsByDomain[c.domain] ?? 0) + (c.monthlyContribution ?? 0);
  const canonicalSnapshot = buildCanonicalSnapshot({
    generatedAt: new Date().toISOString(),
    monthlyIncome,
    monthlyExpenses,
    emergencyBufferMonths: asset.emergencyBufferMonths,
    availableMonthlyCashflow,
    committedMonthlyTotal,
    commitmentsByDomain,
    hash: (s) => createHash("sha1").update(s).digest("hex"),
  });

  const studioImpacts = await collectStudioImpacts({
    branchesByPlan,
    planStore,
    commitmentsByPlanId,
    canonicalSnapshot,
    threadContext: {
      monthlyIncome,
      monthlyExpenses,
      committedMonthlyTotal,
      commitmentsByDomain,
      emergencyBufferMonths: asset.emergencyBufferMonths,
      availableMonthlyCashflow,
    },
  });
  const crossGoalEdges = enrichCrossGoalEdges(baseCrossGoalEdges, studioImpacts.nodeImpacts);

  // ---- bank now ------------------------------------------------------
  const cardDue = known.saved ? num(rawPrefs?.profile?.creditCardOutstanding) : null;
  const bankNow = {
    known: known.currentSavings != null,
    availableBalance: known.currentSavings,
    currency: "SGD",
    oneThingThisWeek: cardDue && cardDue > 0 ? { kind: "card_payment", amount: Math.round(cardDue) } : null,
  };

  // ---- latest confirmed change --------------------------------------
  const confirmedStatuses = new Set(["scheduled", "active", "completed", "observed", "revoked", "paused"]);
  const latestConfirmed = ledgerEvents.find((e) => confirmedStatuses.has(e.status)) ?? null;
  const latestChange = latestConfirmed
    ? {
        id: latestConfirmed.id,
        actionType: latestConfirmed.action_type,
        status: latestConfirmed.status,
        occurredAt: latestConfirmed.occurred_at,
        headline: formatEvent(latestConfirmed, (k) => k)?.headline ?? latestConfirmed.message_key,
      }
    : null;

  // ---- guardian decision (one, or calm) ----------------------------
  const guardianDecision = turningPoints.nextDecision
    ? {
        needsDecision: true,
        kind: "turning_point",
        whyNowKey: turningPoints.nextDecision.whyNowKey ?? null,
        whyNowParams: turningPoints.nextDecision.whyNowParams ?? {},
        ifYouWaitKey: turningPoints.nextDecision.ifYouWaitKey ?? null,
      }
    : futureHandoffs.length
      ? { needsDecision: true, kind: "future_handoff", releasedMonthly: futureHandoffs[0].releasedMonthly }
      : { needsDecision: false };

  // ---- provenance + freshness ------------------------------------
  const provenance = {
    bankNow: bankNow.known ? "profile_stated_savings" : "unknown",
    monthlyIncome: known.monthlyIncome != null ? "profile_stated" : (incomeHistory ?? []).length ? "logged_history_smoothed" : "unknown",
    monthlyExpenses: known.monthlyExpenses != null ? "profile_stated" : (expenseHistory ?? []).length ? "logged_history_smoothed" : "unknown",
    committedMonthlyTotal: "confirmed_plans_and_loans",
    emergencyBufferMonths: asset.emergencyBufferMonths != null ? "asset_ledger_and_expenses" : "unknown",
    lifeNodes: "derived_from_plans_commitments_and_asset_ledger",
  };
  const dataFreshness = {
    profileSaved: Boolean(known.saved),
    ledgerLatestAt: ledgerEvents[0]?.occurred_at ?? null,
    activeDraftCount: activeDrafts.length,
    activeCommitmentCount: activeCommitments.length,
    generatedAt: new Date().toISOString(),
  };

  const material = {
    bankNow,
    activePlans,
    activeDrafts: activeDrafts.map((d) => ({ domain: d.domain, branchId: d.branchId, updatedAt: d.updatedAt })),
    commitments: activeCommitments.map((c) => ({ id: c.id, domain: c.domain, monthlyContribution: c.monthlyContribution })),
    committedMonthlyTotal,
    availableMonthlyCashflow,
    lifeNodes: lifeNodes.map((n) => ({ id: n.id, state: n.state })),
    nextTurningPoint: turningPoints.nextDecision ?? null,
    promiseWeightStatus: promiseWeight.status,
    futureHandoffIds: futureHandoffs.map((h) => h.fromCommitmentId),
    latestChangeId: latestChange?.id ?? null,
    guardianNeedsDecision: guardianDecision.needsDecision,
    canonicalSnapshotId: studioImpacts.snapshotId,
    studioImpactTotals: studioImpacts.monthlyResourceTotals,
    studioImpactGroupCount: studioImpacts.groupCount,
    studioImpactNodes: Object.keys(studioImpacts.nodeImpacts).sort(),
    studioMomentStates: Object.fromEntries(Object.entries(studioImpacts.moments).map(([d, m]) => [d, m.state])),
    sealedStudioCount: studioImpacts.sealedStudioCount,
    studioConflicts: studioImpacts.conflicts,
    studioBaselineConflict: studioImpacts.hasBaselineConflict,
  };
  const snapshotVersion = createHash("sha1").update(JSON.stringify(material)).digest("hex").slice(0, 16);

  return {
    snapshotVersion,
    generatedAt: dataFreshness.generatedAt,
    bankNow,
    activePlans,
    activeDrafts,
    commitments: activeCommitments,
    monthlyCommittedTotal: committedMonthlyTotal,
    availableMonthlyCashflow,
    monthlyExpenses: monthlyExpenses ?? null,
    lifeNodes,
    crossGoalEdges,
    canonicalSnapshot,
    studioImpacts,
    nextTurningPoint: turningPoints.nextDecision ?? null,
    turningPointCounts: { open: turningPoints.openCount, approaching: turningPoints.approachingCount },
    promiseWeight: {
      status: promiseWeight.status,
      activeCommitmentCount: promiseWeight.activeCommitmentCount,
      pressureWindow: promiseWeight.pressureWindow,
      headlineKey: promiseWeight.headlineKey,
    },
    decisionEchoes: echoes,
    futureHandoffs,
    latestChange,
    guardianDecision,
    provenance,
    dataFreshness,
  };
}
