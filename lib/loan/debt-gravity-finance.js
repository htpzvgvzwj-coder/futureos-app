// Debt Gravity - the Loan Studio's domain finance engine (pure).
//
// Not a repayment calculator. Each real debt is a Gravity Body whose size
// is its confirmed balance; monthly cashflow is pulled toward it; the
// payoff point is a Release Knot; and the monthly payment that comes back
// after payoff is a Future Handoff the customer places - never auto-routed.
//
// Reducing-balance amortization is the same math loanAdapter already uses
// (monthsToPayoff). Unknown fees are `unknown`, never 0.

import { monthsToPayoff } from "../living-plan/monthly-shift-projection.js";
import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value * 100) / 100, provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}
function addMonths(n, now = new Date()) {
  if (n == null) return null;
  const d = new Date(now.getFullYear(), now.getMonth() + n, 1);
  return d.toISOString().slice(0, 7);
}

// Total interest paid to clear `principal` at `annualRatePercent` paying
// `monthlyPayment` every month (reducing balance). Returns { months,
// totalInterest } or null when the payment can't cover the interest.
export function amortize({ principal, annualRatePercent, monthlyPayment }) {
  const P0 = num(principal);
  const r = num(annualRatePercent) / 100 / 12;
  const pay = num(monthlyPayment);
  if (P0 <= 0) return { months: 0, totalInterest: 0 };
  if (pay <= 0) return null;
  if (r > 0 && pay <= P0 * r) return null; // never amortizes
  let bal = P0;
  let interest = 0;
  let months = 0;
  const CAP = 1200;
  while (bal > 0.01 && months < CAP) {
    const i = bal * r;
    interest += i;
    bal = bal + i - pay;
    months++;
  }
  return { months, totalInterest: Math.round(interest) };
}

// debts: [{ id, label, kind ('loan'|'card'), balance, annualRatePercent,
//   minimumMonthly, dueDay?, feeConfirmed? (early repayment fee),
//   provenance }]
// planData: { target_debt, extra_monthly, one_off_payment, breathing_room_floor,
//   repayment_strategy, excluded_debt_ids }
// context: { monthlyIncome, monthlyExpenses, otherGoalsMonthlyOutflow,
//   emergencyBufferMonths, protectedSavings, now }
export function computeDebtGravity({ debts = [], planData = {}, context = {} }) {
  const now = context.now ?? new Date();
  const excluded = new Set(Array.isArray(planData.excluded_debt_ids) ? planData.excluded_debt_ids : []);
  const active = debts.filter((d) => num(d.balance) > 0 && !excluded.has(d.id));
  if (active.length === 0) return { available: false, reason: "no_active_debt" };

  const extraMonthly = Math.max(0, num(planData.extra_monthly));
  const oneOff = Math.max(0, num(planData.one_off_payment));
  const targetId = planData.target_debt ?? largestGravity(active).id;

  const bodies = active.map((d) => {
    const isTarget = d.id === targetId;
    const balance = Math.max(0, num(d.balance) - (isTarget ? oneOff : 0));
    const minimum = num(d.minimumMonthly) || estimateMinimum(d);
    const payment = minimum + (isTarget ? extraMonthly : 0);
    const sched = amortize({ principal: balance, annualRatePercent: d.annualRatePercent, monthlyPayment: payment });
    const baseSched = amortize({ principal: num(d.balance), annualRatePercent: d.annualRatePercent, monthlyPayment: minimum });
    const feeKnown = d.feeConfirmed != null;
    return {
      id: d.id,
      label: d.label ?? d.id,
      kind: d.kind ?? "loan",
      isTarget,
      // Gravity Body size is the confirmed balance - real, not decoration.
      balance: fig(num(d.balance), d.provenance ?? "bank_confirmed"),
      annualRatePercent: d.annualRatePercent != null ? fig(num(d.annualRatePercent), "bank_confirmed") : fig(null, "unknown"),
      minimumMonthly: fig(minimum, d.minimumMonthly != null ? "bank_confirmed" : "system_estimate"),
      earlyRepaymentFee: fig(feeKnown ? num(d.feeConfirmed) : null, feeKnown ? "user_confirmed" : "unknown"),
      monthlyPayment: payment,
      monthsToPayoff: sched ? sched.months : monthsToPayoff({ principal: balance, annualRatePercent: d.annualRatePercent, monthlyPayment: payment }),
      totalInterest: sched ? sched.totalInterest : null,
      baselineMonthsToPayoff: baseSched ? baseSched.months : null,
      monthsSaved: sched && baseSched ? baseSched.months - sched.months : null,
      interestSaved: sched && baseSched ? Math.max(0, baseSched.totalInterest - sched.totalInterest - (feeKnown ? num(d.feeConfirmed) : 0)) : null,
      payoffMonth: sched ? addMonths(sched.months, now) : null,
      // released once this body clears
      releasedMonthlyAtPayoff: minimum,
    };
  });

  const target = bodies.find((b) => b.isTarget) ?? bodies[0];

  // Real cashflow headroom / breathing room now (all minimums + the extra).
  const income = num(context.monthlyIncome);
  const expenses = num(context.monthlyExpenses);
  const allMinimums = bodies.reduce((s, b) => s + b.minimumMonthly.value, 0);
  const otherGoals = num(context.otherGoalsMonthlyOutflow);
  const breathingRoom = income > 0 ? Math.round(income - expenses - allMinimums - otherGoals - extraMonthly) : null;
  const breathingFloor = num(planData.breathing_room_floor, 0);
  const belowBreathingFloor = breathingRoom != null && breathingRoom < breathingFloor;

  // One-off from protected savings? (a Pin can forbid it)
  const oneOffFromProtected = oneOff > 0 && num(context.protectedSavings) > 0 && oneOff > Math.max(0, num(context.currentSavings) - num(context.protectedSavings));

  // The Freedom Date: when the TARGET body's monthly payment becomes an
  // available resource again. Not a celebration - a date.
  const freedomMonth = target.payoffMonth;
  const releasedMonthly = target.releasedMonthlyAtPayoff;

  const sealable = breathingRoom == null || (breathingRoom >= breathingFloor && target.monthsToPayoff != null);
  const sealableReason = target.monthsToPayoff == null
    ? "payment_below_interest"
    : belowBreathingFloor
      ? "below_breathing_room_floor"
      : "ok";

  return {
    available: true,
    bodies,
    targetDebtId: target.id,
    extraMonthly: fig(extraMonthly, planData.extra_monthly != null ? "user_confirmed" : "system_estimate"),
    oneOff: fig(oneOff, planData.one_off_payment != null ? "user_confirmed" : "system_estimate"),
    breathingRoom: fig(breathingRoom, income > 0 ? "system_estimate" : "unknown"),
    breathingFloor,
    belowBreathingFloor,
    oneOffFromProtectedSavings: oneOffFromProtected,
    freedomDate: freedomMonth,
    releasedMonthlyAtFreedom: fig(releasedMonthly, "bank_confirmed"),
    // Future Handoff Preview - a GHOST until the debt actually clears.
    futureHandoffPreview: {
      whenMonth: freedomMonth,
      releasedMonthly,
      state: "ghost",
      note: "Shown before payoff - not released yet, and never auto-allocated.",
    },
    emergencyEffectMonths: expenses > 0 ? Math.round(((extraMonthly * 12) / expenses) * 10) / 10 : null,
    sealable,
    sealableReason,
    assumptions: [
      { text: "Reducing-balance amortization; the extra is applied every month", confidence: "high" },
      bodies.some((b) => b.earlyRepaymentFee.provenance === "unknown") ? { text: "Early-repayment fees not confirmed - shown as unknown, not assumed 0", confidence: "high" } : null,
    ].filter(Boolean),
    unknowns: [
      ...bodies.filter((b) => b.annualRatePercent.provenance === "unknown").map((b) => `apr:${b.id}`),
      ...bodies.filter((b) => b.earlyRepaymentFee.provenance === "unknown").map((b) => `fee:${b.id}`),
    ],
  };
}

