// Insurance Living Plan - Protection Envelope (pure, no DB/AI).
//
// NOT a sales page and NOT a product recommender. It answers: if reality
// changes, which life commitments lose protection? Around real life nodes
// (income, home loan, family/dependents, care) it computes the gap between
// what the node needs protected and the coverage the customer has TOLD us
// about - and it is explicit about what is Known / Partial / Unknown. An
// unknown is never counted as a gap.

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// A rough monthly premium to close a lump-sum protection gap - a reference
// estimate, never a quote. ~SGD 0.35 / year per SGD 1,000 of term cover,
// expressed monthly.
const PREMIUM_PER_1000_PER_MONTH = 0.35 / 12;
function premiumForGap(gapAmount) {
  return Math.round((num(gapAmount) / 1000) * PREMIUM_PER_1000_PER_MONTH * 100) / 100;
}

// planData: {
//   monthly_expenses, income_protection_months (target, default 12),
//   home_loan_outstanding, dependents (count), years_of_support_per_dependent
//     (default 15), annual_care_cost, care_years (default 3),
//   existing_income_protection, existing_life_cover, existing_ci_cover,
//   monthly_premium_now
// }
export function computeProtectionEnvelope({ planData }) {
  const expenses = num(planData.monthly_expenses);
  const nodes = [];

  // --- Income protection ---------------------------------------------
  {
    const months = num(planData.income_protection_months, 12);
    const need = Math.round(expenses * months);
    const have = num(planData.existing_income_protection);
    const status = expenses <= 0 ? "unknown" : planData.existing_income_protection == null ? "partial" : "known";
    nodes.push({
      id: "income",
      need,
      have,
      gapAmount: status === "known" ? Math.max(0, need - have) : status === "partial" ? need : null,
      status,
      atRisk: status === "known" ? need > have : status === "partial",
    });
  }

  // --- Home loan ----------------------------------------------------
  {
    const outstanding = num(planData.home_loan_outstanding);
    const have = num(planData.existing_life_cover);
    const status = planData.home_loan_outstanding == null ? "unknown" : planData.existing_life_cover == null ? "partial" : "known";
    nodes.push({
      id: "home_loan",
      need: Math.round(outstanding),
      have,
      gapAmount: status === "known" ? Math.max(0, outstanding - have) : status === "partial" ? Math.round(outstanding) : null,
      status,
      atRisk: status === "known" ? outstanding > have : status === "partial" && outstanding > 0,
    });
  }

  // --- Family / dependents ---------------------------------------
  {
    const dependents = num(planData.dependents);
    const years = num(planData.years_of_support_per_dependent, 15);
    const need = Math.round(dependents * expenses * 12 * years * 0.5); // ~half of household expenses per dependent
    const have = num(planData.existing_life_cover);
    const status = planData.dependents == null || expenses <= 0 ? "unknown" : planData.existing_life_cover == null ? "partial" : "known";
    nodes.push({
      id: "family",
      need,
      have,
      gapAmount: status === "known" ? Math.max(0, need - have) : status === "partial" ? need : null,
      status,
      atRisk: dependents > 0 && (status === "partial" || (status === "known" && need > have)),
    });
  }

  // --- Care / critical illness ---------------------------------
  {
    const annual = num(planData.annual_care_cost);
    const careYears = num(planData.care_years, 3);
    const need = Math.round(annual * careYears);
    const have = num(planData.existing_ci_cover);
    const status = planData.annual_care_cost == null ? "unknown" : planData.existing_ci_cover == null ? "partial" : "known";
    nodes.push({
      id: "care",
      need,
      have,
      gapAmount: status === "known" ? Math.max(0, need - have) : status === "partial" ? need : null,
      status,
      atRisk: status === "known" ? need > have : status === "partial",
    });
  }

  const quantifiedGap = nodes.reduce((s, n) => s + (n.gapAmount ?? 0), 0);
  const unknownCount = nodes.filter((n) => n.status === "unknown").length;
  const partialCount = nodes.filter((n) => n.status === "partial").length;
  const knownGapNodes = nodes.filter((n) => n.status === "known" && n.gapAmount > 0);

  const premiumToCloseKnownGaps = knownGapNodes.reduce((s, n) => s + premiumForGap(n.gapAmount), 0);
  const monthlyPremiumNow = num(planData.monthly_premium_now);

  return {
    available: true,
    nodes,
    quantifiedGap: Math.round(quantifiedGap),
    unknownCount,
    partialCount,
    knownGapCount: knownGapNodes.length,
    monthlyPremiumNow,
    premiumToCloseKnownGaps: Math.round(premiumToCloseKnownGaps * 100) / 100,
    envelopeStatus: unknownCount > 0 ? "has_unknowns" : knownGapNodes.length > 0 ? "gaps_identified" : "covered",
    // A plan is only "sealable" here in the sense of committing to a premium
    // change - never a real policy purchase.
    sealable: true,
    sources: ["your declared coverage + liabilities", "term-cover reference premium rate"],
    assumptions: [
      "Gaps use YOUR stated coverage - unknowns are shown as unknown, never counted as a gap.",
      "Premium figures are a reference estimate, not a quote. No underwriting.",
    ],
  };
}
