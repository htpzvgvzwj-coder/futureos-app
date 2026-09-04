// Future Echo from a Today payment — how one payment ripples along the
// Life line. Deterministic and conservative: the free-money hit is exact,
// the plan day-shift is a rough estimate and says "may".

const round0 = (n) => Math.round(Number(n) || 0);
const sgd = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const arr = (v) => (Array.isArray(v) ? v : []);

const DOMAIN_LABEL = { home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family", investment: "Freedom", retirement: "Retirement", travel: "Travel", loan: "Loan" };

// A payment is "large enough to echo" if it's a real chunk of a month.
export const ECHO_MIN = 400;

export function echoPayment({ amount, safeToSpend = null, protectedReserve = null, lifeThread = {} } = {}) {
  const a = round0(amount);
  const lines = [];

  // 1. free money now — exact
  lines.push({ id: "free", key: "Free money drops by {v} this month.", params: { v: sgd(a) }, tone: "down" });

  // 2. safety buffer
  const avail = Number(safeToSpend);
  const reserve = Number(protectedReserve);
  if (Number.isFinite(avail)) {
    if (Number.isFinite(reserve) && avail - a < reserve) {
      lines.push({ id: "safety", key: "This would dip into your safety buffer.", tone: "down" });
    } else {
      lines.push({ id: "safety", key: "Safety stays protected — this doesn't touch your buffer.", tone: "flat" });
    }
  } else {
    lines.push({ id: "safety", key: "Safety stays protected unless this takes you below your safety line.", tone: "flat" });
  }

  // 3. the plan currently claiming the most each month — a rough day-shift
  const biggest = arr(lifeThread.commitments)
    .filter((c) => (!c.status || c.status === "active") && Number(c.monthlyContribution) > 0)
    .sort((x, y) => y.monthlyContribution - x.monthlyContribution)[0];
  if (biggest) {
    const days = Math.round((a / Number(biggest.monthlyContribution)) * 30);
    if (days >= 3) {
      lines.push({
        id: "plan",
        key: "{plan} may reach its date about {n} days later.",
        params: { plan: DOMAIN_LABEL[biggest.domain] ?? cap(biggest.domain), n: days },
        tone: "down",
      });
    } else {
      lines.push({ id: "plan", key: "Your plans keep their dates.", tone: "flat" });
    }
  }

  return { amount: a, lines, basis: "a one-off — the free-money hit is exact, the plan shift is an estimate" };
}
