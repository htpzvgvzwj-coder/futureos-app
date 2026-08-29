// Plan Runtime - live commitment resolution (DB read + pure eval, no AI).
//
// The single place any cross-goal reader asks "what monthly outflow does
// this customer's home (or other domain) commitment REALLY represent right
// now". A commitment's confirmed_savings_plan artifact carries the adjusted
// amount at face value, but the commitment can be live-paused (emergency
// buffer below floor) or revoked - in both cases Guardian is not moving
// that money, so counting the face amount overstates real committed
// outflow. This resolves the artifact amount against the commitment's live
// execution state.
//
// Kept separate from strategic-balance-context.js so every consumer
// (Strategic Balance, Loan sizing, Investment context, Mirror cross-goal)
// gets the same corrected number from one implementation.

import { getPreferences } from "../preferences-store.js";
import { getExpenseHistory } from "../expense-store.js";
import { computeSmoothedExpenses } from "../expense-finance.js";
import { resolveAssetPromptContext } from "../liquid-savings-context.js";
import { getActiveCommitment } from "../goal-commitment-store.js";
import { evaluateCommitmentExecutionState } from "../goal-commitment-finance.js";
import { deriveCommittedMonthlyOutflow, reconcileSavingsRow } from "./commitment.js";

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Resolve the live execution state + real counted monthly outflow for a
// domain's active commitment. Returns null when there is no active
// commitment (caller then falls back to the raw confirmed_savings_plan
// amount, unchanged behaviour).
export async function resolveCommitmentOutflow(profileKey, domain) {
  const commitment = await getActiveCommitment(profileKey, domain);
  if (!commitment) return null;

  const [preferences, expenseHistory] = await Promise.all([getPreferences(profileKey), getExpenseHistory(profileKey)]);
  const statedExpenses = numberValue(preferences?.profile?.monthlyExpenses, 0);
  const statedSavings = numberValue(preferences?.profile?.currentSavings, 0);
  const smoothedExpenses = computeSmoothedExpenses(expenseHistory, statedExpenses);
  // Same horizon the moments route + goal-commitment route use for this
  // domain's buffer read, so the pause evaluation matches what the customer
  // is shown on the Guardian execution card.
  const assetContext = await resolveAssetPromptContext(
    profileKey,
    statedSavings,
    smoothedExpenses.effectiveMonthlyExpenses,
    "flexible",
  );

  const executionState = evaluateCommitmentExecutionState({
    commitment,
    emergencyBufferMonths: assetContext.emergencyBufferMonths,
  });
  const adjustedAmount = numberValue(commitment.monthly_contribution, 0);
  const countedMonthlyOutflow = deriveCommittedMonthlyOutflow({ commitment, executionState });

  return {
    commitment,
    executionState,
    adjustedAmount,
    countedMonthlyOutflow,
    emergencyBufferMonths: assetContext.emergencyBufferMonths,
    // true when the live state means a cross-goal reader should use
    // countedMonthlyOutflow instead of the raw artifact amount.
    differsFromArtifact: countedMonthlyOutflow !== adjustedAmount,
  };
}

// Apply the resolution to a list of { domain, monthlyContribution } savings
// rows (strategic-balance-context.js's getConfirmedSavings output shape).
// Only domains with an active commitment are touched; everything else
// passes through unchanged.
export async function applyCommitmentStateToSavings(profileKey, savingsRows) {
  const byDomain = new Map(savingsRows.map((row) => [row.domain, row]));
  const domainsWithCommitment = [];
  for (const domain of byDomain.keys()) {
    domainsWithCommitment.push(domain);
  }
  const resolutions = await Promise.all(
    domainsWithCommitment.map(async (domain) => [domain, await resolveCommitmentOutflow(profileKey, domain)]),
  );
  return savingsRows.map((row) => {
    const resolution = resolutions.find(([d]) => d === row.domain)?.[1] ?? null;
    return reconcileSavingsRow(row, resolution);
  });
}