function largestGravity(debts) {
  return [...debts].sort((a, b) => num(b.balance) - num(a.balance))[0];
}
function estimateMinimum(d) {
  if (d.kind === "card") return Math.max(50, Math.round(num(d.balance) * 0.03)); // ~3% min on a card
  // a loan without a stated installment: assume ~1% of balance
  return Math.max(50, Math.round(num(d.balance) * 0.01));
}

// Strategy comparison - NEVER auto-selected. Shows the three real options
// and their difference so the customer chooses.
export function strategyComparison({ debts = [], extraBudget = 0, context = {} }) {
  const budget = Math.max(0, num(extraBudget));
  if (budget <= 0 || debts.length < 2) return null;
  const run = (order) => {
    let totalInterest = 0;
    let lastPayoff = 0;
    let freed = 0;
    const ordered = [...debts].sort(order);
    let cascade = budget;
    for (const d of ordered) {
      const minimum = num(d.minimumMonthly) || estimateMinimum(d);
      const sched = amortize({ principal: num(d.balance), annualRatePercent: d.annualRatePercent, monthlyPayment: minimum + cascade });
      if (sched) {
        totalInterest += sched.totalInterest;
        lastPayoff = Math.max(lastPayoff, sched.months);
        cascade += minimum; // snowball the freed minimum into the next debt
        freed += minimum;
      }
    }
    return { totalInterest: Math.round(totalInterest), clearedAllInMonths: lastPayoff, monthlyFreedByEnd: Math.round(freed) };
  };
  const highestRate = run((a, b) => num(b.annualRatePercent) - num(a.annualRatePercent));
  const smallestBalance = run((a, b) => num(a.balance) - num(b.balance));
  const balanced = run((a, b) => num(b.annualRatePercent) * num(b.balance) - num(a.annualRatePercent) * num(a.balance));
  return {
    options: {
      highest_rate_first: { ...highestRate, reasoning: "Least total interest. Slower emotional wins." },
      smallest_balance_first: { ...smallestBalance, reasoning: "Fastest first payoff (a real monthly freed sooner). Usually a little more interest." },
      balanced: { ...balanced, reasoning: "Weighs rate and size together." },
    },
    interestDifference: Math.abs(highestRate.totalInterest - smallestBalance.totalInterest),
    note: "You choose the strategy - the system never picks for you.",
  };
}

// Back-solve: the extra monthly needed to clear the target debt by a chosen
// number of months from now.
export function requiredExtraForPayoffMonth({ debt, byMonths }) {
  if (!debt || !(byMonths > 0)) return null;
  const minimum = num(debt.minimumMonthly) || estimateMinimum(debt);
  let lo = 0;
  let hi = Math.max(1000, num(debt.balance));
  let best = null;
  for (let i = 0; i < 40 && hi - lo > 1; i++) {
    const mid = Math.round((lo + hi) / 2);
    const sched = amortize({ principal: num(debt.balance), annualRatePercent: debt.annualRatePercent, monthlyPayment: minimum + mid });
    if (sched && sched.months <= byMonths) {
      best = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}
