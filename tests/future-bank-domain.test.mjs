import test from "node:test";
import assert from "node:assert/strict";
import { computeSafeToSpend } from "../lib/financial-twin/safe-to-spend.js";
import { projectFutureBalance, CONFIDENCE } from "../lib/financial-twin/future-balance.js";
import { detectRescueCases, RESCUE_KINDS } from "../lib/money-rescue/detect.js";
import { detectRealityDrift, summariseObserved } from "../lib/reality-drift/detect.js";
import { buildCurrentRipple } from "../lib/ripple/build.js";
import { isLightweightTransaction } from "../lib/ripple/record.js";

const twin = (o = {}) => ({
  currency: "SGD",
  liquidAssets: 12000,
  protectedAssets: 3000,
  committedMonthlyTotal: 500,
  monthlyFreeCashflow: 1200,
  liabilitiesByClass: {},
  ...o,
});

// ---- Safe-to-Spend --------------------------------------------------

test("Safe-to-Spend subtracts near-term bills, the protected reserve and committed money exactly once each", () => {
  const r = computeSafeToSpend({
    twin: twin(),
    obligations: [
      { label: "Rent", amount: 1800, dueDate: "2026-09-05", kind: "bill" },
      { label: "Card", amount: 400, dueDate: "2026-09-20", kind: "bill" }, // after next income -> excluded
    ],
    inflows: [{ label: "Salary", amount: 8000, expectedDate: "2026-09-10", confidence: "expected" }],
    now: "2026-09-01",
  });
  assert.equal(r.breakdown.postedLiquidCash, 12000);
  assert.equal(r.breakdown.nearTermObligations, 1800, "only the bill due before next income");
  assert.equal(r.breakdown.protectedReserve, 3000);
  assert.equal(r.breakdown.alreadyCommitted, 500);
  assert.equal(r.safeToSpend, 12000 - 1800 - 3000 - 500);
  assert.equal(r.belowProtectedFloor, false);
  assert.equal(r.nextIncome.inDays, 9);
});

test("Safe-to-Spend flags when scheduled payments would push below the protected floor", () => {
  const r = computeSafeToSpend({
    twin: twin({ liquidAssets: 4000 }),
    obligations: [{ label: "Rent", amount: 2000, dueDate: "2026-09-03" }],
    inflows: [{ label: "Salary", amount: 8000, expectedDate: "2026-09-12" }],
    now: "2026-09-01",
  });
  assert.equal(r.safeToSpend, 0, "clamped at zero");
  assert.equal(r.belowProtectedFloor, true);
  assert.equal(r.projectedLowBalanceBeforeIncome, 4000 - 2000 - 3000 - 500);
});

// ---- Future Balance -----------------------------------------------

test("Future Balance labels every point by the weakest confidence of the events applied", () => {
  const r = projectFutureBalance({
    startingLiquid: 5000,
    now: "2026-09-01",
    nextPayday: "2026-09-25",
    nextBillDate: "2026-09-05",
    events: [
      { date: "2026-09-05", amount: -1500, label: "Rent", confidence: "confirmed" },
      { date: "2026-09-25", amount: 8000, label: "Salary", confidence: "expected" },
      { date: "2026-09-28", amount: -600, label: "Wedding branch contribution", confidence: "conditional" },
    ],
  });
  const byId = Object.fromEntries(r.points.map((p) => [p.id, p]));
  assert.equal(byId.today.balance, 5000);
  assert.equal(byId.today.confidence, "confirmed");
  assert.equal(byId.next_bill.balance, 3500);
  assert.equal(byId.next_bill.confidence, "confirmed");
  assert.equal(byId.next_payday.balance, 11500);
  assert.equal(byId.next_payday.confidence, "expected", "salary is expected, not confirmed");
  assert.equal(byId.in_30_days.confidence, "conditional", "the conditional branch contribution is now in range");
  assert.ok(CONFIDENCE.includes(byId.in_90_days.confidence));
  assert.equal(byId.goal_date.date, null);
  assert.equal(r.hasUnknownHorizon, true);
  assert.ok(r.lowestPoint);
});

// ---- Money Rescue ----------------------------------------------

test("Money Rescue: a failed payment produces a calm, actionable case (not just an alert)", () => {
  const cases = detectRescueCases({
    twin: twin(),
    transactions: [{ id: "t1", status: "failed", channel: "paynow", amount: 120, merchant: "SP Utilities", recurringGroup: "rg-utils" }],
    now: "2026-09-01",
  });
  const c = cases.find((x) => x.kind === "payment_failed");
  assert.ok(c);
  assert.match(c.whatHappened, /did not go through/);
  assert.ok(c.whyItMatters.length > 0);
  assert.ok(Array.isArray(c.options) && c.options.length >= 2);
  assert.ok(c.recommendedAction);
  assert.deepEqual(c.resolutionActions, ["snooze", "dismiss", "resolve"]);
  assert.ok(RESCUE_KINDS.includes(c.kind));
});

