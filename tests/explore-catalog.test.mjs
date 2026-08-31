import test from "node:test";
import assert from "node:assert/strict";
import { EXPLORE_GROUPS, allExploreEntries, NINE_STUDIOS } from "../app/components/bank/explore-catalog.js";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");

test("the Explore catalog exposes all five sections", () => {
  assert.deepEqual(
    EXPLORE_GROUPS.map((g) => g.id),
    ["bank_now", "understand_money", "solve_problem", "plan_life", "decide_protect_remember"],
  );
});

test("all nine Studios are listed in 'Plan my life' with a problem, reads, result and CTA", () => {
  const plan = EXPLORE_GROUPS.find((g) => g.id === "plan_life");
  for (const domain of NINE_STUDIOS) {
    const row = plan.entries.find((e) => e.id === domain);
    assert.ok(row, `${domain} is in the catalog`);
    assert.ok(row.problem && row.problem.length > 8, `${domain} states the problem it solves`);
    assert.ok(Array.isArray(row.reads), `${domain} declares what bank data it reads`);
    assert.ok(row.result && row.result.length > 5, `${domain} states what it produces`);
    assert.ok(row.cta, `${domain} has a CTA screen`);
  }
});

test("core bank capabilities are all directly listed (not hidden)", () => {
  const ids = new Set(allExploreEntries().map((e) => e.id));
  for (const need of [
    "accounts", "pay", "scan_pay", "transfer", "fx", "cards", "transactions", "bills",
    "financial_twin", "spending_timeline", "safe_to_spend", "future_balance",
    "money_rescue", "mirror", "guardian", "shared_money", "financial_history",
  ]) {
    assert.ok(ids.has(need), `Explore lists "${need}"`);
  }
});

test("the Explore screen renders the catalog directly and NOT inside a closed <details>", () => {
  const src = read("app/features/explore/ExploreScreen.jsx");
  assert.match(src, /<ExploreCatalog\b/, "the full catalog component is rendered");
  assert.doesNotMatch(src, /<details className="exploreAllAreas"/, "the old closed drawer is gone");
  assert.doesNotMatch(src, /exploreAllGrid/, "the old 3x3 grid is gone");
});

test("every catalog entry has a unique id", () => {
  const ids = allExploreEntries().map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
