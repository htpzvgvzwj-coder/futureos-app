// Life Pressure Weather forecast + Ask-the-Line suggestions/simulate. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { buildPressureForecast, forecastHeadline } from "../lib/life/forecast.js";
import { answerLineQuestion, lineSuggestions } from "../lib/life/ask.js";

const now = new Date("2026-09-15T00:00:00Z");
const inDays = (d) => new Date(now.getTime() + d * 86400000).toISOString().slice(0, 10);

test("forecast: a month where non-monthly charges cluster reads tight/exposed", () => {
  const f = buildPressureForecast({
    incomeMonthly: 6000,
    committedMonthly: 1450,
    freeMonthly: 1200,
    obligations: [
      { label: "Rent", cadence: "monthly", monthlyAmount: 1300 },
      { label: "Utilities", cadence: "monthly", monthlyAmount: 200 },
      { label: "Insurance premium (annual)", cadence: "annual", monthlyAmount: 936, nextDueDate: inDays(56) },
      { label: "Wedding venue deposit", cadence: "one_off", monthlyAmount: 3000, nextDueDate: inDays(62) },
    ],
    now,
  });
  // baseline = 1300 + 200 + 1450 = 2950; November gets +936 +3000 -> 6886 > 6000
  const nov = f.months.find((m) => m.ym === "2026-11");
  assert.ok(nov, "November is in the horizon");
  assert.equal(nov.pressure, "exposed");
  assert.deepEqual(nov.drivers.sort(), ["Insurance premium (annual)", "Wedding venue deposit"]);

  const head = forecastHeadline(f);
  assert.match(head.params.month, /November/);
  assert.match(head.params.drivers, /Insurance premium \(annual\) and Wedding venue deposit/);
});

test("forecast: an ordinary month with only monthly bills is calm", () => {
  const f = buildPressureForecast({
    incomeMonthly: 6000,
    committedMonthly: 1000,
    freeMonthly: 1500,
    obligations: [{ label: "Rent", cadence: "monthly", monthlyAmount: 1300 }],
    now,
  });
  assert.ok(f.months.every((m) => m.pressure === "calm"));
  assert.equal(forecastHeadline(f), null);
});

test("forecast: a quarterly charge recurs into the right month", () => {
  const f = buildPressureForecast({
    incomeMonthly: 4000,
    committedMonthly: 0,
    freeMonthly: 300,
    obligations: [
      { label: "Rent", cadence: "monthly", monthlyAmount: 1200 },
      { label: "Quarterly fee", cadence: "quarterly", monthlyAmount: 2600, nextDueDate: inDays(20) },
    ],
    now,
  });
  // due ~Oct 5, recurs Jan/Apr/... — Oct should carry it
  const oct = f.months.find((m) => m.ym === "2026-10");
  assert.ok(oct.drivers.includes("Quarterly fee"));
});

test("Ask the Line: 'what if I pause X' returns a real simulate override", () => {
  const lt = { commitments: [{ domain: "wedding", monthlyContribution: 500, status: "active" }] };
  const a = answerLineQuestion("what if I pause the wedding", { lt });
  assert.equal(a.simulate.domain, "wedding");
  assert.deepEqual(a.simulate.overrides, { monthly_contribution: 0 });
});

test("Ask the Line: 'can I afford a home in 5 years' returns a target_complete_month branch", () => {
  const a = answerLineQuestion("can I afford a home in 5 years?", { lt: {} });
  assert.equal(a.simulate.domain, "home");
  assert.match(a.simulate.overrides.target_complete_month, /^\d{4}-\d{2}$/);
});

test("Ask the Line: 'spend SGD 1000 now' is honest text, no branch", () => {
  const a = answerLineQuestion("what happens if I spend SGD 1000 now", { lt: { availableMonthlyCashflow: 1500 } });
  assert.equal(a.simulate, undefined);
  assert.match(a.text, /SGD 500 free this month/);
});

test("lineSuggestions adapts to the account", () => {
  const s = lineSuggestions({
    lt: { commitments: [{ domain: "home", monthlyContribution: 700, status: "active" }, { domain: "wedding", monthlyContribution: 500, status: "active" }] },
  });
  assert.ok(s.length === 3);
  assert.ok(s.some((x) => /afford a home/i.test(x)));
  assert.ok(s.some((x) => /pause Home/i.test(x)));
});
