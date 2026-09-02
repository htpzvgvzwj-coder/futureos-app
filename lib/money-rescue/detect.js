// Money Rescue (Future Bank, Part 7). ONE place that turns real signals
// (the Financial Twin, Safe-to-Spend, the ledger, recurring obligations,
// commitments) into calm, actionable "here is a money problem and what you
// can do" cases.
//
// Every case answers: what happened / why it matters / what is at risk /
// how sure we are / your options / the recommended next step. Never just a
// red alert. Pure - all inputs passed in, no DB, no Date.now.

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

export const RESCUE_KINDS = [
  "payment_failed",
  "low_balance_ahead",
  "salary_missing",
  "duplicate_subscription",
  "large_unusual_spend",
  "bills_clustered",
  "plan_squeezes_emergency",
  "card_pressure_rising",
];

const OPT = (id, label) => ({ id, label });
const RESOLUTION_ACTIONS = ["snooze", "dismiss", "resolve"];

// ctx:
//  twin            - buildFinancialTwin() output
//  safeToSpend     - computeSafeToSpend() output
//  transactions    - recent ledger entries (mapped)
//  recurring       - recurring_obligations rows
//  commitments     - active sealed commitments [{ domain, monthlyContribution }]
//  incomeStreams   - income_streams rows
//  now             - ISO date
export function detectRescueCases(ctx = {}) {
  const { twin = {}, safeToSpend = null, transactions = [], recurring = [], commitments = [], incomeStreams = [], now = null } = ctx;
  const today = now ?? new Date().toISOString().slice(0, 10);
  const cases = [];

  // 1 - a payment failed
  for (const t of transactions) {
    if (t.status === "failed") {
      cases.push({
        id: `payment_failed:${t.id}`,
        kind: "payment_failed",
        whatHappened: `A ${t.channel ?? "payment"} of ${twin.currency ?? "SGD"} ${round2(money(t.amount))}${t.merchant ? ` to ${t.merchant}` : ""} did not go through.`,
        whyItMatters: "The biller may retry or charge a late fee; the money is still in your account.",
        atRisk: t.recurringGroup ? ["the linked subscription or bill"] : [],
        confidence: "confirmed",
        options: [OPT("retry", "Retry the payment"), OPT("update_source", "Pay from another account"), OPT("contact_biller", "Contact the biller")],
        recommendedAction: "retry",
        canContactBank: true,
        resolutionActions: RESOLUTION_ACTIONS,
      });
    }
  }

  // 2 - Safe-to-Spend will dip below the protected floor before next income
  if (safeToSpend && safeToSpend.belowProtectedFloor) {
    const shortfall = round2(-safeToSpend.projectedLowBalanceBeforeIncome);
    cases.push({
      id: "low_balance_ahead",
      kind: "low_balance_ahead",
      whatHappened: `Your scheduled payments before ${safeToSpend.nextIncome?.expectedDate ?? "your next income"} may bring Available to Spend about ${twin.currency ?? "SGD"} ${shortfall} below your protected floor.`,
      whyItMatters: "Covering those payments would eat into money you set aside for emergencies or a sealed plan.",
      atRisk: ["Emergency coverage", ...commitments.map((c) => `${c.domain} commitment`)].slice(0, 3),
      confidence: safeToSpend.nextIncome ? "expected" : "conditional",
      options: [
        OPT("reduce_contribution", "Reduce this month's plan contribution"),
        OPT("delay_flexible", "Delay a flexible payment"),
        OPT("open_mirror", "Compare another path in Mirror"),
      ],
      recommendedAction: "delay_flexible",
      canContactBank: false,
      resolutionActions: RESOLUTION_ACTIONS,
    });
  }

  // 3 - an expected salary has not landed
  for (const s of incomeStreams) {
    if (s.kind !== "salary" || !s.nextExpectedDate) continue;
    if (s.nextExpectedDate < today) {
      const landed = transactions.some(
        (t) => t.direction === "credit" && t.channel === "salary" && (t.postedAt ?? t.authorisedAt ?? "") >= s.nextExpectedDate,
      );
      if (!landed) {
        cases.push({
          id: `salary_missing:${s.id}`,
          kind: "salary_missing",
          whatHappened: `${s.label || "Your salary"} of about ${twin.currency ?? "SGD"} ${round2(money(s.monthlyAmount))} was expected on ${s.nextExpectedDate} and has not been received.`,
          whyItMatters: "Upcoming bills assume this income; a delay could push Available to Spend low.",
          atRisk: ["this month's bills", "Safe-to-Spend"],
          confidence: "expected",
          options: [OPT("check_employer", "Check with your employer"), OPT("buffer_plan", "See a short-term buffer plan"), OPT("open_rescue_plan", "Open an income-interruption plan")],
          recommendedAction: "buffer_plan",
          canContactBank: false,
          resolutionActions: RESOLUTION_ACTIONS,
        });
      }
    }
  }

  // 4 - two active recurring charges to the same merchant / group
  const byMerchant = {};
  for (const r of recurring) {
    if (!r.active) continue;
    const key = (r.merchant || r.label || "").toLowerCase().trim();
    if (!key) continue;
    (byMerchant[key] = byMerchant[key] ?? []).push(r);
  }
  for (const [key, list] of Object.entries(byMerchant)) {
    if (list.length >= 2) {
      cases.push({
        id: `duplicate_subscription:${key}`,
        kind: "duplicate_subscription",
        whatHappened: `You have ${list.length} active recurring charges that look like the same service (${list[0].merchant || list[0].label}).`,
        whyItMatters: `Together they cost about ${twin.currency ?? "SGD"} ${round2(list.reduce((s, r) => s + money(r.monthlyAmount), 0))}/month.`,
        atRisk: ["monthly free cashflow"],
        confidence: "expected",
        options: [OPT("review", "Review both charges"), OPT("cancel_one", "Cancel the duplicate"), OPT("keep_both", "Keep both (they are different)")],
        recommendedAction: "review",
        canContactBank: false,
        resolutionActions: RESOLUTION_ACTIONS,
      });
    }
  }

  // 5 - a single posted spend far above the recent norm
  const posted = transactions.filter((t) => t.status === "posted" && t.direction === "debit" && !t.isInternalTransfer && !t.isCardRepayment);
  if (posted.length >= 4) {
    const amounts = posted.map((t) => money(t.amount)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const big = posted.filter((t) => money(t.amount) >= Math.max(500, median * 4));
    for (const t of big.slice(0, 2)) {
      cases.push({
        id: `large_unusual_spend:${t.id}`,
        kind: "large_unusual_spend",
        whatHappened: `A ${twin.currency ?? "SGD"} ${round2(money(t.amount))} payment${t.merchant ? ` to ${t.merchant}` : ""} is well above your usual spend.`,
        whyItMatters: "If this was not expected, it may be an error or fraud; if it was, it changes this month's Safe-to-Spend.",
        atRisk: ["this month's Available to Spend"],
        confidence: "expected",
        options: [OPT("recognise", "I recognise this"), OPT("dispute", "I don't recognise this"), OPT("recategorise", "Move it to the right category")],
        recommendedAction: "recognise",
        canContactBank: true,
        resolutionActions: RESOLUTION_ACTIONS,
      });
    }
  }

  // 6 - several bills fall in a tight window
  const upcomingBills = recurring
    .filter((r) => r.active && r.nextDueDate && r.nextDueDate >= today)
    .sort((a, b) => String(a.nextDueDate).localeCompare(String(b.nextDueDate)));
  if (upcomingBills.length >= 3) {
    const first = upcomingBills[0].nextDueDate;
    const cluster = upcomingBills.filter((r) => (new Date(r.nextDueDate) - new Date(first)) / 86_400_000 <= 7);
    if (cluster.length >= 3) {
      cases.push({
        id: `bills_clustered:${first}`,
        kind: "bills_clustered",
        whatHappened: `${cluster.length} bills totalling about ${twin.currency ?? "SGD"} ${round2(cluster.reduce((s, r) => s + money(r.monthlyAmount), 0))} are due within a week of ${first}.`,
        whyItMatters: "A cluster of payments can briefly push your balance low even when the month balances out.",
        atRisk: ["Safe-to-Spend around " + first],
        confidence: "expected",
        options: [OPT("stagger", "Ask billers to change due dates"), OPT("prefund", "Move money in ahead of time"), OPT("open_future_balance", "See it on Future Balance")],
        recommendedAction: "prefund",
        canContactBank: false,
        resolutionActions: RESOLUTION_ACTIONS,
      });
    }
  }

  // 7 - a plan's monthly claim would take Emergency below its floor
  if (twin.monthlyFreeCashflow != null && twin.monthlyFreeCashflow < 0 && commitments.length > 0) {
    cases.push({
      id: "plan_squeezes_emergency",
      kind: "plan_squeezes_emergency",
      whatHappened: `Your income minus expenses, scheduled debt and sealed plans is about ${twin.currency ?? "SGD"} ${round2(twin.monthlyFreeCashflow)}/month - a shortfall.`,
      whyItMatters: "Keeping every plan on schedule would draw down savings, including your Emergency buffer.",
      atRisk: ["Emergency coverage", ...commitments.map((c) => `${c.domain} plan`)].slice(0, 3),
      confidence: "expected",
      options: [OPT("pause_one", "Pause one plan's contribution"), OPT("reduce_all", "Reduce each plan proportionally"), OPT("open_mirror", "Rebalance in Mirror")],
      recommendedAction: "open_mirror",
      canContactBank: false,
      resolutionActions: RESOLUTION_ACTIONS,
    });
  }

  // 8 - credit-card owed is rising toward the limit
  const cardOwed = money(twin.liabilitiesByClass?.credit_card_statement) + money(twin.liabilitiesByClass?.credit_card_revolving);
  if (cardOwed > 0 && twin.liquidAssets != null && cardOwed > twin.liquidAssets * 0.5) {
    cases.push({
      id: "card_pressure_rising",
      kind: "card_pressure_rising",
      whatHappened: `Your credit-card balance (${twin.currency ?? "SGD"} ${round2(cardOwed)}) is more than half your liquid cash.`,
      whyItMatters: "If it is not cleared in full it starts accruing interest, which is hard to unwind.",
      atRisk: ["monthly free cashflow", "credit health"],
      confidence: "expected",
      options: [OPT("pay_full", "Pay the statement in full now"), OPT("pay_partial", "Pay what you safely can"), OPT("repayment_plan", "Open a repayment plan")],
      recommendedAction: "pay_partial",
      canContactBank: true,
      resolutionActions: RESOLUTION_ACTIONS,
    });
  }

  // Merge cases with the same kind + same root cause so the customer is
  // never shown two versions of one problem.
  const seen = new Set();
  return cases.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
