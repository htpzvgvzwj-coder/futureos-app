// Anonymous peer comparison concept preview ("people in your situation typically save/insure this
// much"). This prototype has no real aggregate OCBC customer database to query, so the peer
// figures below are a deterministic illustrative model keyed off the customer's own age/income
// bucket - NOT derived from any real dataset, clearly disclosed, same honesty discipline as
// Cross-Bank Data Integration's concept items. A real version of this idea needs genuine aggregate
// customer behavior data, which is exactly why it's a moat competitors can't build from a
// calculator alone - this preview only demonstrates the shape of the comparison.

function getAgeBucket(age) {
  if (age < 30) return "under30";
  if (age < 40) return "thirties";
  if (age < 50) return "forties";
  return "fiftyPlus";
}

function getIncomeBucket(monthlyIncome) {
  if (monthlyIncome < 5000) return "under5k";
  if (monthlyIncome < 10000) return "from5kTo10k";
  if (monthlyIncome < 15000) return "from10kTo15k";
  return "from15kUp";
}

const EMERGENCY_MONTHS_TYPICAL = { under30: 3, thirties: 4, forties: 5, fiftyPlus: 6 };
const SAVINGS_RATE_TYPICAL_PERCENT = { under5k: 8, from5kTo10k: 12, from10kTo15k: 15, from15kUp: 18 };
const DEBT_TO_ANNUAL_INCOME_TYPICAL_PERCENT = { under30: 25, thirties: 30, forties: 22, fiftyPlus: 15 };
const INVESTMENT_TO_ANNUAL_INCOME_TYPICAL_MULTIPLE = { under5k: 0.5, from5kTo10k: 1.2, from10kTo15k: 2, from15kUp: 3 };

export function computePeerBenchmark({ age, monthlyIncome, monthlyExpenses, currentSavings, debtLoad, investments }) {
  const ageBucket = getAgeBucket(age);
  const incomeBucket = getIncomeBucket(monthlyIncome);
  const annualIncome = monthlyIncome * 12;

  const emergencyMonthsActual = monthlyExpenses > 0 ? Math.round((currentSavings / monthlyExpenses) * 10) / 10 : 0;
  const savingsRateActualPercent = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 1000) / 10 : 0;
  const debtToIncomeActualPercent = annualIncome > 0 ? Math.round((debtLoad / annualIncome) * 1000) / 10 : 0;
  const investmentToIncomeActualMultiple = annualIncome > 0 ? Math.round((investments / annualIncome) * 10) / 10 : 0;

  return {
    ageBucket,
    incomeBucket,
    emergency: { actual: emergencyMonthsActual, typical: EMERGENCY_MONTHS_TYPICAL[ageBucket], aheadOfPeers: emergencyMonthsActual >= EMERGENCY_MONTHS_TYPICAL[ageBucket] },
    savingsRate: {
      actual: savingsRateActualPercent,
      typical: SAVINGS_RATE_TYPICAL_PERCENT[incomeBucket],
      aheadOfPeers: savingsRateActualPercent >= SAVINGS_RATE_TYPICAL_PERCENT[incomeBucket],
    },
    debtToIncome: {
      actual: debtToIncomeActualPercent,
      typical: DEBT_TO_ANNUAL_INCOME_TYPICAL_PERCENT[ageBucket],
      aheadOfPeers: debtToIncomeActualPercent <= DEBT_TO_ANNUAL_INCOME_TYPICAL_PERCENT[ageBucket],
    },
    investmentToIncome: {
      actual: investmentToIncomeActualMultiple,
      typical: INVESTMENT_TO_ANNUAL_INCOME_TYPICAL_MULTIPLE[incomeBucket],
      aheadOfPeers: investmentToIncomeActualMultiple >= INVESTMENT_TO_ANNUAL_INCOME_TYPICAL_MULTIPLE[incomeBucket],
    },
  };
}
