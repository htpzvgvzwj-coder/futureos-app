// Money Moments - the server-owned aggregator that turns FutureOS's
// invisible intelligence into ONE normalized stream the Today / Explore /
// Guardian / History surfaces all read.
//
// It REUSES existing builders/stores (no api-to-api):
//   - buildFinancialTwinBundle()  -> twin, safe-to-spend, rescue cases, reality drift
//   - buildLifeThread()           -> active plans/drafts, studioImpacts, turning point
//   - listRippleEvents/buildCurrentRipple -> persisted "what changed"
//   - listEvents() (Change Ledger)-> confirmed history
//   - getMomentStates()           -> per-moment lifecycle
//
// Rules (enforced below):
//   - never combine unlike units (every affectedPlan carries its own unit)
//   - never turn unknown into zero (unknown -> null + note)
//   - never present a preview as committed (possibleAfter vs confirmedAfter)
//   - deduplicate the same source event across detector / Ripple / Ledger
//   - order: action_required -> watch -> latest confirmed change ->
//            active plan movement -> calm information

import { createHash } from "node:crypto";
import { buildFinancialTwinBundle } from "../financial-twin/bundle.js";
import { buildLifeThread } from "../life-thread/service.js";
import { listRippleEvents } from "../ripple/store.js";
import { buildCurrentRipple } from "../ripple/build.js";
import { listEvents } from "../change-ledger/store.js";
import { formatEvent, eventMessage } from "../change-ledger/format.js";
import enLocale from "../../locales/en.json" with { type: "json" };

// A minimal English translator over locales/en.json, so ledgerToMoment can
// produce a real headline (not a raw i18n key) while still handing the
// key + params to the render layer for localisation.
const enT = (key, params = {}) => {
  const raw = String(key).split(".").reduce((v, k) => (v == null ? v : v[k]), enLocale);
  if (raw == null) return key;
  return String(raw).replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));
};
import { getMomentStates, effectiveState } from "./state-store.js";

export const MONEY_MOMENT_CONTRACT_VERSION = "1.0.0";
const CURRENCY = "SGD";

const SEVERITY_BY_RESCUE_KIND = {
  payment_failed: "action_required",
  salary_missing: "action_required",
  low_balance_ahead: "watch",
  plan_squeezes_emergency: "watch",
  card_pressure_rising: "watch",
  bills_clustered: "watch",
  large_unusual_spend: "watch",
  duplicate_subscription: "information",
};

function sha1(obj) {
  return createHash("sha1").update(typeof obj === "string" ? obj : JSON.stringify(obj)).digest("hex").slice(0, 16);
}
// Number(null) === 0 and Number("") === 0 - both are "unknown", not zero.
// This is the one gate every money figure goes through: never coerce a
// missing value into a real number.
function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function money(n, currency = CURRENCY) {
  const v = num(n);
  return v == null ? null : `${currency} ${Math.round(Math.abs(v)).toLocaleString("en-SG")}`;
}

// ---- rescue case -> MoneyMoment ----------------------------------------
function rescueActions(c) {
  return (c.options ?? []).map((o) => {
    const lk = o.labelKey ?? o.label; // the label is its own key
    switch (o.id) {
      case "recognise":
        return { id: "acknowledge", label: "I recognise this", labelKey: "I recognise this", route: null, available: true };
      case "dispute":
        return { id: "dispute", label: "I don't recognise this", labelKey: "I don't recognise this", route: null, available: false, unavailableReason: "No connected bank dispute rail" };
      case "retry":
      case "update_source":
      case "contact_biller":
        return { id: o.id, label: o.label, labelKey: lk, route: null, available: false, unavailableReason: "External payment rail not connected" };
      case "review":
      case "recategorise":
        return { id: o.id, label: o.label, labelKey: lk, route: "today:activity", available: true };
      case "open_mirror":
      case "reduce_contribution":
      case "pause_one":
      case "reduce_all":
        return { id: o.id, label: o.label, labelKey: lk, route: "home", available: true };
      case "open_future_balance":
        return { id: o.id, label: o.label, labelKey: lk, route: "today", available: true };
      default:
        return { id: o.id, label: o.label, labelKey: lk, route: "explore", available: true };
    }
  });
}

