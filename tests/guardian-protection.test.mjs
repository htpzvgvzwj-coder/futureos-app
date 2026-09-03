// Protected by Guardian — seven domains, each a plain status derived from
// the real Twin + Money Moment payload.

import test from "node:test";
import assert from "node:assert/strict";
import { buildProtectionDomains, PROTECTION_DOMAINS } from "../lib/guardian/protection.js";

test("empty account: everyday / bills / safety / plans are 'unknown', not fake-protected", () => {
  const { domains, summary } = buildProtectionDomains({ twin: { isEmpty: true }, mm: { isEmpty: true, moments: [] } });
  assert.equal(domains.length, 7);
  assert.deepEqual(domains.map((d) => d.id), PROTECTION_DOMAINS);
  for (const id of ["everyday_money", "bills", "safety_floor", "active_plans"]) {
    assert.equal(domains.find((d) => d.id === id).status, "unknown");
  }
  assert.equal(summary.protectedCount <= summary.total, true);
});

test("healthy account: most domains protected, count reflects it", () => {
  const { domains, summary } = buildProtectionDomains({
    twin: { balanceBreakdown: { availableNow: 2000, spokenFor: 500 }, liquidAssets: 8000, liabilitiesByClass: {}, plansCount: 2 },
    mm: { moments: [], bankNow: { belowProtectedFloor: false, nextEvent: { kind: "income", label: "salary" } }, planMovement: [] },
  });
  assert.equal(domains.find((d) => d.id === "safety_floor").status, "protected");
  assert.equal(domains.find((d) => d.id === "credit_pressure").status, "protected");
  assert.ok(summary.protectedCount >= 4);
  assert.match(summary.nextCheck, /salary/i);
});

test("below the floor -> safety_floor and everyday_money go at_risk", () => {
  const { domains } = buildProtectionDomains({
    twin: { balanceBreakdown: {}, liabilitiesByClass: {}, plansCount: 1 },
    mm: { moments: [], bankNow: { belowProtectedFloor: true }, planMovement: [] },
  });
  assert.equal(domains.find((d) => d.id === "safety_floor").status, "at_risk");
  assert.equal(domains.find((d) => d.id === "everyday_money").status, "at_risk");
});

test("a card balance above reachable cash -> credit_pressure at_risk", () => {
  const { domains } = buildProtectionDomains({
    twin: { balanceBreakdown: { availableNow: 300 }, liquidAssets: 300, liabilitiesByClass: { credit_card_revolving: 1200 } },
    mm: { moments: [], bankNow: {}, planMovement: [] },
  });
  assert.equal(domains.find((d) => d.id === "credit_pressure").status, "at_risk");
});

test("an unusual-transaction moment -> account_safety watching; every domain has checks", () => {
  const { domains } = buildProtectionDomains({
    twin: { balanceBreakdown: {}, liabilitiesByClass: {} },
    mm: { moments: [{ state: "new", id: "u1", title: "Unusual repeated payment", summary: "same merchant twice" }], bankNow: {}, planMovement: [] },
  });
  assert.equal(domains.find((d) => d.id === "account_safety").status, "watching");
  for (const d of domains) assert.ok(Array.isArray(d.checks) && d.checks.length > 0);
});
