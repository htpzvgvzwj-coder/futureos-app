// Living Plan - Promise Weight (pure, no DB/AI).
//
// Every sealed Living Commitment has weight: the monthly resource it uses,
// the payment/decision dates it carries, and how it competes with the
// other sealed commitments for the same cashflow. This is NOT a risk score
// and NOT a red alert. It answers: "over the next N months, how many
// promises are pulling on your money, and which month is tightest?"
//
// Input is real: confirmed commitments + confirmed payment milestones +
// the customer's real monthly free cashflow. Output is a small, calm
// status plus the evidence behind it.

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function monthKey(d) {
  return d.toISOString().slice(0, 7);
}
function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + n, 1)));
}
function monthsBetween(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// commitments: [{ id, domain, monthlyAmount, label, milestones?: [{ id,
//   label, amount, dueMonth }], startMonth?, endMonth? }]
// context: { monthlyFreeCashflow, emergencyFloorMonths?, monthlyExpenses? }
// horizonMonths: how far ahead to look (default 18)
export function computePromiseWeight({ commitments = [], context = {}, now = new Date(), horizonMonths = 18 }) {
  const start = monthKey(now);
  const freeCashflow = num(context.monthlyFreeCashflow);
  const months = [];

  for (let i = 0; i < horizonMonths; i += 1) {
    const key = addMonths(start, i);
    let recurring = 0;
    const contributing = [];
    const lumpsThisMonth = [];

    for (const c of commitments) {
      const active =
        (!c.startMonth || monthsBetween(c.startMonth, key) >= 0) &&
        (!c.endMonth || monthsBetween(key, c.endMonth) >= 0);
      if (active && num(c.monthlyAmount) > 0) {
        recurring += num(c.monthlyAmount);
        contributing.push({ id: c.id, domain: c.domain, label: c.label, monthlyAmount: num(c.monthlyAmount) });
      }
      for (const ms of c.milestones ?? []) {
        if (ms.dueMonth === key && num(ms.amount) > 0) {
          lumpsThisMonth.push({ commitmentId: c.id, domain: c.domain, label: ms.label, amount: num(ms.amount) });
        }
      }
    }

    const lumpTotal = lumpsThisMonth.reduce((s, l) => s + l.amount, 0);
    // A lump due this month is spread against the free cashflow of that
    // single month (the honest "can you cover it when it lands" view).
    const demand = recurring + lumpTotal;
    const coverageRatio = freeCashflow > 0 ? demand / freeCashflow : demand > 0 ? Infinity : 0;

    months.push({
      month: key,
      recurringDemand: Math.round(recurring),
      lumpDemand: Math.round(lumpTotal),
      totalDemand: Math.round(demand),
      freeCashflow: Math.round(freeCashflow),
      coverageRatio: Number.isFinite(coverageRatio) ? Math.round(coverageRatio * 100) / 100 : null,
      shortfall: Math.max(0, Math.round(demand - freeCashflow)),
      contributingCommitments: contributing,
      lumps: lumpsThisMonth,
    });
  }

  // Pressure Window = the tightest run of months (highest coverage ratio /
  // any shortfall).
  const pressure = months
    .filter((m) => m.shortfall > 0 || (m.coverageRatio != null && m.coverageRatio >= 0.85))
    .sort((a, b) => b.totalDemand - a.totalDemand)[0] ?? null;

  const activeCount = new Set(months.flatMap((m) => m.contributingCommitments.map((c) => c.id))).size;
  const anyShortfall = months.some((m) => m.shortfall > 0);
  const anyTight = months.some((m) => m.coverageRatio != null && m.coverageRatio >= 0.85);

  let status = "calm";
  if (anyShortfall) status = "needs_a_decision";
  else if (anyTight) status = "tightening";

  return {
    status, // calm | tightening | needs_a_decision
    horizonMonths,
    activeCommitmentCount: activeCount,
    pressureWindow: pressure
      ? {
          month: pressure.month,
          totalDemand: pressure.totalDemand,
          freeCashflow: pressure.freeCashflow,
          shortfall: pressure.shortfall,
          coverageRatio: pressure.coverageRatio,
          driverCommitments: [
            ...pressure.contributingCommitments,
            ...pressure.lumps.map((l) => ({ id: l.commitmentId, domain: l.domain, label: l.label, lumpAmount: l.amount })),
          ],
        }
      : null,
    months,
    evidence: {
      commitmentIds: commitments.map((c) => c.id),
      monthlyFreeCashflow: Math.round(freeCashflow),
      computedFrom: "sealed commitments + confirmed payment milestones + real free cashflow",
    },
    // Never a fear message - just the fact.
    headlineKey: `promiseWeight.headline.${status}`,
  };
}