const RESCUE_WHY_NOW = {
  payment_failed: "Flagged now because the payment did not clear and the biller may retry.",
  low_balance_ahead: "Flagged now because scheduled payments land before your next income.",
  salary_missing: "Flagged now because the expected pay date has passed with no credit.",
  duplicate_subscription: "Flagged now because two active charges look like the same service.",
  large_unusual_spend: "Flagged now because this payment is well outside your recent spending pattern.",
  bills_clustered: "Flagged now because several bills fall within one week.",
  plan_squeezes_emergency: "Flagged now because income minus commitments is negative this month.",
  card_pressure_rising: "Flagged now because the card balance is over half your liquid cash.",
};
function rescueToMoment(c, asOf) {
  const txnId = /:(txn|.+)$/.test(c.id) && c.id.includes(":") ? c.id.split(":").slice(1).join(":") : null;
  const evidence = [];
  if (c.atRisk?.length) {
    evidence.push({ label: "At risk", value: c.atRisk.join(", "), source: "money_rescue_detector", asOf, confidence: c.confidence ?? "expected", provenance: "system_estimate" });
  }
  if (c.recommendedAction) {
    const rec = (c.options ?? []).find((o) => o.id === c.recommendedAction);
    if (rec) evidence.push({ label: "Suggested first step", value: rec.label, source: "money_rescue_detector", asOf, confidence: c.confidence ?? "expected", provenance: "detector_rule" });
  }

  const whyNow = RESCUE_WHY_NOW[c.kind] ?? "Flagged from your latest ledger and plan data.";
  return {
    id: `rescue:${c.id}`,
    sourceType: "detected_problem",
    severity: SEVERITY_BY_RESCUE_KIND[c.kind] ?? "information",
    kind: c.kind,
    title: c.whatHappened,
    titleKey: c.whatHappenedKey ?? c.whatHappened,
    titleParams: c.whatHappenedParams ?? null,
    summary: c.whyItMatters,
    summaryKey: c.whyItMattersKey ?? c.whyItMatters,
    summaryParams: c.whyItMattersParams ?? null,
    whyNow,
    whyNowKey: whyNow,
    evidence,
    moneyChange: null,
    affectedPlans: (c.atRisk ?? [])
      .filter((r) => /plan|commitment|emergency|home|wedding|retirement/i.test(r))
      .map((r) => ({ domain: r.replace(/ (plan|commitment|coverage)$/i, "").toLowerCase().trim(), metric: "exposure", unit: "qualitative", before: null, possibleAfter: r, confirmedAfter: null, direction: "down", state: "possible" })),
    state: "new",
    nextActions: rescueActions(c),
    occurredAt: asOf,
    sourceRefs: [{ kind: "rescue_case", id: c.id, refKey: txnId ? `txn:${txnId}` : `rescue:${c.kind}` }],
    _dedupeRefs: [txnId ? `txn:${txnId}` : `rescue:${c.kind}`],
    _priority: 0,
  };
}

// ---- reality drift -> MoneyMoment -------------------------------------
function driftToMoment(driftCase, drift, asOf) {
  const favourable = driftCase.favourable;
  return {
    id: `drift:${driftCase.metric}`,
    sourceType: "reality_drift",
    severity: favourable ? "information" : "watch",
    kind: `drift_${driftCase.metric}`,
    title: `Your ${driftCase.metric.replace(/_/g, " ")} is running ${driftCase.direction} than your plan assumed`,
    titleKey: "Your {metric} is running {direction} than your plan assumed",
    titleParams: { metric: driftCase.metric.replace(/_/g, " "), direction: driftCase.direction },
    summary: driftCase.summary,
    summaryKey: driftCase.summaryKey ?? driftCase.summary,
    summaryParams: driftCase.summaryParams ?? null,
    whyNow: `${drift.monthsObserved} months of your real ledger now disagree with the plan by ${driftCase.deltaPct}%.`,
    whyNowKey: "{months} months of your real ledger now disagree with the plan by {pct}%.",
    whyNowParams: { months: drift.monthsObserved, pct: driftCase.deltaPct },
    evidence: [
      { label: "Plan assumed", value: money(driftCase.planned), source: "plan_version", asOf, confidence: "confirmed", provenance: "user_confirmed" },
      { label: `Observed (${drift.monthsObserved} mo avg)`, value: money(driftCase.observed), source: "transaction_ledger", asOf, confidence: "expected", provenance: "bank_synced" },
      { label: "Gap", value: `${driftCase.delta > 0 ? "+" : "−"}${money(driftCase.delta)} / month`, source: "reality_drift_detector", asOf, confidence: "expected", provenance: "system_estimate" },
    ],
    moneyChange: { monthlyDelta: driftCase.delta, oneOffDelta: null, currency: CURRENCY },
    affectedPlans: [
      { domain: driftCase.metric === "monthly_income" ? "income" : "essentials", metric: "monthly_amount", unit: "sgd_per_month", before: driftCase.planned, possibleAfter: driftCase.observed, confirmedAfter: null, direction: driftCase.direction === "higher" ? "up" : "down", state: "possible" },
    ],
    state: "new",
    nextActions: [
      { id: "accept_new_reality", label: "Update the plan to match reality", labelKey: "Update the plan to match reality", route: "home", available: true },
      { id: "keep_original_plan", label: "Keep the original plan", labelKey: "Keep the original plan", route: null, available: true },
    ],
    occurredAt: asOf,
    sourceRefs: [{ kind: "reality_drift", id: driftCase.metric, refKey: `drift:${driftCase.metric}` }],
    _dedupeRefs: [`drift:${driftCase.metric}`],
    _priority: 2,
  };
}

