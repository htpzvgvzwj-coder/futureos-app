// Financial Twin - the loader that turns the customer's real DB rows into
// buildFinancialTwin() input, so every Studio / the Life Graph / Today's
// balance / the Current Ripple all read ONE composed twin.
//
// Sources (canonical, section 十):
//   financial_assets      -> assets (ownership-adjusted, provenance-tagged)
//   bank_accounts + ledger -> a bank_account asset per account (posted balance)
//   liabilities           -> liabilities
//   income_streams        -> income
//   recurring_obligations -> part of monthlyExpenses (bills / subscriptions)
//   goal_commitments      -> active sealed commitments (monthly claim)
//   assets (Life Capital) -> lifeCapital, never valued
//
// Nothing is invented. A user with no rows gets an empty twin (zeros).

import { query } from "../db.js";
import { buildFinancialTwin } from "./twin.js";
import { getAccountBalances } from "../transaction-ledger/store.js";
import { LIFE_CAPITAL_CLASSES } from "./classes.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// A live credit card's revolving balance is a liability; a live deposit
// account's posted balance is a liquid financial asset. We derive both
// from the ledger so they never drift from the transactions.
// `linkedMeta` maps accountId -> the metadata from a financial_assets row
// LINKED to that account (its restricted_purpose / source_type / confidence).
// A linked row is otherwise dropped to avoid double-counting the value, but
// its meaning (e.g. "this savings account is the emergency buffer", "synced
// via SGFinDex") should still apply to the ledger-derived balance.
function accountRowsToAssetsAndLiabilities(balances, linkedMeta = {}) {
  const assets = [];
  const liabilities = [];
  for (const b of balances) {
    const meta = linkedMeta[b.accountId] ?? {};
    if (b.isLiability || b.kind === "credit_card") {
      // a positive posted balance on a card = money owed
      if (b.postedBalance > 0) {
        liabilities.push({
          liabilityClass: "credit_card_statement",
          currentBalance: b.postedBalance,
          currency: b.currency,
          sourceType: "bank_synced",
          _fromAccountId: b.accountId,
        });
      }
      continue;
    }
    const liquidityClass = meta.liquidityClass ?? (b.kind === "fixed_deposit" ? "near_cash" : "cash");
    assets.push({
      assetClass: b.kind === "fixed_deposit" ? "fixed_deposit" : "bank_account",
      currentValue: b.postedBalance,
      availableValue: b.availableBalance,
      liquidityClass,
      restrictedPurpose: meta.restrictedPurpose ?? (b.kind === "goal_wallet" ? "earmarked" : null),
      ownerType: "self",
      currency: b.currency,
      sourceType: meta.sourceType ?? "bank_synced",
      confidence: meta.confidence,
      isUserConfirmed: true,
      _fromAccountId: b.accountId,
    });
  }
  return { assets, liabilities };
}

export async function loadFinancialTwinInput(profileKey, { asOf = null } = {}) {
  const [assetRows, liaRows, incomeRows, recurringRows, commitmentRows, lifeCapRows, balances] = await Promise.all([
    query(`select * from financial_assets where profile_key = $1`, [profileKey]),
    query(`select * from liabilities where profile_key = $1`, [profileKey]),
    query(`select * from income_streams where profile_key = $1 and active = true`, [profileKey]),
    query(`select * from recurring_obligations where profile_key = $1 and active = true`, [profileKey]),
    query(`select domain, monthly_contribution from goal_commitments where profile_key = $1 and status = 'active'`, [profileKey]),
    query(`select category, subtype, name, strength_rating from assets where profile_key = $1 and category = any($2::text[])`, [profileKey, LIFE_CAPITAL_CLASSES]),
    getAccountBalances(profileKey).catch(() => []),
  ]);

  const linkedMeta = {};
  for (const r of assetRows.rows) {
    if (r.linked_account_id) {
      linkedMeta[r.linked_account_id] = {
        restrictedPurpose: r.restricted_purpose,
        liquidityClass: r.liquidity_class,
        sourceType: r.source_type,
        confidence: r.confidence,
      };
    }
  }
  const { assets: acctAssets, liabilities: acctLiabilities } = accountRowsToAssetsAndLiabilities(balances, linkedMeta);

  const assets = [
    ...acctAssets,
    ...assetRows.rows
      // a financial_assets row LINKED to a bank account is represented by
      // the ledger-derived balance above - do not double count it.
      .filter((r) => !r.linked_account_id)
      .map((r) => ({
        assetClass: r.asset_class,
        currentValue: num(r.current_value),
        availableValue: r.available_value == null ? null : num(r.available_value),
        liquidityClass: r.liquidity_class,
        restrictedPurpose: r.restricted_purpose,
        ownerType: r.owner_type,
        ownershipPercent: num(r.ownership_percent),
        currency: r.currency,
        sourceType: r.source_type,
        confidence: r.confidence,
        isUserConfirmed: r.is_user_confirmed,
        asOf: r.as_of,
      })),
  ];

  const liabilities = [
    ...acctLiabilities,
    ...liaRows.rows
      .filter((r) => !r.linked_account_id)
      .map((r) => ({
        liabilityClass: r.liability_class,
        currentBalance: num(r.current_balance),
        minimumMonthly: r.minimum_monthly == null ? null : num(r.minimum_monthly),
        ownershipPercent: num(r.ownership_percent),
        currency: r.currency,
        sourceType: r.source_type,
        asOf: r.as_of,
      })),
  ];

  const income = incomeRows.rows.map((r) => ({
    monthlyAmount: num(r.monthly_amount),
    kind: r.kind,
    sourceType: r.source_type,
  }));

  // Recurring bills / subscriptions are part of monthly outflow. Loan
  // repayments are handled via liabilities.minimumMonthly, so exclude them
  // here to avoid double counting. Non-monthly rows carry the whole charge
  // in monthly_amount (that's how the Pressure Weather forecast reads them),
  // so amortise them here: an annual premium is ~1/12 a month, a one-off is
  // not a recurring monthly expense at all.
  const CADENCE_DIVISOR = { monthly: 1, month: 1, weekly: 0.23, quarterly: 3, semiannual: 6, "semi_annual": 6, annual: 12, yearly: 12 };
  const monthlyRecurringExpense = recurringRows.rows
    .filter((r) => r.kind !== "loan_repayment")
    .reduce((s, r) => {
      const cad = String(r.cadence || "monthly").toLowerCase();
      if (cad === "one_off" || cad === "once" || cad === "one-off") return s;
      return s + num(r.monthly_amount) / (CADENCE_DIVISOR[cad] ?? 1);
    }, 0);

  const commitments = commitmentRows.rows.map((r) => ({ domain: r.domain, monthlyContribution: num(r.monthly_contribution) }));

  const lifeCapital = lifeCapRows.rows.map((r) => ({
    capitalClass: r.category,
    note: r.name,
    strengthRating: r.strength_rating,
  }));

  return {
    assets,
    liabilities,
    income,
    monthlyExpenses: monthlyRecurringExpense,
    commitments,
    lifeCapital,
    asOf: asOf ?? new Date().toISOString(),
  };
}

// The one call every server surface uses.
export async function loadFinancialTwin(profileKey, opts = {}) {
  const input = await loadFinancialTwinInput(profileKey, opts);
  return buildFinancialTwin(input);
}
