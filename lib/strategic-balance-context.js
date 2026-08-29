// Cross-domain read layer for Strategic Balance (张力全景), extending the
// no-SQL-join pattern established by lib/loan-context.js /
// lib/hardship-context.js: parallel reads per domain, no relation exists to
// join on. Unlike those two, this reads EVERY domain's confirmed-plan
// detail (not just a monthly-commitment total) plus real confirmation
// timestamps, because the dashboard this feeds needs to explain WHY a
// category is healthy/tight, not just how much it costs.

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import * as loanStore from "./loan-store.js";
import * as investmentStore from "./investment-store.js";
import * as hardshipStore from "./hardship-store.js";
import { LOAN_PURPOSES } from "./loan-finance.js";
import { applyCommitmentStateToSavings } from "./plan-runtime/commitment-context.js";

const SAVINGS_STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };

async function getConfirmedLoans(profileKey) {
  const results = await Promise.all(
    Object.keys(LOAN_PURPOSES).map(async (purpose) => {
      const session = await loanStore.getOrCreateSession(profileKey, purpose);
      const artifact = await loanStore.getLatestArtifactWithTimestamp(session.id, "stage1", "confirmed_loan");
      if (!artifact) return null;
      const loan = artifact.payload;
      return {
        purpose,
        archetype: loan.archetype,
        monthlyInstallment: loan.monthly_installment,
        loanAmount: loan.loan_amount,
        annualRatePercent: loan.annual_rate_percent,
        tenureYears: loan.tenure_years,
        futureScore: loan.future_score,
        hasProtection: loan.insurance_premium_monthly != null,
        confirmedAt: artifact.createdAt,
      };
    }),
  );
  return results.filter(Boolean);
}

async function getConfirmedInvestments(profileKey) {
  const session = await investmentStore.getOrCreateSession(profileKey);
  const picks = await investmentStore.getAllArtifactsWithTimestamps(session.id, "stage1", "confirmed_investment_pick");
  return picks.map(({ payload, createdAt }) => ({
    name: payload.name,
    ticker: payload.ticker,
    purchaseMode: payload.purchase_mode,
    amount: payload.amount,
    futureScore: payload.future_score,
    // Only present on picks confirmed after this field started being saved
    // (app/api/investment/confirm/route.js) - null for older picks, which
    // lib/cross-goal-context.js's computeInvestmentImpact treats as
    // "not recomputable" rather than guessing.
    diversificationScore: payload.diversification_score ?? null,
    horizonFitScore: payload.horizon_fit_score ?? null,
    totalContributed: payload.projection?.totalContributed ?? null,
    projectedEndValue: payload.projection?.projectedEndValue ?? null,
    projectedGrowth: payload.projection?.projectedGrowth ?? null,
    confirmedAt: createdAt,
  }));
}

async function getConfirmedSavings(profileKey) {
  const results = await Promise.all(
    Object.entries(SAVINGS_STORES).map(async ([domain, store]) => {
      const session = await store.getOrCreateSession(profileKey);
      const artifact = await store.getLatestArtifactWithTimestamp(session.id, "stage2", "confirmed_savings_plan");
      if (!artifact) return null;
      return { domain, monthlyContribution: artifact.payload.monthly_contribution, confirmedAt: artifact.createdAt };
    }),
  );
  const rows = results.filter(Boolean);
  // Plan Runtime: a domain with a live-paused or revoked goal_commitment
  // must not be counted at the artifact's face amount - Guardian isn't
  // moving that money. Every cross-goal reader (Strategic Balance, Loan
  // sizing, Investment context, Mirror cross-goal) inherits the corrected
  // monthlyContribution from this one substitution.
  return applyCommitmentStateToSavings(profileKey, rows);
}

async function getHardshipEvidence(profileKey) {
  const session = await hardshipStore.getOrCreateSession(profileKey);
  const appliedActions = await hardshipStore.getAppliedActions(session.id);
  return appliedActions
    .filter((action) => action.status === "applied")
    .map((action) => ({
      actionType: action.action_type,
      explanation: action.explanation,
      confirmedAt: action.applied_at ? new Date(action.applied_at).toISOString() : null,
    }));
}

export async function getStrategicBalanceSnapshot(profileKey) {
  const [loans, investments, savings, hardshipEvidence] = await Promise.all([
    getConfirmedLoans(profileKey),
    getConfirmedInvestments(profileKey),
    getConfirmedSavings(profileKey),
    getHardshipEvidence(profileKey),
  ]);
  return { loans, investments, savings, hardshipEvidence };
}