// ---- ripple event -> MoneyMoment (confirmed changes only) ------------
function rippleToMoment(e, asOf) {
  const affected = (e.affectedGoals ?? []).map((g) => ({
    domain: g.goalId ?? "goal",
    metric: g.metric ?? "ready_month",
    unit: g.unit ?? "qualitative",
    before: g.before ?? null,
    possibleAfter: e.state === "confirmed" ? null : g.after ?? null,
    confirmedAfter: e.state === "confirmed" ? g.after ?? null : null,
    direction: g.direction ?? "flat",
    state: e.state === "confirmed" ? "confirmed" : e.state === "placed" ? "placed" : "possible",
  }));
  return {
    id: `ripple:${e.id}`,
    sourceType: "confirmed_change",
    severity: e.severity === "action_required" ? "action_required" : e.severity === "turning_point" ? "watch" : "information",
    kind: e.kind,
    title: e.whatChanged,
    titleKey: e.whatChanged,
    summary: e.monthlyImpact != null ? `Monthly effect ${e.monthlyImpact >= 0 ? "+" : "−"}${money(e.monthlyImpact)}.` : "A recorded change to your money.",
    summaryKey: e.monthlyImpact != null ? "Monthly effect {sign}{amt}." : "A recorded change to your money.",
    summaryParams: e.monthlyImpact != null ? { sign: e.monthlyImpact >= 0 ? "+" : "−", amt: money(e.monthlyImpact) } : null,
    whyNow: "Recorded in your Current Ripple.",
    whyNowKey: "Recorded in your Current Ripple.",
    evidence: [
      { label: "Change", value: e.whatChanged, source: "ripple_events", asOf: e.occurredAt ?? asOf, confidence: e.confidence ?? "expected", provenance: "system_recorded" },
      ...(e.monthlyImpact != null ? [{ label: "Monthly effect", value: `${e.monthlyImpact >= 0 ? "+" : "−"}${money(e.monthlyImpact)}`, source: "ripple_events", asOf: e.occurredAt ?? asOf, confidence: e.confidence ?? "expected", provenance: "system_computed" }] : []),
    ],
    moneyChange: e.monthlyImpact != null ? { monthlyDelta: e.monthlyImpact, oneOffDelta: null, currency: CURRENCY } : null,
    affectedPlans: affected,
    state: e.state === "revoked" ? "revoked" : "new",
    nextActions: [
      { id: "view_cause", label: "See what caused this", labelKey: "See what caused this", route: "history", available: true },
      ...(e.domain ? [{ id: "review_plan", label: `Review your ${e.domain} plan`, labelKey: "Review your {d} plan", labelParams: { d: e.domain }, route: `studio:${e.domain}`, available: true }] : []),
    ],
    occurredAt: e.occurredAt ?? asOf,
    sourceRefs: [{ kind: "ripple_event", id: e.id, refKey: e.domain ? `plan:${e.domain}` : `ripple:${e.id}` }],
    _dedupeRefs: [
      e.sourceRef?.transactionId ? `txn:${e.sourceRef.transactionId}` : null,
      e.domain ? `plan:${e.domain}` : null,
      e.id ? `ripple:${e.id}` : null,
    ].filter(Boolean),
    _priority: 1,
  };
}

