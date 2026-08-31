import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalSnapshot, committedExcludingDomain } from "../lib/life-thread/canonical-snapshot.js";
import { collectStudioImpacts } from "../lib/life-thread/cross-studio-impact.js";

test("committedExcludingDomain removes a domain's OWN active commitment exactly once", () => {
  const snap = buildCanonicalSnapshot({
    committedMonthlyTotal: 1200,
    commitmentsByDomain: { wedding: 400, retirement: 300 },
  });
  // wedding's projector must see the other 800, not the full 1200 (which
  // would count wedding's own sealed branch as external pressure too).
  assert.equal(committedExcludingDomain(snap, "wedding"), 800);
  assert.equal(committedExcludingDomain(snap, "retirement"), 900);
  // a domain with no commitment of its own sees the whole total
  assert.equal(committedExcludingDomain(snap, "home"), 1200);
});

test("the snapshotId is stable for the same baseline and changes when the baseline changes", () => {
  const a = buildCanonicalSnapshot({ committedMonthlyTotal: 1000, monthlyIncome: 8000, commitmentsByDomain: { wedding: 400 } });
  const b = buildCanonicalSnapshot({ committedMonthlyTotal: 1000, monthlyIncome: 8000, commitmentsByDomain: { wedding: 400 } });
  const c = buildCanonicalSnapshot({ committedMonthlyTotal: 1000, monthlyIncome: 7000, commitmentsByDomain: { wedding: 400 } });
  assert.equal(a.snapshotId, b.snapshotId);
  assert.notEqual(a.snapshotId, c.snapshotId);
  // generatedAt is NOT part of the identity
  const d = buildCanonicalSnapshot({ committedMonthlyTotal: 1000, monthlyIncome: 8000, commitmentsByDomain: { wedding: 400 }, generatedAt: "2030-01-01T00:00:00Z" });
  assert.equal(a.snapshotId, d.snapshotId);
});

test("collectStudioImpacts stamps ONE snapshotId on the result and every measure", async () => {
  const REALITY = {
    "p-travel": { destination_type: "regional", comfort_tier: "mid", travellers: 2, nights: 8, trip_month: "2027-06", monthly_contribution: 300, current_savings: 4000, monthly_income: 7000, monthly_expenses: 3800 },
  };
  const branchesByPlan = [
    { plan: { domain: "travel", id: "p-travel" }, branches: [{ id: "b1", status: "active", data: { ...REALITY["p-travel"], travellers: 4, nights: 16 } }] },
  ];
  const out = await collectStudioImpacts({
    branchesByPlan,
    planStore: { getCurrentPlanVersion: async (id) => ({ data: REALITY[id] ?? null }) },
    threadContext: { monthlyIncome: 7000, monthlyExpenses: 3800, committedMonthlyTotal: 900, commitmentsByDomain: { travel: 300 } },
  });
  assert.ok(out.snapshotId, "the result carries a snapshotId");
  assert.equal(out.canonicalSnapshot.committedExcludingDomain.travel, 600, "travel's own 300 is removed once");
  for (const m of out.measures) assert.equal(m.snapshotId, out.snapshotId, "every measure is stamped with the one snapshot");
});