test("Money Rescue: low-balance-ahead reads Safe-to-Spend; duplicate subscription merges to one case", () => {
  const safe = computeSafeToSpend({
    twin: twin({ liquidAssets: 4000 }),
    obligations: [{ label: "Rent", amount: 2000, dueDate: "2026-09-03" }],
    inflows: [{ label: "Salary", amount: 8000, expectedDate: "2026-09-12" }],
    now: "2026-09-01",
  });
  const cases = detectRescueCases({
    twin: twin({ liquidAssets: 4000 }),
    safeToSpend: safe,
    commitments: [{ domain: "wedding", monthlyContribution: 500 }],
    recurring: [
      { active: true, merchant: "Netflix", label: "Netflix", monthlyAmount: 19.99 },
      { active: true, merchant: "netflix", label: "Netflix Premium", monthlyAmount: 22.99 },
    ],
    now: "2026-09-01",
  });
  assert.ok(cases.some((c) => c.kind === "low_balance_ahead"));
  const dups = cases.filter((c) => c.kind === "duplicate_subscription");
  assert.equal(dups.length, 1, "one merged case, not two");
});

// ---- Reality Drift ------------------------------------------

test("Reality Drift does NOT fire before the observation window is met", () => {
  const r = detectRealityDrift({
    planned: { monthlyEssentials: 2240 },
    observed: { essentialsAvg: 2600, monthsObserved: 2 },
  });
  assert.equal(r.drifted, false);
  assert.equal(r.reason, "insufficient_observation");
});

test("Reality Drift fires once observed >= window AND the gap is material; a single spike is absorbed by the average", () => {
  const observed = summariseObserved([
    { month: "2026-06", essentials: 2240, income: 8000, contribution: 500 },
    { month: "2026-07", essentials: 2260, income: 8000, contribution: 500 },
    { month: "2026-08", essentials: 2730, income: 8000, contribution: 500 }, // one heavier month
  ]);
  const r = detectRealityDrift({
    planned: { monthlyEssentials: 2240, monthlyIncome: 8000, monthlyContribution: 500 },
    observed,
    monthsPerImpactUnit: 1 / 170, // ~1 month per 170 of extra monthly essentials
  });
  assert.equal(r.monthsObserved, 3);
  assert.equal(r.drifted, true);
  const c = r.cases.find((x) => x.metric === "monthly_essentials");
  assert.ok(c);
  assert.equal(c.direction, "higher");
  assert.equal(c.favourable, false);
  assert.match(c.summary, /plan assumed SGD 2240/);
  assert.match(c.summary, /3-month observed average/);
  assert.deepEqual(c.options, ["accept_new_reality", "keep_original_plan", "open_mirror"]);
  // income + contribution held steady -> no drift on those
  assert.equal(r.cases.some((x) => x.metric === "monthly_income"), false);
});

// ---- Current Ripple view -----------------------------------

test("buildCurrentRipple formats persisted rows and never computes new numbers", () => {
  const view = buildCurrentRipple([
    {
      id: "r1", kind: "studio_impact", domain: "wedding", cause: "guest_count 90 -> 150", monthlyDelta: 280,
      affectedGoals: [{ goalId: "home", metric: "monthsToReady", before: 24, after: 26, direction: "up" }],
      state: "possible", severity: "turning_point", occurredAt: "2026-09-01",
    },
    { id: "r2", kind: "transaction_change", cause: "A payment of SGD 900 to Furniture Co", monthlyDelta: null, affectedGoals: [], state: "confirmed", severity: "information", occurredAt: "2026-08-31" },
  ]);
  assert.equal(view.count, 2);
  assert.equal(view.mostRecent.id, "r1");
  assert.equal(view.turningPointCount, 1);
  assert.equal(view.events[0].confidence, "conditional", "a possible ripple is conditional");
  assert.equal(view.events[1].confidence, "confirmed");
  assert.deepEqual(view.events[0].nextActions, ["compare", "undo", "seal"]);
  assert.match(view.headline, /guest_count 90 -> 150/);
});

test("isLightweightTransaction: small everyday spend is lightweight; failures / salary / large spend are not", () => {
  assert.equal(isLightweightTransaction({ status: "posted", direction: "debit", amount: 12 }, { medianSpend: 30 }), true);
  assert.equal(isLightweightTransaction({ status: "failed", direction: "debit", amount: 12 }), false);
  assert.equal(isLightweightTransaction({ status: "posted", direction: "credit", channel: "salary", amount: 8000 }), false);
  assert.equal(isLightweightTransaction({ status: "posted", direction: "debit", amount: 900 }, { medianSpend: 40 }), false);
});