// ---- change-ledger event -> MoneyMoment (confirmed) -----------------
const CONFIRMED_LEDGER_STATUS = new Set(["scheduled", "active", "paused", "completed", "observed", "revoked"]);
// looks like an unresolved i18n key: dotted, no spaces
const RAW_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;
const humanizeType = (s) => String(s || "a change").replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function ledgerToMoment(e, asOf) {
  let headlineEn = formatEvent(e, enT)?.headline || e.message_key || "";
  const msg = eventMessage(e, (k) => k);
  // If neither the builder nor the locale file could resolve a real
  // sentence (a message_key with no matching entry), fall back to a
  // humanised action_type rather than leaking the raw key.
  let titleKey = msg?.key ?? headlineEn;
  let titleParams = msg?.params ?? null;
  if (!headlineEn || RAW_KEY.test(headlineEn)) {
    headlineEn = humanizeType(e.action_type);
    titleKey = headlineEn;
    titleParams = null;
  }
  return {
    id: `ledger:${e.id}`,
    sourceType: "confirmed_change",
    severity: "information",
    kind: e.action_type,
    title: headlineEn,
    titleKey,
    titleParams,
    summary: e.uncertainty_note ?? "A confirmed change in your Change Ledger.",
    summaryKey: e.uncertainty_note ?? "A confirmed change in your Change Ledger.",
    whyNow: "This is your most recent confirmed change.",
    whyNowKey: "This is your most recent confirmed change.",
    evidence: [
      { label: "Recorded", value: new Date(e.occurred_at).toISOString().slice(0, 10), source: "change_ledger", asOf, confidence: "confirmed", provenance: "ledger_event" },
      { label: "Status", value: e.status, source: "change_ledger", asOf, confidence: "confirmed", provenance: "ledger_event" },
    ],
    moneyChange: null,
    affectedPlans: [],
    state: "new",
    nextActions: [{ id: "view_history", label: "Open full history", labelKey: "Open full history", route: "history", available: true }],
    occurredAt: new Date(e.occurred_at).toISOString(),
    sourceRefs: [{ kind: "ledger_event", id: e.id, refKey: e.plan_id ? `plan_id:${e.plan_id}` : `ledger:${e.id}` }],
    _dedupeRefs: [e.plan_id ? `plan_id:${e.plan_id}` : `ledger:${e.id}`, e.dedupe_key ? `ledgerkey:${e.dedupe_key}` : null].filter(Boolean),
    _priority: 1,
  };
}

// ---- life-thread turning point + plan pressure -> MoneyMoment -------
// Plain-language copy per turning-point KIND (never the raw i18n key).
// An unrecognised kind returns null rather than leaking an internal string.
function turningPointCopy(tp) {
  const p = tp.whyNowParams ?? {};
  switch (tp.kind) {
    case "emergency_floor_near":
      // needs a real expense basis; a 0 / non-finite buffer is the
      // "no expenses entered" artifact, not a trustworthy signal.
      if (!Number.isFinite(Number(p.buffer)) || Number(p.buffer) <= 0) return null;
      return {
        title: "Your emergency buffer is close to its floor",
        why: `Your buffer is about ${Math.round(Number(p.buffer) * 10) / 10} months against a ${p.floor}-month floor. Slowing a plan now avoids drawing it down.`,
        whyKey: "Your buffer is about {buffer} months against a {floor}-month floor. Slowing a plan now avoids drawing it down.",
        whyParams: { buffer: Math.round(Number(p.buffer) * 10) / 10, floor: p.floor },
      };
    case "payment_due_underfunded":
      return { title: "A scheduled payment is underfunded", why: "A commitment payment is due before there is enough set aside for it." };
    case "budget_below_core":
      return { title: "Spending is running below your core plan", why: "Your observed budget is under what the plan assumed — worth confirming before it compounds." };
    case "fragment_expiring":
      return { title: "An unclaimed amount is about to expire", why: "Money you freed earlier has not been allocated and its window is closing." };
    case "commitment_completing":
      return { title: "A commitment is about to complete", why: "Its monthly amount will free up soon — decide where it should go." };
    default:
      return null;
  }
}
function turningPointToMoment(tp, asOf) {
  if (!tp) return null;
  const copy = turningPointCopy(tp);
  if (!copy) return null;
  return {
    id: `turning_point:${tp.id ?? tp.kind ?? "next"}`,
    sourceType: "turning_point",
    severity: tp.state === "open" ? "watch" : "information",
    kind: tp.kind ?? "turning_point",
    title: copy.title,
    titleKey: copy.title,
    summary: copy.why,
    summaryKey: copy.whyKey ?? copy.why,
    summaryParams: copy.whyParams ?? null,
    whyNow: copy.why,
    whyNowKey: copy.whyKey ?? copy.why,
    whyNowParams: copy.whyParams ?? null,
    evidence: Object.entries(tp.evidence ?? tp.whyNowParams ?? {}).map(([k, v]) => ({
      label: String(k).replace(/([a-z])([A-Z])/g, "$1 $2"),
      value: String(v),
      source: "life_thread",
      asOf,
      confidence: "expected",
      provenance: "derived",
    })),
    moneyChange: null,
    affectedPlans: [],
    state: "new",
    nextActions: [{ id: "open_guardian", label: "Review with Guardian", labelKey: "Review with Guardian", route: "guardian", available: true }],
    occurredAt: asOf,
    sourceRefs: [{ kind: "turning_point", id: tp.id ?? tp.kind ?? "next", refKey: "turning_point" }],
    _dedupeRefs: ["turning_point"],
    _priority: 4,
  };
}

