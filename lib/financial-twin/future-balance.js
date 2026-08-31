// Future Balance (Future Bank, Part 4). A forward projection of the
// customer's liquid balance at named horizons, where EVERY point is
// labelled by how sure we are:
//
//   confirmed   - a scheduled, known-amount event (a standing GIRO bill,
//                 a sealed commitment transfer)
//   expected    - a recurring pattern with history (salary on the 25th)
//   conditional - depends on a choice not yet made (an active branch,
//                 a plan still being explored)
//   unknown     - no basis; shown as a gap, never a number
//
// Pure. `now`, the starting liquid balance and all event lists are passed
// in. No Date.now, no DB.

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function addDays(iso, d) {
  const t = new Date(iso).getTime() + d * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export const CONFIDENCE = ["confirmed", "expected", "conditional", "unknown"];

// events: [{ date, amount (signed: +in / -out), label, confidence, kind }]
// horizons: optional extra named dates [{ id, label, date }]
export function projectFutureBalance({
  startingLiquid = 0,
  now = null,
  events = [],
  nextPayday = null,
  nextBillDate = null,
  nextTurningPoint = null,
  goalDate = null,
  goalLabel = null,
} = {}) {
  const today = now ?? new Date().toISOString().slice(0, 10);
  const start = money(startingLiquid);

  const sorted = [...events]
    .filter((e) => e.date && e.date >= today)
    .map((e) => ({ ...e, amount: money(e.amount), confidence: CONFIDENCE.includes(e.confidence) ? e.confidence : "expected" }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // balance at a target date = start + Σ signed events on/before it. The
  // point's confidence = the WEAKEST confidence among the events applied
  // (a single conditional event makes the whole point conditional).
  const rank = { confirmed: 0, expected: 1, conditional: 2, unknown: 3 };
  function at(dateIso) {
    if (!dateIso) return { date: null, balance: null, confidence: "unknown", appliedEvents: 0 };
    let bal = start;
    let worst = "confirmed";
    let applied = 0;
    for (const e of sorted) {
      if (e.date <= dateIso) {
        bal += e.amount;
        applied += 1;
        if (rank[e.confidence] > rank[worst]) worst = e.confidence;
      }
    }
    return { date: dateIso, balance: round2(bal), confidence: applied === 0 ? "confirmed" : worst, appliedEvents: applied };
  }

  const points = [
    { id: "today", label: "Today", ...at(today), balance: round2(start), confidence: "confirmed" },
    { id: "next_payday", label: "Next payday", ...at(nextPayday) },
    { id: "next_bill", label: "Next bill", ...at(nextBillDate) },
    { id: "in_30_days", label: "In 30 days", ...at(addDays(today, 30)) },
    { id: "in_90_days", label: "In 90 days", ...at(addDays(today, 90)) },
    { id: "next_turning_point", label: "Next turning point", ...at(nextTurningPoint) },
    { id: "goal_date", label: goalLabel ?? "Goal date", ...at(goalDate) },
  ];

  const lowest = points
    .filter((p) => p.balance != null)
    .reduce((min, p) => (min == null || p.balance < min.balance ? p : min), null);

  return {
    asOf: today,
    startingLiquid: round2(start),
    points,
    lowestPoint: lowest ? { id: lowest.id, label: lowest.label, date: lowest.date, balance: lowest.balance, confidence: lowest.confidence } : null,
    hasUnknownHorizon: points.some((p) => p.date == null),
  };
}
