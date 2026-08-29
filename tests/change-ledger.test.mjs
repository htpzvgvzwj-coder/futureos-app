import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEventDraft,
  buildImpact,
  redactForShared,
  isActualStatus,
  makeDedupeKey,
  ACTION_TYPES,
} from "../lib/change-ledger/events.js";
import { formatEvent, formatImpactReceipt } from "../lib/change-ledger/format.js";
import {
  buildHomeCommitmentCreatedEvent,
  buildHomeCommitmentRevokedEvent,
  buildHomeCommitmentPausedEvent,
} from "../lib/change-ledger/producers/home.js";
import en from "../locales/en.json" with { type: "json" };
import zh from "../locales/zh.json" with { type: "json" };

// Minimal translator mirroring app/page.jsx's makeTranslator (lookup +
// {param} interpolation, key returned when missing).
function makeT(dict) {
  return (key, params = {}) => {
    const value = key.split(".").reduce((v, seg) => (v == null ? v : v[seg]), dict);
    const raw = value == null ? key : value;
    return String(raw).replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : params[k]));
  };
}
const t = makeT(en);

test("isActualStatus separates the truthfulness ladder correctly", () => {
  for (const s of ["projected", "simulated", "scheduled"]) assert.equal(isActualStatus(s), false);
  for (const s of ["active", "paused", "revoked", "completed", "observed"]) assert.equal(isActualStatus(s), true);
});

test("buildImpact computes a rounded signed delta and direction", () => {
  assert.deepEqual(buildImpact({ goalId: "home", metric: "monthlyContribution", before: 900, after: 1200, unit: "sgd_per_month" }), {
    goalId: "home",
    metric: "monthlyContribution",
    before: 900,
    after: 1200,
    delta: 300,
    unit: "sgd_per_month",
    direction: "up",
  });
  assert.equal(buildImpact({ goalId: "home", metric: "x", before: null, after: null }).delta, null);
});

test("validateEventDraft rejects malformed / mislabelled drafts", () => {
  assert.equal(validateEventDraft(null).ok, false);
  const bad = validateEventDraft({ profileKey: "u1", actor: "nobody", sourceFeature: "home", actionType: "x", status: "active", messageKey: "k" });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes("invalid_actor"));
  assert.ok(bad.errors.includes("invalid_action_type"));
});

test("validateEventDraft requires either a quantified impact or an honest uncertainty note", () => {
  const draft = {
    profileKey: "u1",
    actor: "user",
    sourceFeature: "wedding",
    actionType: ACTION_TYPES.QUOTE_IMPORTED,
    status: "active",
    messageKey: "changeLedger.event.x",
    impactSet: [],
  };
  assert.equal(validateEventDraft(draft).ok, false);
  assert.ok(validateEventDraft(draft).errors.includes("impact_or_uncertainty_note_required"));

  draft.uncertaintyNote = "Venue quote updated, but guest count still missing - full budget impact unknown.";
  assert.equal(validateEventDraft(draft).ok, true);
});

test("redactForShared strips the other party's raw finances but keeps agreed impact", () => {
  const shared = redactForShared({
    monthlyIncome: 8200,
    currentSavings: 40000,
    jointMonthlyContribution: 1050,
    nested: { salary: 9000, agreedDate: "2028-06" },
  });
  assert.equal(shared.monthlyIncome, "[redacted]");
  assert.equal(shared.currentSavings, "[redacted]");
  assert.equal(shared.jointMonthlyContribution, 1050);
  assert.equal(shared.nested.salary, "[redacted]");
  assert.equal(shared.nested.agreedDate, "2028-06");
});

test("makeDedupeKey is stable and bounded for the same logical event", () => {
  const a = makeDedupeKey(["home", "commitment_created", "abc-123"]);
  const b = makeDedupeKey(["home", "commitment_created", "abc-123"]);
  assert.equal(a, b);
  assert.ok(a.length <= 200);
});

test("home commitment_created producer builds a valid SCHEDULED (not actual) event", () => {
  const draft = buildHomeCommitmentCreatedEvent({
    profileKey: "u1",
    commitmentId: "c-1",
    priorMonthlyContribution: 900,
    newMonthlyContribution: 1200,
    effectiveMonth: "2026-10",
    readyMonthBefore: "2031-02",
    readyMonthAfter: "2030-11",
    monthsDelta: -3,
    reasonCode: "behind_pace",
    reasonParams: {},
    emergencyFloorMonths: 6,
  });
  assert.equal(validateEventDraft(draft).ok, true);
  assert.equal(draft.status, "scheduled");
  assert.equal(isActualStatus(draft.status), false);
  assert.equal(draft.impactSet[0].before, 900);
  assert.equal(draft.impactSet[0].after, 1200);
  assert.equal(draft.dedupeKey, makeDedupeKey(["home", "commitment_created", "c-1"]));
});

