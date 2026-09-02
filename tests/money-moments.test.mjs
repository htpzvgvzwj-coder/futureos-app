import test from "node:test";
import assert from "node:assert/strict";
import { dedupeMoments, ORDER_RANK, MONEY_MOMENT_CONTRACT_VERSION } from "../lib/money-moments/build.js";
import { effectiveState } from "../lib/money-moments/state-store.js";

// ---- dedupe: one underlying event, one moment ---------------------

test("the same source event across detector / Ripple / Ledger collapses to one moment, source refs merged", () => {
  const rescue = {
    id: "rescue:large_unusual_spend:txn-1",
    _priority: 0,
    _dedupeRefs: ["txn:txn-1"],
    sourceRefs: [{ kind: "rescue_case", id: "large_unusual_spend:txn-1" }],
  };
  const ripple = {
    id: "ripple:r-1",
    _priority: 1,
    _dedupeRefs: ["txn:txn-1", "ripple:r-1"],
    sourceRefs: [{ kind: "ripple_event", id: "r-1" }],
  };
  const kept = dedupeMoments([ripple, rescue]);
  assert.equal(kept.length, 1, "one moment survives");
  assert.equal(kept[0].id, "rescue:large_unusual_spend:txn-1", "the higher-fidelity detector moment wins");
  assert.deepEqual(
    kept[0].sourceRefs.map((s) => s.kind).sort(),
    ["rescue_case", "ripple_event"],
    "both origins are still referenced",
  );
});

test("unrelated moments are all kept", () => {
  const a = { id: "a", _priority: 0, _dedupeRefs: ["txn:1"], sourceRefs: [] };
  const b = { id: "b", _priority: 1, _dedupeRefs: ["plan:home"], sourceRefs: [] };
  const c = { id: "c", _priority: 2, _dedupeRefs: ["drift:monthly_income"], sourceRefs: [] };
  assert.equal(dedupeMoments([a, b, c]).length, 3);
});

// ---- ordering: action_required -> watch -> confirmed -> plan -> calm ---

test("ORDER_RANK enforces the required section order", () => {
  assert.equal(ORDER_RANK({ severity: "action_required" }), 0);
  assert.equal(ORDER_RANK({ severity: "watch", sourceType: "detected_problem" }), 1);
  assert.equal(ORDER_RANK({ severity: "information", sourceType: "confirmed_change" }), 2);
  assert.equal(ORDER_RANK({ severity: "watch", sourceType: "plan_impact" }), 3);
  assert.equal(ORDER_RANK({ severity: "information", sourceType: "reality_drift" }), 4);
  assert.equal(ORDER_RANK({ severity: "calm", sourceType: "turning_point" }), 4);
});

// ---- lifecycle: never lost to React; auto-reopen on evidence change ----

test("effectiveState: new when nothing stored", () => {
  assert.deepEqual(effectiveState(undefined, "hash-1"), { state: "new", reopened: false });
});

test("effectiveState: a resolved moment stays resolved while evidence is unchanged", () => {
  const stored = { state: "resolved", evidenceHash: "hash-1", snoozedUntil: null };
  assert.deepEqual(effectiveState(stored, "hash-1"), { state: "resolved", reopened: false });
});

test("effectiveState: a resolved moment REOPENS when its evidence hash changes", () => {
  const stored = { state: "resolved", evidenceHash: "hash-1", snoozedUntil: null };
  assert.deepEqual(effectiveState(stored, "hash-2"), { state: "new", reopened: true });
});

test("effectiveState: a snooze expires back to new", () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  assert.equal(effectiveState({ state: "snoozed", evidenceHash: "h", snoozedUntil: past }, "h").state, "new");
  assert.equal(effectiveState({ state: "snoozed", evidenceHash: "h", snoozedUntil: future }, "h").state, "snoozed");
});

// ---- contract ----------------------------------------------------

test("the MoneyMoment contract version is pinned", () => {
  assert.match(MONEY_MOMENT_CONTRACT_VERSION, /^\d+\.\d+\.\d+$/);
});

// ---- the API route + provider wiring exist (no browser) --------

import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");

test("GET/POST /api/money-moments exists and POST persists lifecycle + audit + ledger", () => {
  const src = read("app/api/money-moments/route.js");
  assert.match(src, /buildMoneyMoments/);
  assert.match(src, /setMomentState/);
  assert.match(src, /recordAuditEvent/);
  assert.match(src, /recordEventSafe/, "a Change Ledger event is written for every action");
});

test("the aggregator reuses builders, never calls an API from the server", () => {
  const src = read("lib/money-moments/build.js");
  assert.match(src, /buildFinancialTwinBundle/);
  assert.match(src, /buildLifeThread/);
  assert.match(src, /listRippleEvents/);
  assert.match(src, /listEvents/);
  assert.doesNotMatch(src, /fetch\(["'`]?\/api/, "no api-to-api calls");
});

test("FutureBankDataProvider is the one client data source and refetches all five together", () => {
  const src = read("app/components/future-bank/FutureBankDataProvider.jsx");
  assert.match(src, /refetchAll/);
  for (const ep of ["/api/financial-twin", "/api/money-moments", "/api/life-thread", "/api/ripple", "/api/change-ledger"]) {
    assert.ok(src.includes(ep), `loads ${ep}`);
  }
  assert.match(src, /act\b/, "exposes a server-persisted action");
});
