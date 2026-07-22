// Real feasibility math for the Future Mirror debate (Bull/Bear/Judge): one
// honest computed number, not three preset scenario variants like the old
// deleted engine. The AI debate (lib/mirror-prompts.js) argues about THIS
// number - it never invents monthlyIncome, monthlyExpenses, or the target
// amount itself, same "AI touches zero numbers" discipline as every other
// *-finance.js module in this codebase.

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthCountUntil(targetDate, fallbackMonths = 12) {
  if (!targetDate) return fallbackMonths;
  const parsed = new Date(`${targetDate}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallbackMonths;
  const now = new Date();
  const months = (parsed.getFullYear() - now.getFullYear()) * 12 + (parsed.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Goals with an already-stated recurring monthly figure - no lump-sum/date math needed.
const DIRECT_MONTHLY_FIELDS = {
  retirement: "monthlyInvestment",
  investment: "monthlyInvestment",
  family: "familyMonthlyCost",
};

// Goals expressed as a lump-sum target by a date.
const LUMP_SUM_FIELDS = {
  wedding: { amount: "weddingBudget", date: "weddingDate", fallbackAmount: 35000 },
  home: { amount: "targetDownPayment", date: "targetHomeYear", fallbackAmount: 150000 },
  business: { amount: "startupCapital", date: "launchDate", fallbackAmount: 80000 },
  custom: { amount: "customTargetAmount", date: "customTargetDate", fallbackAmount: 6000 },
  car: { amount: "customTargetAmount", date: "customTargetDate", fallbackAmount: 90000 },
};

export function computeGoalFeasibility(goalType, inputs) {
  const monthlyIncome = numberValue(inputs.monthlyIncome, 7500);
  const monthlyExpenses = numberValue(inputs.monthlyExpenses, 3600);
  const availableMonthly = Math.max(monthlyIncome - monthlyExpenses, 100);

  let requiredMonthly;
  let targetAmount = null;
  let monthsRemaining = null;

  if (DIRECT_MONTHLY_FIELDS[goalType]) {
    requiredMonthly = Math.max(50, numberValue(inputs[DIRECT_MONTHLY_FIELDS[goalType]], 500));
  } else {
    const config = LUMP_SUM_FIELDS[goalType] ?? LUMP_SUM_FIELDS.custom;
    targetAmount = numberValue(inputs[config.amount], config.fallbackAmount);
    monthsRemaining = monthCountUntil(inputs[config.date]);
    requiredMonthly = Math.max(50, Math.ceil(targetAmount / monthsRemaining / 50) * 50);
  }

  const affordabilityRatio = availableMonthly / requiredMonthly;
  // Centered on ratio 1.0 (exactly enough) at score 50, +/-30 points per
  // whole ratio unit away from that, clamped to a 20-96 band so nothing
  // ever reads as impossible (0) or risk-free (100).
  const feasibilityScore = clampScore(50 + (affordabilityRatio - 1) * 30, 20, 96);
  const riskLevel = feasibilityScore >= 70 ? "low" : feasibilityScore >= 45 ? "medium" : "high";

  return {
    monthlyIncome,
    monthlyExpenses,
    availableMonthly,
    requiredMonthly,
    targetAmount,
    monthsRemaining,
    affordabilityRatio: Math.round(affordabilityRatio * 100) / 100,
    feasibilityScore,
    riskLevel,
  };
}