test("home commitment_revoked producer supersedes the create event and restores the prior amount", () => {
  const draft = buildHomeCommitmentRevokedEvent({
    profileKey: "u1",
    commitmentId: "c-1",
    supersedesEventId: "e-create-1",
    restoredMonthlyContribution: 900,
    adjustedMonthlyContribution: 1200,
  });
  assert.equal(validateEventDraft(draft).ok, true);
  assert.equal(draft.status, "revoked");
  assert.equal(draft.supersedesEventId, "e-create-1");
  assert.equal(draft.afterSnapshot.monthlyContribution, 900);
  assert.equal(draft.impactSet[0].after, 900);
});

test("home commitment_paused producer is a Guardian actor event that zeroes counted outflow", () => {
  const draft = buildHomeCommitmentPausedEvent({
    profileKey: "u1",
    commitmentId: "c-1",
    monthlyContribution: 1200,
    emergencyBufferMonths: 5.6,
    emergencyFloorMonths: 6,
  });
  assert.equal(validateEventDraft(draft).ok, true);
  assert.equal(draft.actor, "guardian");
  assert.equal(draft.status, "paused");
  assert.equal(draft.afterSnapshot.countedMonthlyOutflow, 0);
  assert.equal(draft.impactSet.find((i) => i.goalId === "home").after, 0);
});

test("formatEvent renders headline + impact lines + truthfulness for a created commitment (EN and ZH)", () => {
  const stored = {
    action_type: "commitment_created",
    status: "scheduled",
    before_snapshot: { monthlyContribution: 900 },
    after_snapshot: { monthlyContribution: 1200, effectiveMonth: "2026-10" },
    impact_set: [
      { goalId: "home", metric: "monthlyContribution", before: 900, after: 1200, delta: 300, unit: "sgd_per_month", direction: "up" },
      { goalId: "home", metric: "targetDate", before: 0, after: -3, delta: -3, unit: "months", direction: "up" },
    ],
    message_key: "changeLedger.event.commitment_created.headline",
    message_params: { amount: 1200, month: "2026-10" },
    occurred_at: "2026-08-29T00:00:00Z",
    actor: "user",
    source_feature: "home",
  };
  const out = formatEvent(stored, t);
  assert.match(out.headline, /1200/);
  assert.equal(out.isActual, false);
  assert.equal(out.impactLines.length, 2);
  assert.match(out.impactLines[0].text, /900|1200/);
  assert.match(out.impactLines[1].text, /3/);

  const outZh = formatEvent(stored, makeT(zh));
  assert.match(outZh.headline, /1200/);
  assert.match(outZh.statusLabel, /已安排/);
});

test("formatImpactReceipt is the compact 1-3 impact view with truthfulness", () => {
  const stored = {
    action_type: "commitment_paused",
    status: "paused",
    cause: { emergencyFloorMonths: 6, emergencyBufferMonths: 5.6 },
    before_snapshot: {},
    after_snapshot: {},
    impact_set: [
      { goalId: "home", metric: "monthlyContribution", before: 1200, after: 0, delta: -1200, unit: "sgd_per_month", direction: "down" },
    ],
    message_key: "changeLedger.event.commitment_paused.headline",
    message_params: {},
    occurred_at: "2026-08-29T00:00:00Z",
    actor: "guardian",
    source_feature: "guardian",
  };
  const receipt = formatImpactReceipt(stored, t);
  assert.equal(receipt.isActual, true);
  assert.equal(receipt.truthfulnessKey, "paused");
  assert.ok(receipt.topImpacts.length >= 1 && receipt.topImpacts.length <= 3);
  assert.match(receipt.headline, /Guardian/);
});

test("every message_key referenced by the home producers resolves in EN and ZH", () => {
  const keys = [
    "changeLedger.event.commitment_created.headline",
    "changeLedger.event.commitment_created.detail",
    "changeLedger.event.commitment_revoked.headline",
    "changeLedger.event.commitment_revoked.detail",
    "changeLedger.event.commitment_paused.headline",
    "changeLedger.event.commitment_paused.detail",
    "changeLedger.status.scheduled",
    "changeLedger.status.revoked",
    "changeLedger.status.paused",
  ];
  for (const key of keys) {
    assert.notEqual(makeT(en)(key), key, `missing EN: ${key}`);
    assert.notEqual(makeT(zh)(key), key, `missing ZH: ${key}`);
  }
});
