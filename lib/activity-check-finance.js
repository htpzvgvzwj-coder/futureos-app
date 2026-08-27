// Real, deterministic "is this unusual for you" check - NOT machine-learned
// fraud detection (this app has no real transaction data or population-
// level model to learn from, and claiming otherwise would be exactly the
// kind of fabrication this codebase's whole discipline exists to prevent).
// Instead: compare a proposed amount against the customer's OWN real
// confirmed history (loans, investments, savings commitments already on
// file, via lib/strategic-balance-context.js - the same real aggregation
// Strategic Balance and Guardian's cross-goal checks already use).
//
// Same "insufficient data is excluded, not scored as 0" pattern as every
// other score in this app: a customer with zero real confirmed history
// gets an honest "nothing to compare against" result, never a guessed
// "normal" or "unusual" verdict.
import { getStrategicBalanceSnapshot } from "./strategic-balance-context.js";

const MAX_RATIO_THRESHOLD = 2; // more than double anything ever confirmed before
const INCOME_MONTHS_THRESHOLD = 3; // more than 3 months of income in one action

export async function computeActivityCheck(profileKey, { amount, monthlyIncome }) {
  const { loans, investments, savings } = await getStrategicBalanceSnapshot(profileKey);

  // A recurring monthly commitment isn't directly comparable to a one-time
  // amount - annualizing it puts every real historical action on the same
  // "amount actually committed" scale without inventing a number.
  const historicalAmounts = [
    ...loans.map((loan) => loan.loanAmount),
    ...investments.map((pick) => pick.amount),
    ...savings.map((plan) => plan.monthlyContribution * 12),
  ].filter((value) => Number.isFinite(value) && value > 0);

  if (historicalAmounts.length === 0) {
    return {
      hasHistory: false,
      historicalActionCount: 0,
      amount: Math.round(amount),
      unusual: false,
    };
  }

  const maxHistoricalAmount = Math.max(...historicalAmounts);
  const avgHistoricalAmount = Math.round(historicalAmounts.reduce((sum, value) => sum + value, 0) / historicalAmounts.length);
  const ratioToMax = maxHistoricalAmount > 0 ? amount / maxHistoricalAmount : 0;
  const ratioToIncomeMonths = monthlyIncome > 0 ? amount / monthlyIncome : 0;

  return {
    hasHistory: true,
    historicalActionCount: historicalAmounts.length,
    amount: Math.round(amount),
    maxHistoricalAmount: Math.round(maxHistoricalAmount),
    avgHistoricalAmount,
    ratioToMax: Math.round(ratioToMax * 100) / 100,
    ratioToIncomeMonths: Math.round(ratioToIncomeMonths * 10) / 10,
    unusual: ratioToMax > MAX_RATIO_THRESHOLD || ratioToIncomeMonths > INCOME_MONTHS_THRESHOLD,
  };
}
