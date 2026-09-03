// Protected by Guardian — what Guardian actually guards, as promises kept,
// not detectors. The seven protection domains, each with a plain status and
// (on tap) the checks behind it. Pure: feed it the Financial Twin + the
// buildMoneyMoments() payload.

export const PROTECTION_DOMAINS = [
  "everyday_money",
  "bills",
  "safety_floor",
  "active_plans",
  "shared_money",
  "credit_pressure",
  "account_safety",
];

const NAME = {
  everyday_money: "Everyday money",
  bills: "Bills",
  safety_floor: "Safety floor",
  active_plans: "Active plans",
  shared_money: "Shared money",
  credit_pressure: "Credit pressure",
  account_safety: "Account safety",
};

// checks shown when the user opens a domain (no jargon, no detector grid)
const CHECKS = {
  everyday_money: ["Money left to spend before your next income", "Spending pace vs your recent months"],
  bills: ["Every known bill has money set aside before its date", "Bills landing before your salary"],
  safety_floor: ["Your emergency buffer stays above the months you chose", "Nothing is drawing it down"],
  active_plans: ["Each plan's monthly amount still fits your free cashflow", "No two plans claim the same money"],
  shared_money: ["Shared limits stay inside what both people agreed", "Private amounts are never exposed"],
  credit_pressure: ["Card balances vs the cash you can reach", "High-interest debt is not growing"],
  account_safety: ["Unusual or repeated transactions", "Payments that don't match your pattern"],
};

const has = (arr, re) => (arr ?? []).some((m) => re.test(`${m.kind ?? ""} ${m.title ?? ""} ${m.summary ?? ""} ${m.id ?? ""}`));

export function buildProtectionDomains({ twin = null, mm = {} } = {}) {
  const moments = (mm.moments ?? []).filter((m) => m.state === "new");
  const bankNow = mm.bankNow ?? {};
  const bb = twin?.balanceBreakdown ?? {};
  const belowFloor = Boolean(bankNow.belowProtectedFloor);
  const planMovement = mm.planMovement ?? [];
  const cardOwed =
    (Number(twin?.liabilitiesByClass?.credit_card_statement) || 0) +
    (Number(twin?.liabilitiesByClass?.credit_card_revolving) || 0);
  const liquid = Number(twin?.liquidAssets ?? bb.availableNow ?? 0);
  const hasPlans = (twin?.plansCount ?? mm.planMovement?.length ?? 0) > 0 || (bb.spokenFor ?? 0) > 0;
  const hasLinks = Boolean(mm.hasSharedAccess);
  const isEmpty = Boolean(mm.isEmpty || twin?.isEmpty);

  const domain = (id, status, detail) => ({ id, name: NAME[id], status, detail, checks: CHECKS[id] });

  const out = [];

  // everyday money
  if (isEmpty) out.push(domain("everyday_money", "unknown", "Add an account so Guardian can watch what's spendable."));
  else if (belowFloor) out.push(domain("everyday_money", "at_risk", "Less is available before your next income than your bills and buffer need."));
  else if (has(moments, /spend|drift|unusual increase/i)) out.push(domain("everyday_money", "watching", "Spending is running ahead of your recent pace."));
  else out.push(domain("everyday_money", "protected", "There is money to spend after bills and your buffer are covered."));

  // bills
  if (isEmpty) out.push(domain("bills", "unknown", "Add a bill or import transactions to protect due dates."));
  else if (has(moments, /bill|due|payment failed|direct debit/i)) out.push(domain("bills", "at_risk", "A bill is at risk before its date."));
  else out.push(domain("bills", "protected", "Every known bill has money set aside before its date."));

  // safety floor
  if (isEmpty) out.push(domain("safety_floor", "unknown", "Set an emergency target to protect a floor."));
  else if (belowFloor) out.push(domain("safety_floor", "at_risk", "Your buffer is below the months you chose to keep."));
  else out.push(domain("safety_floor", "protected", "Your emergency buffer is above your chosen floor."));

  // active plans
  if (!hasPlans) out.push(domain("active_plans", "unknown", "No active plans yet — start one from Explore."));
  else if (has(moments, /collision|compete|overload|plan impact/i) || planMovement.some((p) => (p.addedPressureMonthly ?? 0) > 0))
    out.push(domain("active_plans", "watching", "One or more plans are pressing on your free cashflow."));
  else out.push(domain("active_plans", "protected", "Each plan's monthly amount still fits, and none overlap."));

  // shared money
  if (!hasLinks) out.push(domain("shared_money", "unknown", "No one is linked — add a guardian, partner or dependant in Family & Care."));
  else if (has(moments, /shared|joint|partner|guardian/i)) out.push(domain("shared_money", "watching", "A shared plan needs both people to look."));
  else out.push(domain("shared_money", "protected", "Shared limits are inside what both people agreed; private amounts stay private."));

  // credit pressure
  if (cardOwed <= 0) out.push(domain("credit_pressure", "protected", "No card balance or high-interest debt to manage."));
  else if (liquid > 0 && cardOwed > liquid) out.push(domain("credit_pressure", "at_risk", "Your card balance is more than the cash you can reach."));
  else out.push(domain("credit_pressure", "watching", "You carry a card balance — Guardian is watching it against your cash."));

  // account safety
  if (has(moments, /unusual|duplicate|repeated|doesn't match|fraud/i)) out.push(domain("account_safety", "watching", "A transaction looks unusual or repeated."));
  else out.push(domain("account_safety", "protected", "Nothing unusual or repeated in your recent transactions."));

  const protectedCount = out.filter((d) => d.status === "protected").length;
  const total = out.filter((d) => d.status !== "unknown").length;
  const nextCheck = bankNow?.nextEvent?.kind === "income" || /salary|income/i.test(bankNow?.nextEvent?.label ?? "")
    ? "after your salary arrives"
    : "as your transactions and bills update";

  return {
    domains: out,
    summary: { protectedCount, total, nextCheck },
  };
}