function planPressureMoments(lifeThread, asOf) {
  const si = lifeThread.studioImpacts ?? {};
  const out = [];
  for (const grp of si.aggregated ?? []) {
    if (grp.state === "conflict") continue;
    if (grp.favourable === false && grp.state !== "confirmed" && grp.possibleDelta != null) {
      out.push({
        id: `plan_impact:${grp.targetGoalId}:${grp.metric}`,
        sourceType: "plan_impact",
        severity: "watch",
        kind: "plan_pressure",
        title: `An active plan is pressuring your ${String(grp.targetGoalId).replace(/_/g, " ")}`,
        titleKey: "An active plan is pressuring your {goal}",
        titleParams: { goal: String(grp.targetGoalId).replace(/_/g, " ") },
        summary: `A draft change moves ${String(grp.targetGoalId).replace(/_/g, " ")} ${grp.direction === "down" ? "unfavourably" : ""} by about ${Math.abs(Math.round(grp.possibleDelta))} ${grp.unit.replace(/_/g, " ")} (preview).`,
        summaryKey: "A draft change moves {goal} by about {amt} {unit} (preview).",
        summaryParams: { goal: `${String(grp.targetGoalId).replace(/_/g, " ")}${grp.direction === "down" ? " unfavourably" : ""}`, amt: Math.abs(Math.round(grp.possibleDelta)), unit: grp.unit.replace(/_/g, " ") },
        whyNow: "This is a possible effect of a plan you have not sealed yet.",
        whyNowKey: "This is a possible effect of a plan you have not sealed yet.",
        evidence: [
          { label: "Metric", value: `${grp.metric} (${grp.unit})`, source: "studio_impacts", asOf, confidence: "expected", provenance: "projector" },
          { label: "Before", value: grp.before == null ? "Needs more information" : String(grp.before), source: "studio_impacts", asOf, confidence: "expected", provenance: "projector" },
          { label: "Possible after", value: grp.possibleAfter == null ? "Needs more information" : String(grp.possibleAfter), source: "studio_impacts", asOf, confidence: "conditional", provenance: "projector_preview" },
        ],
        moneyChange: grp.unit === "sgd_per_month" ? { monthlyDelta: grp.possibleDelta, oneOffDelta: null, currency: CURRENCY } : null,
        affectedPlans: [
          { domain: grp.targetGoalId, metric: grp.metric, unit: grp.unit, before: grp.before ?? null, possibleAfter: grp.possibleAfter ?? null, confirmedAfter: null, direction: grp.direction ?? "flat", state: "possible" },
        ],
        state: "new",
        nextActions: [{ id: "review_impact", label: "Review this plan's impact", labelKey: "Review this plan's impact", route: "explore:plans", available: true }],
        occurredAt: asOf,
        sourceRefs: [{ kind: "studio_impact_group", id: `${grp.targetGoalId}:${grp.metric}`, refKey: `plan:${grp.targetGoalId}` }],
        _dedupeRefs: [`plan:${grp.targetGoalId}`],
        _priority: 3,
      });
    }
  }
  return out;
}

// ---- dedupe + order --------------------------------------------------
export function dedupeMoments(candidates) {
  // Higher-fidelity source wins for the same underlying ref.
  const byRef = new Map();
  const kept = [];
  const sorted = [...candidates].sort((a, b) => a._priority - b._priority);
  for (const m of sorted) {
    const refs = m._dedupeRefs ?? [];
    const clash = refs.find((r) => byRef.has(r));
    if (clash) {
      const winner = byRef.get(clash);
      // merge sourceRefs so the surviving moment still points at every origin
      const seen = new Set(winner.sourceRefs.map((s) => `${s.kind}:${s.id}`));
      for (const s of m.sourceRefs ?? []) if (!seen.has(`${s.kind}:${s.id}`)) winner.sourceRefs.push(s);
      continue;
    }
    for (const r of refs) if (!byRef.has(r)) byRef.set(r, m);
    kept.push(m);
  }
  return kept;
}

