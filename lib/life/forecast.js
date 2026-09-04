// Life Pressure Weather — the forecast (Life vision Phase 3). Not a score:
// it looks a few months ahead at your real recurring obligations + plan
// commitments, finds the month where the non-monthly ones land together,
// and names them ("October may become tight because insurance, the wedding
// deposit and the town-council levy arrive in the same month").
//
// Pure: feed it the obligations + monthly income + committed monthly +
// (optional) free monthly. `monthlyAmount` on a non-monthly obligation is
// read as the charge that lands on its due date.

const round0 = (n) => Math.round(Number(n) || 0);
const arr = (v) => (Array.isArray(v) ? v : []);
const MONTHLY = new Set(["monthly", "", null, undefined]);

function ymOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d) {
  return d.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}
// step a due date forward by its cadence until it is >= from
function nextOccurrence(dueISO, cadence, from) {
  const d = new Date(dueISO);
  if (Number.isNaN(d.getTime())) return null;
  const stepMonths = cadence === "quarterly" ? 3 : cadence === "annual" ? 12 : cadence === "one_off" ? 0 : 1;
  if (stepMonths === 0) return d >= from ? d : null; // a one-off in the past no longer counts
  let guard = 0;
  while (d < from && guard < 60) {
    d.setMonth(d.getMonth() + stepMonths);
    guard += 1;
  }
  return d;
}

export function buildPressureForecast({
  obligations = [],
  incomeMonthly = 0,
  committedMonthly = 0,
  freeMonthly = null,
  horizonMonths = 4,
  now = new Date(),
} = {}) {
  const income = round0(incomeMonthly);
  const monthlyBills = arr(obligations)
    .filter((o) => MONTHLY.has(o.cadence))
    .reduce((s, o) => s + round0(o.monthlyAmount ?? o.monthly_amount), 0);
  const baseline = monthlyBills + round0(committedMonthly);

  // "tight" threshold: whatever the customer usually has free, else 15% of income
  const tightBelow = freeMonthly != null ? Math.max(0, round0(freeMonthly)) : Math.round(income * 0.15);

  const nonMonthly = arr(obligations)
    .filter((o) => !MONTHLY.has(o.cadence))
    .map((o) => ({
      label: o.label ?? o.merchant ?? "A scheduled charge",
      amount: round0(o.monthlyAmount ?? o.monthly_amount),
      cadence: o.cadence,
      due: o.nextDueDate ?? o.next_due_date ?? null,
    }))
    .filter((o) => o.due && o.amount > 0);

  const months = [];
  for (let i = 1; i <= horizonMonths; i += 1) {
    const first = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = ymOf(first);
    const drivers = [];
    let extra = 0;
    for (const o of nonMonthly) {
      const occ = nextOccurrence(o.due, o.cadence, now);
      if (occ && ymOf(occ) === ym) {
        drivers.push(o.label);
        extra += o.amount;
      }
    }
    const scheduledOutflow = baseline + extra;
    const headroom = income - scheduledOutflow;
    const pressure = headroom < 0 ? "exposed" : headroom < tightBelow ? "tight" : "calm";
    months.push({
      ym,
      label: monthLabel(first),
      shortLabel: first.toLocaleDateString("en-SG", { month: "long" }),
      baseline,
      extra,
      scheduledOutflow,
      headroom,
      pressure,
      drivers,
    });
  }

  const nextTight = months.find((m) => m.pressure !== "calm") ?? null;
  return {
    months,
    nextTight,
    basis: "your recurring bills, plan commitments and any annual / one-off charges on record",
  };
}

// The one-line headline for the Life page strip.
export function forecastHeadline(forecast) {
  const m = forecast?.nextTight;
  if (!m) return null;
  const ds = m.drivers.slice(0, 3);
  const pressure = m.pressure === "exposed" ? "exposed" : "tight";
  if (ds.length <= 1) {
    return {
      key: "{month} may become {pressure} — {driver} falls due then.",
      params: { month: m.shortLabel, pressure, driver: ds[0] || "a large charge" },
      month: m.shortLabel,
      pressure: m.pressure,
    };
  }
  const list = `${ds.slice(0, -1).join(", ")} and ${ds[ds.length - 1]}`;
  return {
    key: "{month} may become {pressure} — {drivers} land in the same month.",
    params: { month: m.shortLabel, pressure, drivers: list },
    month: m.shortLabel,
    pressure: m.pressure,
  };
}
