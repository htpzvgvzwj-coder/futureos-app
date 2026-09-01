// The one composed Financial-Twin bundle: the Twin + Safe-to-Spend +
// Future Balance + Money Rescue cases + Reality Drift, assembled from the
// customer's real rows. Extracted so BOTH `GET /api/financial-twin` and the
// Money Moments aggregator read it from the same builder (no api-to-api).
//
// Nothing here is invented; a user with no rows gets an empty twin.

import { loadFinancialTwin } from "./collect.js";
import { computeSafeToSpend } from "./safe-to-spend.js";
import { projectFutureBalance } from "./future-balance.js";
import { detectRescueCases } from "../money-rescue/detect.js";
import { detectRealityDrift, summariseObserved } from "../reality-drift/detect.js";
import {
  listFinancialAssets,
  listLiabilities,
  listIncomeStreams,
  listRecurringObligations,
} from "./rows-store.js";
import { listTransactions, getAccountBalances, getSpendingTotal } from "../transaction-ledger/store.js";
import { query } from "../db.js";

function iso(d) {
  if (!d) return null;
  return typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
}
function addDays(isoStr, n) {
  return new Date(new Date(isoStr).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
// Group posted transactions into the last N whole calendar months.
function monthlyBuckets(transactions, n) {
  const now = new Date();
  const months = [];
  for (let i = n; i >= 1; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months.map((m) => {
    const rows = transactions.filter(
      (t) => t.status === "posted" && String(t.postedAt ?? t.authorisedAt ?? "").slice(0, 7) === m,
    );
    const essentials = rows
      .filter((t) => t.direction === "debit" && !t.isInternalTransfer && !t.isCardRepayment)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const income = rows
      .filter((t) => t.direction === "credit" && t.channel === "salary")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return { month: m, essentials, income, contribution: 0 };
  });
}

export async function buildFinancialTwinBundle(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const [twin, assets, liabilities, incomeStreams, recurring, transactions, balances, spend90] = await Promise.all([
    loadFinancialTwin(userId),
    listFinancialAssets(userId),
    listLiabilities(userId),
    listIncomeStreams(userId),
    listRecurringObligations(userId),
    listTransactions(userId, { limit: 40 }),
    getAccountBalances(userId),
    getSpendingTotal(userId, { from: addDays(today, -90) }).catch(() => 0),
  ]);

  const commitmentsRes = await query(
    `select domain, monthly_contribution from goal_commitments where profile_key = $1 and status = 'active'`,
    [userId],
  );
  const commitments = commitmentsRes.rows.map((r) => ({
    domain: r.domain,
    monthlyContribution: Number(r.monthly_contribution),
  }));

  const obligations = [
    ...recurring
      .filter((r) => r.nextDueDate)
      .map((r) => ({ label: r.label || r.merchant || "bill", amount: r.monthlyAmount, dueDate: iso(r.nextDueDate), kind: r.kind })),
    ...liabilities
      .filter((l) => l.nextDueDate && l.minimumMonthly)
      .map((l) => ({ label: l.label || l.liabilityClass, amount: l.minimumMonthly, dueDate: iso(l.nextDueDate), kind: "loan_repayment" })),
  ];
  const inflows = incomeStreams
    .filter((s) => s.nextExpectedDate)
    .map((s) => ({
      label: s.label || s.kind,
      amount: s.monthlyAmount,
      expectedDate: iso(s.nextExpectedDate),
      confidence: s.sourceType === "bank_synced" ? "expected" : "conditional",
    }));

  const safeToSpend = computeSafeToSpend({ twin, obligations, inflows, now: today });

  const events = [
    ...inflows.map((i) => ({ date: i.expectedDate, amount: Math.abs(i.amount), label: i.label, confidence: i.confidence })),
    ...obligations.map((o) => ({ date: o.dueDate, amount: -Math.abs(o.amount), label: o.label, confidence: "confirmed" })),
    ...commitments.map((c) => ({ date: addDays(today, 30), amount: -Math.abs(c.monthlyContribution), label: `${c.domain} plan`, confidence: "confirmed" })),
  ];
  const nextPayday = inflows.map((i) => i.expectedDate).sort()[0] ?? null;
  const nextBillDate = obligations.map((o) => o.dueDate).sort()[0] ?? null;
  const futureBalance = projectFutureBalance({
    startingLiquid: twin.liquidAssets,
    now: today,
    events,
    nextPayday,
    nextBillDate,
  });

  const rescueCases = detectRescueCases({ twin, safeToSpend, transactions, recurring, commitments, incomeStreams, now: today });

  // Only months that actually have posted activity count as "observed" -
  // an empty calendar month is not evidence that income/spend fell to 0.
  const buckets = monthlyBuckets(transactions, 3).filter((b) => b.essentials > 0 || b.income > 0);
  const observed = summariseObserved(buckets);
  const realityDrift = detectRealityDrift({
    planned: {
      monthlyEssentials: recurring.filter((r) => r.kind !== "loan_repayment").reduce((s, r) => s + (r.monthlyAmount || 0), 0),
      monthlyIncome: incomeStreams.reduce((s, i) => s + (i.monthlyAmount || 0), 0),
      monthlyContribution: commitments.reduce((s, c) => s + (c.monthlyContribution || 0), 0),
    },
    observed,
    monthsPerImpactUnit: 1 / 200,
  });

  return {
    asOf: today,
    twin,
    balances,
    recentTransactions: transactions.slice(0, 12),
    allTransactions: transactions,
    safeToSpend,
    futureBalance,
    realityDrift,
    rescueCases,
    commitments,
    recurring,
    incomeStreams,
    spendingLast90Days: spend90,
    counts: {
      assets: assets.length,
      liabilities: liabilities.length,
      incomeStreams: incomeStreams.length,
      recurring: recurring.length,
    },
    isEmpty: twin.isEmpty && balances.length === 0,
  };
}
