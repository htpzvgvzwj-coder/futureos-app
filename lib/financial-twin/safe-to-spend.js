// Safe-to-Spend (Future Bank, Part 4). ONE honest answer to "how much can I
// use today without breaking something".
//
//   safeToSpend = posted liquid cash
//               - known near-term obligations (bills due before next income)
//               - protected reserve (Emergency buffer)
//               - already-committed amount (sealed plans' monthly claim)
//
// Every deduction has exactly ONE source and is subtracted once. Pure - no
// DB, no Date.now (a `now` and the row lists are passed in).

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

// twin:        buildFinancialTwin() output
// obligations: [{ label, amount, dueDate, kind }]   near-term scheduled outflows
// inflows:     [{ label, amount, expectedDate, confidence }]  scheduled income
// now:         ISO date string (the "today" the answer is anchored to)
export function computeSafeToSpend({ twin, obligations = [], inflows = [], now = null } = {}) {
  const today = now ?? new Date().toISOString().slice(0, 10);
  const liquid = money(twin?.liquidAssets);
  const protectedReserve = money(twin?.protectedAssets);
  const committed = money(twin?.committedMonthlyTotal);

  // "near-term" = due strictly before the next expected income.
  const nextIncome = [...inflows]
    .filter((i) => i.expectedDate && i.expectedDate >= today)
    .sort((a, b) => String(a.expectedDate).localeCompare(String(b.expectedDate)))[0] ?? null;
  const horizon = nextIncome?.expectedDate ?? null;

  const nearTerm = obligations.filter((o) => o.dueDate && o.dueDate >= today && (!horizon || o.dueDate < horizon));
  const nearTermTotal = round2(nearTerm.reduce((s, o) => s + money(o.amount), 0));

  const safeToSpend = round2(Math.max(0, liquid - nearTermTotal - protectedReserve - committed));

  // Projected lowest balance before the next income lands.
  const projectedLowBalance = round2(liquid - nearTermTotal - protectedReserve - committed);

  return {
    asOf: today,
    currency: twin?.currency ?? "SGD",
    safeToSpend,
    breakdown: {
      postedLiquidCash: round2(liquid),
      nearTermObligations: nearTermTotal, // billed / due before next income
      protectedReserve: round2(protectedReserve), // Emergency
      alreadyCommitted: round2(committed), // sealed plans
    },
    nearTermObligationsList: nearTerm.map((o) => ({ label: o.label ?? o.kind ?? "payment", amount: round2(money(o.amount)), dueDate: o.dueDate })),
    nextIncome: nextIncome
      ? { label: nextIncome.label ?? "income", amount: round2(money(nextIncome.amount)), expectedDate: nextIncome.expectedDate, inDays: daysBetween(today, nextIncome.expectedDate), confidence: nextIncome.confidence ?? "expected" }
      : null,
    projectedLowBalanceBeforeIncome: projectedLowBalance,
    belowProtectedFloor: projectedLowBalance < 0,
  };
}