export const ORDER_RANK = (m) => {
  if (m.severity === "action_required") return 0;
  if (m.severity === "watch" && m.sourceType !== "plan_impact") return 1;
  if (m.sourceType === "confirmed_change") return 2;
  if (m.sourceType === "plan_impact") return 3;
  return 4;
};

// ---- plan movement view -------------------------------------------
function buildPlanMovement(lifeThread, ledgerEvents) {
  const si = lifeThread.studioImpacts ?? {};
  const perStudioByPlan = new Map((si.perStudio ?? []).map((p) => [p.planId, p]));
  const measuresByPlan = new Map();
  for (const m of si.measures ?? []) {
    if (!measuresByPlan.has(m.sourcePlanId)) measuresByPlan.set(m.sourcePlanId, []);
    measuresByPlan.get(m.sourcePlanId).push(m);
  }
  const ledgerByPlan = new Map();
  for (const e of ledgerEvents) {
    if (e.plan_id && !ledgerByPlan.has(e.plan_id)) ledgerByPlan.set(e.plan_id, e);
  }

  const rows = [];

  for (const c of lifeThread.commitments ?? []) {
    const ps = perStudioByPlan.get(c.planId);
    const le = ledgerByPlan.get(c.planId);
    rows.push({
      domain: c.domain,
      planId: c.planId ?? null,
      state: "committed",
      monthlyClaimed: num(c.monthlyContribution) ?? 0,
      monthlyReleased: ps ? num(ps.freedMonthly) ?? 0 : 0,
      affected: (measuresByPlan.get(c.planId) ?? []).map(measureToAffected),
      lastChange: le ? { headline: formatEvent(le, (k) => k)?.headline ?? le.message_key, occurredAt: new Date(le.occurred_at).toISOString() } : null,
      nextTurningPoint: lifeThread.nextTurningPoint?.domain === c.domain ? lifeThread.nextTurningPoint : null,
      lastUpdatedAt: le ? new Date(le.occurred_at).toISOString() : lifeThread.generatedAt,
      actions: planActions(c.domain, "committed"),
    });
  }

  for (const d of lifeThread.activeDrafts ?? []) {
    if (rows.some((r) => r.domain === d.domain && r.state === "committed")) continue;
    const ps = perStudioByPlan.get(d.planId);
    const le = ledgerByPlan.get(d.planId);
    const isPreview = Boolean(d.isActive);
    rows.push({
      domain: d.domain,
      planId: d.planId ?? null,
      branchId: d.branchId ?? null,
      state: isPreview ? "preview" : "draft",
      monthlyClaimed: ps ? num(ps.addedPressureMonthly) ?? 0 : 0,
      monthlyReleased: ps ? num(ps.freedMonthly) ?? 0 : 0,
      affected: (measuresByPlan.get(d.planId) ?? []).map(measureToAffected),
      lastChange: le ? { headline: formatEvent(le, (k) => k)?.headline ?? le.message_key, occurredAt: new Date(le.occurred_at).toISOString() } : null,
      nextTurningPoint: lifeThread.nextTurningPoint?.domain === d.domain ? lifeThread.nextTurningPoint : null,
      lastUpdatedAt: d.updatedAt ?? (le ? new Date(le.occurred_at).toISOString() : lifeThread.generatedAt),
      actions: planActions(d.domain, isPreview ? "preview" : "draft"),
    });
  }

  return rows;
}

function measureToAffected(m) {
  return {
    domain: m.targetGoalId,
    metric: m.metric,
    unit: m.unit ?? "qualitative",
    before: m.before ?? null,
    possibleAfter: m.possibleAfter ?? null,
    confirmedAfter: m.confirmedAfter ?? null,
    direction: m.direction ?? (m.before != null && m.possibleAfter != null ? (m.possibleAfter > m.before ? "up" : m.possibleAfter < m.before ? "down" : "flat") : "flat"),
    favourable: m.favourable ?? null,
    state: m.effectState ?? "possible",
  };
}
function planActions(domain, state) {
  return [
    { id: "continue", label: state === "committed" ? "Review plan" : "Continue", route: `studio:${domain}`, available: true },
    { id: "review_impact", label: "Review impact", route: "explore:plans", available: true },
    { id: "adjust", label: "Adjust", route: `studio:${domain}`, available: true },
    { id: "view_history", label: "View history", route: "history", available: true },
  ];
}

