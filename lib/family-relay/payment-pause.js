// Payment Pause — an older adult starts a payment. Guardian holds it ONLY
// for concrete signals — a new payee, an amount well outside this
// account's pattern, a duplicate of a very recent payment, or a sudden
// change in pace — and always says which. It never blocks a normal
// payment for the account holder being old, and the person can always
// continue after seeing why.
//
// Pure. Returns:
//   {
//     paused: boolean,
//     triggers: [{ code, text }],
//     options:  ["continue","later","call_trusted","see_why"],   // always offered
//   }

const round0 = (n) => Math.round(Number(n) || 0);
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const norm = (s) => String(s || "").trim().toLowerCase();
const DAY = 86_400_000;

export function evaluatePaymentPause({
  amount,
  payee = "",
  at = Date.now(),
  knownPayees = [],
  recentPayments = [], // [{ payee, amount, at }]
  typicalMax = null, // the largest ordinary payment this account makes
} = {}) {
  const amt = round0(amount);
  const triggers = [];
  if (!(amt > 0)) {
    return { paused: false, triggers: [], options: ["continue"] };
  }

  const knownSet = new Set(knownPayees.map(norm));
  const isKnownPayee = knownSet.has(norm(payee)) || recentPayments.some((p) => norm(p.payee) === norm(payee));

  // 1 — a brand-new payee
  if (payee && !isKnownPayee) {
    triggers.push({ code: "new_payee", text: `${payee} is a new payee — this account hasn't paid them before.` });
  }

  // 2 — amount well outside the ordinary pattern (>2x typical, or >2x the
  // biggest recent payment when no typicalMax is given)
  const recentMax = recentPayments.reduce((m, p) => Math.max(m, round0(p.amount)), 0);
  const baseline = typicalMax != null ? round0(typicalMax) : recentMax;
  if (baseline > 0 && amt >= baseline * 2) {
    triggers.push({ code: "unusual_amount", text: `${money(amt)} is well above this account's usual payments (up to about ${money(baseline)}).` });
  }

  // 3 — a duplicate of a payment in the last 3 days (same payee, within 1%)
  const dup = recentPayments.find(
    (p) => norm(p.payee) === norm(payee) && at - Number(p.at) <= 3 * DAY && Math.abs(round0(p.amount) - amt) <= Math.max(1, amt * 0.01),
  );
  if (dup) {
    triggers.push({ code: "possible_duplicate", text: `A payment of about ${money(dup.amount)} to ${payee} already went out in the last few days.` });
  }

  // 4 — a sudden change in pace: 3+ payments to new payees in 24h
  const newPayeePaymentsToday = recentPayments.filter(
    (p) => at - Number(p.at) <= DAY && !knownSet.has(norm(p.payee)),
  ).length;
  if (newPayeePaymentsToday >= 3) {
    triggers.push({ code: "pace_change", text: `Several payments to new payees in the last day — more than usual for this account.` });
  }

  return {
    paused: triggers.length > 0,
    triggers,
    options: triggers.length > 0
      ? ["continue", "later", "call_trusted", "see_why"]
      : ["continue"],
  };
}

export const PAUSE_OPTION_LABEL = {
  continue: "Continue the payment",
  later: "Deal with it later",
  call_trusted: "Ask someone I trust",
  see_why: "See why this paused",
};
