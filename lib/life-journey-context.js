// Real status aggregator for the Life Journey screen (app/page.jsx's
// LifeJourneyScreen) - before this, every "life moment" accordion showed
// the same static copy regardless of what the customer had actually done.
// Mirrors the parallel-store-reads-no-SQL-join pattern established by
// lib/loan-context.js / lib/hardship-context.js: each domain's own real
// session/artifact state, read in parallel, no fabricated status.

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import * as otherStore from "./other-store.js";
import * as loanStore from "./loan-store.js";
import * as investmentStore from "./investment-store.js";
import { listAssets } from "./asset-store.js";
import { computeInsuranceCoverage } from "./asset-finance.js";

// Domains with a real two-stage confirm flow (a plan/budget, then a savings
// plan on top of it) - "confirmed" only once BOTH stages are done, matching
// what each domain's own screen already treats as "fully set up".
// `amountField` is which field on the stage1 artifact is worth surfacing as
// a real headline number (null where there isn't a single obvious one, e.g.
// retirement's stage1 artifact is a lifestyle target, not a dollar figure).
const TWO_STAGE_DOMAINS = {
  wedding: { store: weddingStore, artifactType: "confirmed_budget", amountField: "total_budget" },
  home: { store: homeStore, artifactType: "confirmed_plan", amountField: "price" },
  retirement: { store: retirementStore, artifactType: "confirmed_plan", amountField: null },
  other: { store: otherStore, artifactType: "confirmed_goal_plan", amountField: "total_budget" },
};

async function getTwoStageStatus(domain, profileKey) {
  const { store, artifactType, amountField } = TWO_STAGE_DOMAINS[domain];
  const session = await store.getOrCreateSession(profileKey);
  const [confirmedStage1, confirmedStage2] = await Promise.all([
    store.getLatestArtifact(session.id, "stage1", artifactType),
    store.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan"),
  ]);
  if (confirmedStage2) return { state: "confirmed", amount: amountField ? (confirmedStage1?.[amountField] ?? null) : null };
  if (confirmedStage1) return { state: "in_progress", amount: amountField ? (confirmedStage1[amountField] ?? null) : null };
  return { state: "not_started", amount: null };
}

// Loan is purpose-scoped (a separate session per purpose - see
// lib/loan-store.js) and single-stage (confirm is the only step), unlike
// the two-stage domains above.
async function getLoanStatus(profileKey, purpose) {
  const session = await loanStore.getOrCreateSession(profileKey, purpose);
  const confirmed = await loanStore.getLatestArtifact(session.id, "stage1", "confirmed_loan");
  return confirmed ? { state: "confirmed", amount: confirmed.loan_amount ?? null } : { state: "not_started", amount: null };
}

// Investment can have multiple confirmed picks (no single "the confirmed
// plan") - reports the real count and real total amount committed instead
// of collapsing to a single artifact.
async function getInvestmentStatus(profileKey) {
  const session = await investmentStore.getOrCreateSession(profileKey);
  const picks = await investmentStore.getAllArtifactsWithTimestamps(session.id, "stage1", "confirmed_investment_pick");
  if (!picks.length) return { state: "not_started", amount: null, count: 0 };
  const totalAmount = picks.reduce((sum, { payload }) => sum + (Number(payload.amount) || 0), 0);
  return { state: "confirmed", amount: Math.round(totalAmount), count: picks.length };
}

// Insurance has no dedicated session/store in this app - the real signal is
// the Asset Profile ledger's active insurance_policy entry (lib/asset-
// finance.js), same source lib/mirror-prompts.js and the domain savings-plan
// prompts already cite.
async function getInsuranceStatus(profileKey) {
  const assets = await listAssets(profileKey);
  const { hasActiveInsurance, coverageAmount } = computeInsuranceCoverage(assets);
  return hasActiveInsurance ? { state: "confirmed", amount: coverageAmount } : { state: "not_started", amount: null };
}

export async function getLifeJourneyStatus(profileKey) {
  const [wedding, home, retirement, other, loanHome, loanPersonal, investment, insurance] = await Promise.all([
    getTwoStageStatus("wedding", profileKey),
    getTwoStageStatus("home", profileKey),
    getTwoStageStatus("retirement", profileKey),
    getTwoStageStatus("other", profileKey),
    getLoanStatus(profileKey, "home"),
    getLoanStatus(profileKey, "personal"),
    getInvestmentStatus(profileKey),
    getInsuranceStatus(profileKey),
  ]);

  return { wedding, home, retirement, other, "loan:home": loanHome, "loan:personal": loanPersonal, investment, insurance };
}
