import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancialTwin, twinToStudioContext } from "../lib/financial-twin/twin.js";
import { isAuthoritative, SOURCE_TYPES } from "../lib/financial-twin/classes.js";

const A = (o) => ({ sourceType: "user_confirmed", asOf: "2026-08-29", liquidityClass: "cash", ...o });
const L = (o) => ({ sourceType: "user_confirmed", asOf: "2026-08-29", ...o });

test("net worth = ownership-adjusted financial assets minus liabilities", () => {
  const t = buildFinancialTwin({
    assets: [
      A({ assetClass: "bank_account", currentValue: 40000 }),
      A({ assetClass: "investment", currentValue: 20000, liquidityClass: "liquid" }),
      A({ assetClass: "property", currentValue: 600000, liquidityClass: "illiquid" }),
    ],
    liabilities: [L({ liabilityClass: "mortgage", currentBalance: 400000, minimumMonthly: 1800 })],
  });
  assert.equal(t.financialAssetsTotal, 660000);
  assert.equal(t.liabilitiesTotal, 400000);
  assert.equal(t.netWorth, 260000);
});

test("CPF SA/RA and MediSave never count as liquid or freely-allocatable cash", () => {
  const t = buildFinancialTwin({
    assets: [
      A({ assetClass: "bank_account", currentValue: 10000 }),
      A({ assetClass: "cpf_sa_ra", currentValue: 90000, liquidityClass: "cash" }), // field says cash - ignored
      A({ assetClass: "medisave", currentValue: 25000, liquidityClass: "near_cash" }),
    ],
  });
  assert.equal(t.liquidAssets, 10000, "only the bank account is liquid");
  assert.equal(t.restrictedAssets, 115000, "CPF SA/RA + MediSave are restricted");
  assert.equal(t.freelyAllocatableCash, 10000);
  // they DO still count toward net worth
  assert.equal(t.netWorth, 125000);
});

test("an emergency-earmarked (protected) balance is not freely allocatable", () => {
  const t = buildFinancialTwin({
    assets: [
      A({ assetClass: "bank_account", currentValue: 30000, restrictedPurpose: "emergency" }),
      A({ assetClass: "bank_account", currentValue: 12000 }),
    ],
  });
  assert.equal(t.protectedAssets, 30000);
  assert.equal(t.freelyAllocatableCash, 12000, "only the un-earmarked balance can be spent by a Studio");
  assert.equal(t.balanceBreakdown.protectedFor, 30000);
  assert.equal(t.balanceBreakdown.availableNow, 12000);
});

test("a joint / partner asset counts only at its ownershipPercent", () => {
  const t = buildFinancialTwin({
    assets: [
      A({ assetClass: "bank_account", currentValue: 20000, ownerType: "joint", ownershipPercent: 50 }),
      A({ assetClass: "property", currentValue: 800000, ownerType: "joint", ownershipPercent: 0.5, liquidityClass: "illiquid" }),
    ],
    liabilities: [L({ liabilityClass: "mortgage", currentBalance: 500000, ownershipPercent: 50 })],
  });
  assert.equal(t.financialAssetsTotal, 10000 + 400000, "half of each joint asset");
  assert.equal(t.liabilitiesTotal, 250000, "half of the joint mortgage");
  assert.equal(t.netWorth, 160000);
  assert.equal(t.liquidAssets, 10000);
});

test("Life Capital (human / social / knowledge / ...) never enters net worth", () => {
  const t = buildFinancialTwin({
    assets: [A({ assetClass: "bank_account", currentValue: 5000 })],
    lifeCapital: [
      { capitalClass: "human", note: "5y marketing", strengthRating: 4 },
      { capitalClass: "social", note: "strong network" },
      { capitalClass: "property", note: "not a life-capital class - dropped" },
    ],
  });
  assert.equal(t.netWorth, 5000);
  assert.equal(t.lifeCapital.length, 2, "only real Life Capital classes are kept");
  assert.equal(t.lifeCapitalExcludedFromNetWorth, true);
  // a non-financial asset class passed in `assets` is dropped, not valued
  const t2 = buildFinancialTwin({ assets: [A({ assetClass: "human", currentValue: 999999 })] });
  assert.equal(t2.financialAssetsTotal, 0);
  assert.equal(t2.provenance.droppedNonFinancialAssetCount, 1);
});

