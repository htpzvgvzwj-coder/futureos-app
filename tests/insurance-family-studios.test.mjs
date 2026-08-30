import test from "node:test";
import assert from "node:assert/strict";
import { getFutureFieldAdapter, futureFieldSupportedDomains } from "../lib/future-field/adapters.js";
import { computeProtectionEnvelope } from "../lib/insurance/protection-finance.js";
import { computeFamilyConstellation, blindMerge } from "../lib/family/constellation-finance.js";

const ins = getFutureFieldAdapter("insurance");
const fam = getFutureFieldAdapter("family");

test("insurance + family are registered Future Field domains (9/9 now)", () => {
  const d = futureFieldSupportedDomains();
  assert.equal(d.length, 9);
  assert.ok(d.includes("insurance") && d.includes("family"));
});

test("protection envelope: an UNKNOWN node is never counted as a gap", () => {
  const e = computeProtectionEnvelope({
    planData: {
      monthly_expenses: 4000,
      existing_income_protection: 30000,
      // home_loan_outstanding omitted -> unknown
      // dependents omitted -> unknown
      annual_care_cost: 20000,
      existing_ci_cover: 0,
    },
  });
  const homeLoan = e.nodes.find((n) => n.id === "home_loan");
  assert.equal(homeLoan.status, "unknown");
  assert.equal(homeLoan.gapAmount, null, "unknown -> no gap number");
  assert.ok(e.unknownCount >= 1);
  // care IS known (both figures given) and has a gap
  const care = e.nodes.find((n) => n.id === "care");
  assert.equal(care.status, "known");
  assert.ok(care.gapAmount > 0);
});

test("protection envelope: closing a KNOWN gap costs a reference premium (never a quote)", () => {
  const e = computeProtectionEnvelope({
    planData: { monthly_expenses: 4000, income_protection_months: 12, existing_income_protection: 0, home_loan_outstanding: 0, existing_life_cover: 0, dependents: 0, annual_care_cost: 0, existing_ci_cover: 0 },
  });
  const income = e.nodes.find((n) => n.id === "income");
  assert.equal(income.status, "known");
  assert.equal(income.gapAmount, 48000);
  assert.ok(e.premiumToCloseKnownGaps > 0);
  assert.ok(e.assumptions.some((a) => /unknowns are shown as unknown/i.test(a)));
});

test("insurance adapter: adding premium to close a gap projects as PRESSURE (costs monthly)", () => {
  const reality = { monthly_expenses: 4000, existing_income_protection: 0, monthly_premium_now: 40, home_loan_outstanding: 0, existing_life_cover: 0, dependents: 0, annual_care_cost: 0, existing_ci_cover: 0, income_protection_months: 12 };
  const branch = { ...reality, monthly_premium_now: 90 };
  const proj = ins.projectImpacts(branch, reality, { monthlyIncome: 7000, monthlyExpenses: 4000, committedExcludingDomain: 500, emergencyBufferMonths: 6, home: null });
  assert.equal(proj.mode, "pressure");
  assert.equal(proj.pressure.extraMonthlyNeeded, 50);
});

test("blind merge: computes only the overlapping band, never either side's raw numbers, and flags conflicts", () => {
  const bm = blindMerge({
    partnerA: { affordableMin: 800, affordableMax: 1500, mustKeep: ["education"], flexible: ["holiday"] },
    partnerB: { affordableMin: 1000, affordableMax: 1800, mustKeep: [], flexible: ["education", "holiday"] },
    sharedItems: [{ id: "education", monthlyCost: 600 }, { id: "holiday", monthlyCost: 200 }],
  });
  assert.deepEqual(bm.jointBand, { low: 1000, high: 1500 });
  assert.ok(!("affordableMin" in bm), "raw numbers not leaked");
  assert.ok(bm.conflicts.some((c) => c.itemId === "education" && c.mustKeepSide === "A"));
  assert.equal(bm.bothConfirmedRequired, true);
});

test("blind merge: no overlapping band -> needs both to talk it through", () => {
  const bm = blindMerge({
    partnerA: { affordableMin: 500, affordableMax: 800 },
    partnerB: { affordableMin: 1200, affordableMax: 1600 },
    sharedItems: [],
  });
  assert.equal(bm.feasibleBandExists, false);
  assert.equal(bm.jointBand, null);
  assert.equal(bm.bothConfirmedRequired, true);
});

test("family constellation: split by ratio, private balances never in the output, joint changes need both", () => {
  const f = computeFamilyConstellation({
    planData: {
      shared_monthly_contribution: 2000,
      partner_share_ratio: 0.6,
      items: [{ id: "education", category: "education", monthlyCost: 800 }, { id: "care", category: "care", monthlyCost: 400 }],
      partnerA_view: { affordableMin: 1000, affordableMax: 1400, mustKeep: ["education"] },
      partnerB_view: { affordableMin: 900, affordableMax: 1300, flexible: ["education"] },
    },
  });
  assert.equal(f.partnerAShare, 1200);
  assert.equal(f.partnerBShare, 800);
  assert.equal(f.committedMonthly, 1200);
  assert.equal(f.surplusMonthly, 800);
  assert.equal(f.privacyNote, "individual_balances_never_shared");
  assert.ok(!JSON.stringify(f).includes("affordableMin"), "no private affordability in output");
  assert.equal(f.bothConfirmedRequired, true); // education conflict
});

test("family adapter: lowering the shared contribution frees cashflow; nothing auto-routed; no_balance_share is always pinned", () => {
  const reality = { shared_monthly_contribution: 2000, partner_share_ratio: 0.5, items: [] };
  const proj = fam.projectImpacts({ ...reality, shared_monthly_contribution: 1500 }, reality, { monthlyIncome: 7000, monthlyExpenses: 3800, committedExcludingDomain: 900, emergencyBufferMonths: 6, home: null });
  assert.equal(proj.mode, "freed");
  assert.equal(proj.freedCashflow, 500);
  assert.equal(proj.allocatedImpact, null);
  const metrics = fam.constraintMetrics(reality, null, {});
  assert.equal(metrics.no_balance_share, true);
});
