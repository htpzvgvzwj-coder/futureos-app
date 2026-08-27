// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// Combines multiple family members' own already-real figures (their real
// stated monthlyIncome/monthlyExpenses from lib/preferences-store.js, and
// their real committedMonthlyTotal from lib/strategic-balance-context.js -
// both already reachable per-member via the existing asUser= "view as"
// routes) into one real family-wide financial picture. A member who hasn't
// entered real profile data yet is honestly excluded from the totals, not
// guessed into them - same "insufficient data excluded" pattern as
// lib/activity-check-finance.js and lib/shadow-account-finance.js.

import { computeUtilization } from "./strategic-balance-finance.js";

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function computeFamilyPicture(members) {
  const list = Array.isArray(members) ? members : [];
  const included = list.filter((member) => member.hasRealProfile);
  const excluded = list.filter((member) => !member.hasRealProfile);

  const totalMonthlyIncome = included.reduce((sum, member) => sum + (Number(member.monthlyIncome) || 0), 0);
  const totalMonthlyExpenses = included.reduce((sum, member) => sum + (Number(member.monthlyExpenses) || 0), 0);
  const totalCommittedMonthly = included.reduce((sum, member) => sum + (Number(member.committedMonthlyTotal) || 0), 0);

  // Reuses Strategic Balance's own healthy/tight/at_risk banding rather than
  // a second, differently-tuned threshold set for the family-level number.
  const utilization = computeUtilization({
    monthlyIncome: totalMonthlyIncome,
    monthlyExpenses: totalMonthlyExpenses,
    committedMonthlyTotal: totalCommittedMonthly,
  });

  const perMember = included.map((member) => ({
    userId: member.userId,
    displayName: member.displayName,
    monthlyIncome: Number(member.monthlyIncome) || 0,
    committedMonthlyTotal: Number(member.committedMonthlyTotal) || 0,
    utilizationPercent: member.monthlyIncome > 0 ? roundToOneDecimal((member.committedMonthlyTotal / member.monthlyIncome) * 100) : 0,
  }));

  return {
    hasAnyRealData: included.length > 0,
    memberCount: included.length,
    excludedMemberNames: excluded.map((member) => member.displayName),
    totalMonthlyIncome,
    totalMonthlyExpenses,
    totalCommittedMonthly,
    healthLabel: utilization.healthLabel,
    utilizationPercent: utilization.utilizationPercent,
    residualMonthly: utilization.residualMonthly,
    perMember,
  };
}