// ---- "money changed" (Today section 2) ---------------------------
function buildMoneyChanged(orderedMoments, bundle, lifeThread) {
  const confirmed = orderedMoments.find((m) => m.sourceType === "confirmed_change" && m.state !== "revoked");
  if (!confirmed) {
    return { hasChange: false, message: "No material change since your last check.", nextEvent: nextKnownEvent(bundle) };
  }
  const s2s = bundle.safeToSpend ?? {};
  const movedPlan = confirmed.affectedPlans?.find((p) => p.direction && p.direction !== "flat");
  return {
    hasChange: true,
    headline: confirmed.title,
    moneyNow: { label: "Available to spend", value: num(s2s.safeToSpend), currency: CURRENCY },
    planEffect: movedPlan
      ? `Your ${movedPlan.domain} plan ${movedPlan.confirmedAfter != null ? `moved to ${movedPlan.confirmedAfter}` : movedPlan.possibleAfter != null ? `may move to ${movedPlan.possibleAfter} (preview)` : "moved"}.`
      : (lifeThread.activePlans ?? []).length
        ? "Your active plans are unchanged."
        : "No plan is affected.",
    safetyEffect:
      lifeThread.lifeNodes?.find((n) => n.id === "safety")?.state === "waiting_decision"
        ? "Your Emergency buffer is below your chosen floor."
        : "Your Emergency buffer remains protected.",
    nextAction: confirmed.nextActions?.[0] ?? { id: "view_history", label: "Open history", route: "history", available: true },
    occurredAt: confirmed.occurredAt,
    sourceRefs: confirmed.sourceRefs,
  };
}

function nextKnownEvent(bundle) {
  const s2s = bundle.safeToSpend ?? {};
  const bill = s2s.nearTermObligationsList?.[0] ?? null;
  const income = s2s.nextIncome ?? null;
  const cand = [];
  if (bill) cand.push({ kind: "bill", label: bill.label ?? "Next bill", amount: -Math.abs(bill.amount), when: bill.dueDate });
  if (income) cand.push({ kind: "income", label: income.label ?? "Next income", amount: Math.abs(income.amount), when: income.expectedDate });
  cand.sort((a, b) => String(a.when ?? "").localeCompare(String(b.when ?? "")));
  return cand[0] ?? null;
}

// ---- "bank now" (Today section 1) ------------------------------
function buildBankNow(bundle) {
  const s2s = bundle.safeToSpend ?? {};
  const twin = bundle.twin ?? {};
  const cardOwed =
    (num(twin.liabilitiesByClass?.credit_card_statement) ?? 0) + (num(twin.liabilitiesByClass?.credit_card_revolving) ?? 0);
  let nextEvent = nextKnownEvent(bundle);
  if (cardOwed > 0) {
    nextEvent = { kind: "card_payment", label: "Credit-card balance to clear", amount: -Math.abs(cardOwed), when: null, whenText: "statement" };
  }
  return {
    available: num(s2s.safeToSpend) ?? num(twin.liquidAssets),
    currency: CURRENCY,
    belowProtectedFloor: Boolean(s2s.belowProtectedFloor),
    nextEvent,
  };
}

// ---- what Future Bank is watching (calm-state explainer) --------
function buildWatching(bundle, lifeThread) {
  const twin = bundle.twin ?? {};
  const cardOwed =
    (num(twin.liabilitiesByClass?.credit_card_statement) ?? 0) + (num(twin.liabilitiesByClass?.credit_card_revolving) ?? 0);
  const txnCount = (bundle.allTransactions ?? []).length;
  return [
    { label: "Bills due before your next income", active: (bundle.recurring ?? []).length > 0 && (bundle.incomeStreams ?? []).length > 0, reason: "Needs at least one bill and one income date" },
    { label: "Spending vs your 3-month average", active: txnCount >= 4, reason: "Needs about 3 months of transactions" },
    { label: "Credit-card balance vs your liquid cash", active: cardOwed > 0, reason: "Needs a credit-card balance" },
    { label: "Each plan's monthly claim vs your free cashflow", active: (lifeThread.commitments ?? []).length + (lifeThread.activeDrafts ?? []).length > 0, reason: "Needs at least one plan" },
    { label: "Your salary landing on time", active: (bundle.incomeStreams ?? []).some((s) => s.kind === "salary" && s.nextExpectedDate), reason: "Needs a salary with an expected date" },
  ];
}

