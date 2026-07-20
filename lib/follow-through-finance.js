// Deterministic engine for the Follow-Through Score (履约分). Same "AI touches
// zero numbers" discipline as every other *-finance.js module in this
// codebase - pure arithmetic over real check-in history, real confirmed-plan
// data, and real hardship recovery evidence. Nothing here is invented.
//
// This measures whether the CUSTOMER kept their own word - distinct from
// Guardian Reputation Score (app/page.jsx getGuardianReputationScore), which
// measures whether the AI's actions and recommendations were trustworthy.
// The two are combined at the call site (Relationship Ledger / Product Fit),
// never merged into one number here.

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function monthsSince(dateIso) {
  if (!dateIso) return 0;
  const start = new Date(dateIso);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return 0;
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

// Dimension 1 (40%): of the months since each domain's plan was confirmed,
// how many actually got a check-in. A missed month isn't assumed to be a
// missed payment - it's assumed to be silence, which this dimension alone
// penalises; Recovery Honesty (dimension 3) is what rewards showing up
// during an actual hardship instead of going quiet.
function computeCheckInConsistency(domains) {
  if (!domains.length) return { value: null, monthsWithCheckin: 0, monthsSincePlan: 0 };
  let monthsSincePlan = 0;
  let monthsWithCheckin = 0;
  domains.forEach((domain) => {
    monthsSincePlan += Math.max(1, monthsSince(domain.confirmedAt));
    monthsWithCheckin += domain.checkins.length;
  });
  return {
    value: clamp(Math.round((monthsWithCheckin / monthsSincePlan) * 100)),
    monthsWithCheckin,
    monthsSincePlan,
  };
}

// Dimension 2 (35%): of the check-ins actually logged, how close was the
// real amount to the confirmed monthly target. Saving more never scores
// above 100 (this isn't rewarding overcommitment); saving less scales down
// proportionally rather than being an all-or-nothing pass/fail.
function computeAmountFidelity(domains) {
  const fidelities = [];
  domains.forEach((domain) => {
    const target = domain.monthlyContribution > 0 ? domain.monthlyContribution : null;
    if (!target) return;
    domain.checkins.forEach((checkin) => {
      fidelities.push(clamp(Math.round((checkin.amount / target) * 100)));
    });
  });
  if (!fidelities.length) return { value: null, checkinCount: 0 };
  const value = Math.round(fidelities.reduce((sum, f) => sum + f, 0) / fidelities.length);
  return { value, checkinCount: fidelities.length };
}

// Dimension 3 (15%): the differentiator. A customer who never hit a risk
// signal isn't penalised for lacking recovery evidence (baseline 100 - there
// was nothing to recover from). A customer who DID hit risk and used the
// hardship recovery flow scores the same 100 as never needing it - honest
// struggle is not a mark against you. Only silent abandonment (at-risk with
// zero recovery evidence) scores low.
function computeRecoveryHonesty(hardshipEvidence, everAtRisk) {
  if (!everAtRisk) return { value: 100, reason: "neverNeeded" };
  if (hardshipEvidence.length > 0) return { value: 100, reason: "usedRecovery" };
  return { value: 35, reason: "wentQuiet" };
}

// Dimension 4 (10%): breadth of the relationship - how many distinct goals
// the customer has actually confirmed and is being tracked on, capped at 3
// so a fourth or fifth goal doesn't keep adding weight indefinitely.
function computeMultiGoalDepth(confirmedGoalCount) {
  return { value: clamp(Math.round((Math.min(confirmedGoalCount, 3) / 3) * 100)), confirmedGoalCount };
}

const WEIGHTS = { checkInConsistency: 0.4, amountFidelity: 0.35, recoveryHonesty: 0.15, multiGoalDepth: 0.1 };

export function computeFollowThroughScore({ domains, hardshipEvidence, everAtRisk, confirmedGoalCount }) {
  const components = {
    checkInConsistency: { ...computeCheckInConsistency(domains), weight: WEIGHTS.checkInConsistency },
    amountFidelity: { ...computeAmountFidelity(domains), weight: WEIGHTS.amountFidelity },
    recoveryHonesty: { ...computeRecoveryHonesty(hardshipEvidence, everAtRisk), weight: WEIGHTS.recoveryHonesty },
    multiGoalDepth: { ...computeMultiGoalDepth(confirmedGoalCount), weight: WEIGHTS.multiGoalDepth },
  };

  // A component with no data yet (e.g. no check-ins logged anywhere) is
  // excluded and its weight redistributed across the known components,
  // rather than silently scored as 0 - there's a real difference between
  // "never checked in" and "not enough history to judge yet".
  const known = Object.values(components).filter((c) => c.value != null);
  const totalWeight = known.reduce((sum, c) => sum + c.weight, 0);
  const hasAnyData = known.length > 0 && domains.length > 0;
  const score = totalWeight > 0 ? clamp(Math.round(known.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight)) : 0;

  return { score: hasAnyData ? score : 0, band: getFollowThroughBand(hasAnyData, score), components, hasAnyData };
}

export function getFollowThroughBand(hasAnyData, score) {
  if (!hasAnyData) return "newRelationship";
  if (score < 60) return "building";
  if (score < 80) return "reliable";
  if (score < 93) return "steadfast";
  return "anchor";
}
