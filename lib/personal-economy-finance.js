// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// "Personal Economy": reframes the customer's own already-real numbers
// (real stated income/expenses, lib/asset-finance.js's real net worth,
// lib/strategic-balance-context.js's real committed monthly total) as a
// real set of economic indicators, plus two genuinely new computations
// nobody in this app has done yet - a real net-worth trajectory from the
// Asset Profile ledger's own real createdAt timestamps, and a real income
// growth rate from the customer's own logged income_entries history.
// Nothing here is invented: every number traces back to a real stored
// row, and both trend functions honestly return null (not a guess) below
// a real minimum sample size.

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

// Mirrors lib/strategic-balance-finance.js's computeUtilizationTimeline
// exactly (walk real dated points in order, running total, "at least 2
// points" honesty floor) - applied here to the Asset Profile ledger's own
// real createdAt timestamps instead of confirmed-plan dates. Only assets
// with a real logged value contribute (unvalued categories like "legal"
// documents don't have a $ figure to sum).
export function computeNetWorthTimeline(assets) {
  const dated = (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset.value != null && asset.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (dated.length < 2) return null;

  let running = 0;
  const points = dated.map((asset) => {
    running += Number(asset.value) || 0;
    return { date: asset.createdAt, netWorth: Math.round(running) };
  });

  const first = points[0].netWorth;
  const last = points[points.length - 1].netWorth;
  const changeAmount = last - first;
  return {
    points,
    changeAmount,
    changePercent: first !== 0 ? roundToOneDecimal((changeAmount / Math.abs(first)) * 100) : null,
    direction: changeAmount > 0 ? "up" : changeAmount < 0 ? "down" : "flat",
  };
}

// Same insufficient-signal floor as lib/income-finance.js's
// MIN_ENTRIES_FOR_SMOOTHING - below 3 real logged months, a growth
// comparison would be mostly noise. Compares the average of the earlier
// half of real logged months against the later half (both real, not a
// single-point comparison that could be thrown off by one unusual month).
const MIN_ENTRIES_FOR_GROWTH = 3;

export function computeIncomeGrowth(incomeHistory) {
  const real = (Array.isArray(incomeHistory) ? incomeHistory : [])
    .map((entry) => ({ month: entry.entry_month, amount: Number(entry.amount) }))
    .filter((entry) => Number.isFinite(entry.amount) && entry.month)
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  if (real.length < MIN_ENTRIES_FOR_GROWTH) return { hasEnoughHistory: false, sampleSize: real.length };

  const midpoint = Math.floor(real.length / 2);
  const earlierHalf = real.slice(0, midpoint || 1);
  const laterHalf = real.slice(midpoint || 1);
  const earlierAvg = earlierHalf.reduce((sum, entry) => sum + entry.amount, 0) / earlierHalf.length;
  const laterAvg = laterHalf.reduce((sum, entry) => sum + entry.amount, 0) / laterHalf.length;
  const growthPercent = earlierAvg > 0 ? roundToOneDecimal(((laterAvg - earlierAvg) / earlierAvg) * 100) : null;

  return {
    hasEnoughHistory: true,
    sampleSize: real.length,
    earlierAvg: Math.round(earlierAvg),
    laterAvg: Math.round(laterAvg),
    growthPercent,
    direction: laterAvg > earlierAvg ? "up" : laterAvg < earlierAvg ? "down" : "flat",
  };
}

// Pure relabeling/bundling of numbers that are each already real elsewhere
// in this app (Home/Strategic Balance/Asset Profile) - no new arithmetic
// invented, just assembled into one real "indicators" view.
export function computePersonalEconomyIndicators({ monthlyIncome, monthlyExpenses, netWorth, committedMonthlyTotal }) {
  const savingsRatePercent = monthlyIncome > 0 ? roundToOneDecimal(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;
  const debtRatioPercent = monthlyIncome > 0 ? roundToOneDecimal((committedMonthlyTotal / monthlyIncome) * 100) : 0;
  const tradeBalance = Math.round(monthlyIncome - monthlyExpenses);

  return {
    grossOutput: Math.round(monthlyIncome),
    consumption: Math.round(monthlyExpenses),
    tradeBalance,
    reserves: Math.round(netWorth),
    debtRatioPercent,
    savingsRatePercent,
  };
}
