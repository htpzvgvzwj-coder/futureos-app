// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// Unlike Home Planner, a wedding has no regulatory ceiling (TDSR/MSR) to
// derive a real "safe budget range" from - there is no verified real
// Singapore benchmark this codebase can honestly cite for "a typical
// wedding costs X". So the real zero-input draft here is framed
// differently and just as honestly: a real monthly savings capacity
// (income minus expenses minus every already-confirmed commitment,
// excluding the wedding itself since it isn't confirmed yet), and - once
// the customer picks a real timeline tier - a real projected savings
// total by that date. Never a claim about what the wedding itself
// "should" cost.

export function computeWeddingSavingsCapacity({ monthlyIncome, monthlyExpenses, committedMonthlyTotal }) {
  const monthlyCapacity = Math.round(monthlyIncome - monthlyExpenses - committedMonthlyTotal);
  return { monthlyCapacity, hasCapacity: monthlyCapacity > 0 };
}

// timelineMonths: null means "just exploring" - honestly returns no
// projection rather than projecting against an unknown date.
export function computeProjectedWeddingSavings({ currentSavings, monthlyCapacity, timelineMonths }) {
  if (!timelineMonths) return null;
  const projectedSavings = Math.round(currentSavings + monthlyCapacity * timelineMonths);
  return { timelineMonths, projectedSavings };
}