// ---- orchestrator ---------------------------------------------
export async function buildMoneyMoments(userId, { rippleLimit = 25, ledgerLimit = 40 } = {}) {
  const [bundle, lifeThread, rippleRows, ledgerEvents, storedStates] = await Promise.all([
    buildFinancialTwinBundle(userId),
    buildLifeThread(userId).catch(() => ({})),
    listRippleEvents(userId, { limit: rippleLimit }).catch(() => []),
    listEvents(userId, { filter: "all", limit: ledgerLimit }).catch(() => []),
    getMomentStates(userId).catch(() => new Map()),
  ]);
  const asOf = bundle.asOf ?? new Date().toISOString().slice(0, 10);
  const ripple = buildCurrentRipple(rippleRows);

  // 1. gather candidates from every source
  const candidates = [];
  for (const c of bundle.rescueCases ?? []) candidates.push(rescueToMoment(c, asOf));
  if (bundle.realityDrift?.drifted) {
    for (const dc of bundle.realityDrift.cases ?? []) candidates.push(driftToMoment(dc, bundle.realityDrift, asOf));
  }
  for (const e of ripple.events ?? []) {
    if (e.state === "confirmed" || e.severity === "action_required") candidates.push(rippleToMoment(e, asOf));
  }
  const latestConfirmedLedger = (ledgerEvents ?? []).find((e) => CONFIRMED_LEDGER_STATUS.has(e.status));
  if (latestConfirmedLedger) candidates.push(ledgerToMoment(latestConfirmedLedger, asOf));
  for (const m of planPressureMoments(lifeThread, asOf)) candidates.push(m);
  const tp = turningPointToMoment(lifeThread.nextTurningPoint, asOf);
  if (tp) candidates.push(tp);

  // 2. dedupe across detector / ripple / ledger
  const deduped = dedupeMoments(candidates);

  // 3. apply persisted lifecycle (+ auto-reopen on evidence change)
  const nowMs = Date.now();
  const withState = deduped.map((m) => {
    const evHash = sha1({ evidence: m.evidence, moneyChange: m.moneyChange, affectedPlans: m.affectedPlans });
    const eff = effectiveState(storedStates.get(m.id), evHash, nowMs);
    const { _priority, _dedupeRefs, ...clean } = m;
    return { ...clean, evidenceHash: evHash, state: m.state === "revoked" ? "revoked" : eff.state, reopened: eff.reopened };
  });

  // 4. order: action_required -> watch -> latest confirmed -> plan movement -> calm
  // Only "new" (incl. auto-reopened) moments are in the active stream;
  // reviewed / snoozed / resolved / revoked drop out but stay in `allMoments`.
  const ordered = withState
    .filter((m) => m.state === "new")
    .sort((a, b) => ORDER_RANK(a) - ORDER_RANK(b) || String(b.occurredAt).localeCompare(String(a.occurredAt)));

  const planMovement = buildPlanMovement(lifeThread, ledgerEvents ?? []);
  const si = lifeThread.studioImpacts ?? {};
  const rt = si.monthlyResourceTotals ?? { freedMonthly: 0, addedPressureMonthly: 0, confirmedPlacedMonthly: 0, unplacedMonthly: 0 };
  // "Committed each month" = the sum of every active Future Bank commitment
  // (from goal_commitments), counted ONCE per commitment - never per goal
  // it affects. Falls back to the Life Thread's own total.
  const committedMonthly =
    (lifeThread.commitments ?? []).reduce((s, c) => s + (num(c.monthlyContribution) ?? 0), 0) ||
    num(lifeThread.monthlyCommittedTotal) ||
    0;

  return {
    contractVersion: MONEY_MOMENT_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    asOf,
    isEmpty: bundle.isEmpty,
    moments: ordered,
    allMoments: withState, // includes snoozed/resolved for History/Guardian
    counts: {
      total: ordered.length,
      actionRequired: ordered.filter((m) => m.severity === "action_required").length,
      watch: ordered.filter((m) => m.severity === "watch").length,
    },
    bankNow: buildBankNow(bundle),
    moneyChanged: buildMoneyChanged(ordered, bundle, lifeThread),
    watching: buildWatching(bundle, lifeThread),
    planMovement,
    monthlyResourceSummary: {
      currency: CURRENCY,
      committedMonthly: Math.round(committedMonthly),
      possibleAddedPressureMonthly: Math.round(rt.addedPressureMonthly || 0),
      releasedUnallocatedMonthly: Math.round(rt.unplacedMonthly || 0),
      possibleReleasedMonthly: Math.round(rt.freedMonthly || 0),
      remainingMonthlyRoom: num(lifeThread.availableMonthlyCashflow), // null -> "Needs more information"
    },
    lifeThreadVersion: lifeThread.snapshotVersion ?? null,
    rippleCount: ripple.count ?? 0,
  };
}
