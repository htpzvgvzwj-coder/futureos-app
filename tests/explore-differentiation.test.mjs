import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFutureReceipt, receiptFromLedgerEvent, traceSecondOrder,
  costOfDelay, nextBestQuestion, negativeRecommendations, stressTest,
} from "../lib/explore/differentiation.js";

// 1. Future Receipt

test("a Future Receipt names the trade-off in before -> after terms", () => {
  const r = buildFutureReceipt({
    title: "Home 12 months sooner",
    changes: [
      { label: "Emergency buffer", before: 5.2, after: 3.8, unit: "months" },
      { label: "Monthly room", before: 1600, after: 940, unit: "sgd" },
    ],
  });
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].direction, "down");
  assert.match(r.summary, /Emergency buffer 5\.2 mo → 3\.8 mo/);
  assert.equal(r.hasCost, true);
});

test("receiptFromLedgerEvent reads a Change Ledger event's impact_set", () => {
  const ev = {
    message_key: "Wedding plan adjusted",
    impact_set: [
      { goalId: "wedding", metric: "monthlyContribution", before: 1500, after: 1000, unit: "sgd_per_month" },
      { goalId: "home", metric: "readyMonthShift", before: 0, after: -2, unit: "date_shift_months" },
    ],
  };
  const r = receiptFromLedgerEvent(ev);
  assert.ok(r.lines.length >= 1);
  assert.equal(r.title, "Wedding plan adjusted");
});

// 2. Second-order impact

test("traceSecondOrder ends in a Guardian consequence", () => {
  const lt = {
    crossGoalEdges: [
      { from: "home", to: "safety", basis: "deposit saving vs emergency floor", direction: "flat" },
      { from: "safety", to: "future", basis: "buffer below floor delays long-term", direction: "flat" },
    ],
  };
  const c = traceSecondOrder({ primaryDomain: "home", direction: "earlier", lt });
  assert.equal(c.chain[0].node, "Home");
  assert.ok(c.chain.some((s) => s.node === "Safety"));
  assert.equal(c.chain[c.chain.length - 1].isGuardian, true);
});

// 3. Cost of Delay

test("costOfDelay gives now / sooner / later rows with a buffer column", () => {
  const c = costOfDelay({
    domain: "home", monthlyContribution: 1500, readyYear: 2031,
    twin: { essentialMonthly: 3600, bufferMonths: 23.6, monthlyRoom: 1400 },
  });
  const now = c.rows.find((r) => r.delta === 0);
  const sooner = c.rows.find((r) => r.delta === -12);
  assert.equal(now.readyYear, 2031);
  assert.equal(sooner.readyYear, 2030);
  assert.ok(sooner.bufferMonthsAfter < now.bufferMonthsAfter, "buying sooner costs buffer");
  assert.ok(sooner.monthlyRoomAfter <= now.monthlyRoomAfter);
});

test("costOfDelay returns null without a real contribution", () => {
  assert.equal(costOfDelay({ domain: "home", monthlyContribution: 0, twin: { essentialMonthly: 3600 } }), null);
});

// 4. One Question Upgrade

test("nextBestQuestion returns the highest-priority input not yet known", () => {
  assert.equal(nextBestQuestion({ domain: "home", known: [] }).id, "downpayment_savings");
  assert.equal(nextBestQuestion({ domain: "home", known: ["downpayment_savings"] }).id, "target_price");
  assert.equal(nextBestQuestion({ domain: "home", known: ["downpayment_savings", "target_price", "monthly_contribution"] }), null);
});

// 5. Negative Recommendation

test("negativeRecommendations warns off spending when bills are imminent", () => {
  const n = negativeRecommendations({
    lt: {},
    s2s: { safeToSpend: 1200, breakdown: { nearTermObligations: 1000 }, nextIncome: { inDays: 5 } },
  });
  assert.ok(n.items.some((i) => i.code === "bills_incoming"));
  assert.match(n.items.find((i) => i.code === "bills_incoming").because, /5 days/);
});

test("negativeRecommendations flags an already-stretched month", () => {
  const n = negativeRecommendations({
    lt: { promiseWeight: { pressureWindow: { shortfall: 1100, driverCommitments: [{ domain: "home" }, { domain: "wedding" }] } } },
    s2s: {},
  });
  assert.ok(n.items.some((i) => i.code === "already_stretched"));
});

// 6. Future Stress Test

test("stressTest reports runway and whether a 1-month income stop survives", () => {
  const s = stressTest({
    lt: { monthlyCommittedTotal: 2500, commitments: [{ domain: "home", monthlyContribution: 1500 }, { domain: "wedding", monthlyContribution: 1000 }] },
    twin: { essentialMonthly: 3600, liquidBuffer: 85000 },
    shock: "income_1mo",
  });
  assert.equal(s.survivesShock, true);
  assert.ok(s.monthsOfRunway >= 1);
  assert.equal(s.weakestPlan.domain, "home");
});

test("stressTest shows the break point when the buffer is thin", () => {
  const s = stressTest({
    lt: { monthlyCommittedTotal: 2500, commitments: [] },
    twin: { essentialMonthly: 3600, liquidBuffer: 4000 },
    shock: "income_3mo",
  });
  assert.equal(s.survivesShock, false);
  assert.ok(s.shortBy > 0);
  assert.match(s.breaksAt, /month \d/);
});