test("a fresh customer with no rows gets zeros - never a persona, never SGD 85,000", () => {
  const t = buildFinancialTwin({});
  assert.equal(t.isEmpty, true);
  assert.equal(t.netWorth, 0);
  assert.equal(t.liquidAssets, 0);
  assert.equal(t.monthlyIncome, 0);
  assert.equal(t.freelyAllocatableCash, 0);
  assert.equal(JSON.stringify(t).includes("85000"), false);
});

test("the twin is a pure function of its input - same input, same output; two callers never share state", () => {
  const input = {
    assets: [A({ assetClass: "bank_account", currentValue: 1234 })],
    income: [{ monthlyAmount: 5000, sourceType: "bank_synced" }],
    monthlyExpenses: 2000,
  };
  const a = buildFinancialTwin(input);
  const b = buildFinancialTwin(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(a, b, "deterministic - survives a reload");

  const userX = buildFinancialTwin({ assets: [A({ assetClass: "bank_account", currentValue: 100 })] });
  const userY = buildFinancialTwin({ assets: [A({ assetClass: "bank_account", currentValue: 999 })] });
  assert.notEqual(userX.netWorth, userY.netWorth, "each call is isolated to its own input");
});

test("monthly free cashflow subtracts expenses, scheduled debt and sealed commitments once each", () => {
  const t = buildFinancialTwin({
    income: [{ monthlyAmount: 8000, sourceType: "bank_synced" }],
    monthlyExpenses: 3500,
    liabilities: [L({ liabilityClass: "personal_loan", currentBalance: 12000, minimumMonthly: 400 })],
    commitments: [{ domain: "wedding", monthlyContribution: 600 }],
  });
  assert.equal(t.monthlyFreeCashflow, 8000 - 3500 - 400 - 600);
  assert.equal(t.committedMonthlyTotal, 600);
  assert.equal(t.scheduledMonthlyDebt, 400);
});

test("provenance: a system estimate is never counted as authoritative; a synthetic fixture is flagged", () => {
  const t = buildFinancialTwin({
    assets: [
      A({ assetClass: "bank_account", currentValue: 1000, sourceType: "system_estimated", isUserConfirmed: false }),
      A({ assetClass: "investment", currentValue: 500, sourceType: "synthetic_fixture", liquidityClass: "liquid" }),
    ],
  });
  assert.equal(t.provenance.anyAuthoritative, false);
  assert.equal(t.provenance.hasSyntheticFixture, true);
  assert.equal(isAuthoritative("system_estimated"), false);
  assert.equal(isAuthoritative("bank_synced"), true);
  assert.ok(SOURCE_TYPES.includes("synthetic_fixture"));
});

test("twinToStudioContext exposes ONE money context for every Studio to share", () => {
  const t = buildFinancialTwin({
    income: [{ monthlyAmount: 7000, sourceType: "bank_synced" }],
    monthlyExpenses: 3000,
    commitments: [{ domain: "home", monthlyContribution: 500 }],
    assets: [A({ assetClass: "bank_account", currentValue: 20000 })],
  });
  const ctx = twinToStudioContext(t);
  assert.equal(ctx.monthlyIncome, 7000);
  assert.equal(ctx.committedMonthlyTotal, 500);
  assert.equal(ctx.availableMonthlyCashflow, t.monthlyFreeCashflow);
  assert.equal(ctx.freelyAllocatableCash, t.freelyAllocatableCash);
});
