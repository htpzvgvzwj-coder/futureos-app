// Explore's sharper edges — the things that make a test feel like a
// consequence, not a calculator. All pure; feed them the Life Thread +
// Financial Twin the rest of the app already produces. Every output is an
// ESTIMATE and says so; nothing here writes.

import { computeReadyDateForMonthlyAmount } from "../home-draft-finance.js";

const round0 = (n) => Math.round(Number(n) || 0);
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const arr = (v) => (Array.isArray(v) ? v : []);

const DOMAIN_LABEL = {
  home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family",
  investment: "Freedom", retirement: "Retirement", loan: "Loan", travel: "Travel",
};
const NODE_FOR_DOMAIN = { home: "home", wedding: "relationships", family: "relationships", investment: "freedom", retirement: "future", emergency: "safety" };

const yearOf = (s) => {
  const m = /^(\d{4})/.exec(String(s ?? ""));
  return m ? Number(m[1]) : null;
};
const nowYear = () => new Date().getFullYear();

// ---------------------------------------------------------------------
// 1. Future Receipt — every test leaves a receipt.
//    { title, lines: [{ label, before, after, delta, direction }], summary }
// ---------------------------------------------------------------------
export function buildFutureReceipt({ title, changes = [] } = {}) {
  const lines = arr(changes)
    .map((c) => {
      const before = Number(c.before);
      const after = Number(c.after);
      if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
      const delta = round1(after - before);
      const fmt = c.unit === "months" ? (x) => `${round1(x)} mo` : c.unit === "date_shift_months" ? (x) => `${x > 0 ? "+" : ""}${round0(x)} mo` : (x) => money(x);
      return {
        label: c.label,
        before: fmt(before),
        after: fmt(after),
        delta: c.unit === "months" ? `${delta > 0 ? "+" : ""}${delta} mo` : c.unit === "date_shift_months" ? null : `${delta > 0 ? "+" : ""}${money(delta)}`,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
        unit: c.unit ?? "sgd",
      };
    })
    .filter(Boolean);

  const worst = lines.find((l) => l.direction === "down");
  const best = lines.find((l) => l.direction === "up");
  const summary = lines.length === 0
    ? "Nothing on your line moved."
    : `You tested: ${title}. ${lines.map((l) => `${l.label} ${l.before} → ${l.after}`).join("; ")}.`;

  return { title, lines, summary, hasCost: Boolean(worst), hasGain: Boolean(best), estimate: true };
}

// Turn a confirmed Change Ledger event into a receipt (for Recent Futures).
export function receiptFromLedgerEvent(event, t = (k) => k) {
  if (!event) return null;
  const set = arr(event.impact_set);
  const changes = set
    .filter((i) => i && i.before != null && i.after != null && Number(i.before) !== Number(i.after))
    .map((i) => ({
      label: DOMAIN_LABEL[i.goalId] ?? cap(String(i.metric || i.goalId || "").replace(/_/g, " ")),
      before: i.before,
      after: i.after,
      unit: i.unit === "sgd_per_month" ? "sgd" : i.unit === "date_shift_months" ? "date_shift_months" : i.unit === "months" ? "months" : "sgd",
    }));
  let title = t(event.message_key || event.action_type || "a change");
  if (typeof title !== "string" || /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(title)) {
    // an unresolved dotted key -> humanise the action type instead
    title = cap(String(event.action_type || "a change").replace(/[_.]/g, " "));
  }
  return buildFutureReceipt({ title, changes });
}

// ---------------------------------------------------------------------
// 2. Second-order impact — the chain, ending in a Guardian consequence.
//    "Home sooner → buffer drops → Guardian asks before discretionary spend"
// ---------------------------------------------------------------------
export function traceSecondOrder({ primaryDomain, direction = "earlier", lt = {} } = {}) {
  if (!primaryDomain) return null;
  const startNode = NODE_FOR_DOMAIN[primaryDomain] ?? primaryDomain;
  const edges = arr(lt.crossGoalEdges);
  const chain = [
    { node: DOMAIN_LABEL[primaryDomain] ?? cap(primaryDomain), effect: direction === "earlier" ? "moves earlier" : "moves later" },
  ];
  // walk the fixed relationship graph one or two hops
  const seen = new Set([startNode]);
  let cursor = startNode;
  for (let hop = 0; hop < 2; hop++) {
    const edge = edges.find((e) => e.from === cursor && !seen.has(e.to));
    if (!edge) break;
    seen.add(edge.to);
    const toLabel = { income: "Today", safety: "Safety", home: "Home", relationships: "Wedding", freedom: "Freedom", future: "Retirement" }[edge.to] ?? cap(edge.to);
    const effect = edge.to === "safety"
      ? (direction === "earlier" ? "buffer drops" : "buffer recovers")
      : edge.to === "future"
        ? (direction === "earlier" ? "slips a little" : "holds")
        : "feels the pull";
    chain.push({ node: toLabel, effect });
    cursor = edge.to;
  }
  // the Guardian consequence
  const bufferInvolved = chain.some((c) => c.node === "Safety");
  chain.push({
    node: "Guardian",
    effect: bufferInvolved && direction === "earlier"
      ? "asks before large discretionary spend while the buffer is low"
      : "keeps watching; nothing new needs permission",
    isGuardian: true,
  });
  return { chain, estimate: true };
}

// ---------------------------------------------------------------------
// 3. Cost of Delay — now / +6 / +12 months, side by side.
// ---------------------------------------------------------------------
export function costOfDelay({ domain, monthlyContribution, readyYear, twin = {}, deltas = [-12, -6, 0, 6, 12], downPaymentNeeded = null, currentSavings = null } = {}) {
  const essential = round0(twin.essentialMonthly ?? twin.monthlyExpenses ?? 0);
  const bufferMonths = twin.bufferMonths != null ? Number(twin.bufferMonths) : null;
  const room = twin.monthlyRoom != null ? Number(twin.monthlyRoom) : null;
  const C = round0(monthlyContribution ?? 0);
  const baseYear = Number(readyYear) || (nowYear() + 4);
  const monthsRemaining = Math.max(6, (baseYear - nowYear()) * 12);
  if (!(C > 0) || essential <= 0) return null;

  // When we know the real down-payment target + savings (home), the ready
  // year per row comes from the same projection the Home Studio uses:
  // change the monthly amount, walk savings forward to a real date.
  const realProjection = downPaymentNeeded != null && currentSavings != null;
  const extraForShift = (d) => {
    if (d === 0 || !realProjection) return 0;
    // solve roughly: what monthly gets you `|d|` months closer / further
    const base = computeReadyDateForMonthlyAmount({ downPaymentNeeded, currentSavings, monthlyAmount: C });
    if (base.monthsToReady == null) return 0;
    const targetMonths = Math.max(1, base.monthsToReady - d); // d<0 -> sooner -> fewer months
    return round0((downPaymentNeeded - currentSavings) / targetMonths) - C;
  };

  const rows = deltas.map((d) => {
    const sooner = d < 0 ? Math.abs(d) : 0;
    const later = d > 0 ? d : 0;
    const extra = extraForShift(d); // extra monthly needed (d<0) or freed (d>0)
    let readyY;
    if (realProjection) {
      const p = computeReadyDateForMonthlyAmount({ downPaymentNeeded, currentSavings, monthlyAmount: Math.max(1, C + extra) });
      readyY = p.readyMonth ? Number(p.readyMonth.slice(0, 4)) : baseYear + Math.round(d / 12);
    } else {
      readyY = baseYear + Math.round(d / 12);
    }
    const monthlyChange = round0(extra); // + = needs more, - = frees
    const bufferDelta = bufferMonths == null ? null : round1((-(C * sooner) / essential) + (later * (C / essential) * 0.5));
    const roomDelta = realProjection ? -monthlyChange : (d < 0 ? -round0(C * (sooner / Math.max(1, monthsRemaining - sooner))) : 0);
    return {
      delta: d,
      label: d === 0 ? "As planned" : d < 0 ? `${Math.abs(d)} months sooner` : `${d} months later`,
      labelKey: d === 0 ? "As planned" : d < 0 ? "{n} months sooner" : "{n} months later",
      labelParams: d === 0 ? null : { n: Math.abs(d) },
      readyYear: readyY,
      bufferMonthsAfter: bufferMonths == null ? null : round1(bufferMonths + (bufferDelta ?? 0)),
      monthlyRoomAfter: room == null ? null : round0(room + roomDelta),
      monthlyChange,
      note:
        d === 0 ? "Your current path." :
        d < 0 ? `Needs about ${money(Math.abs(monthlyChange) || C * sooner)}/month more — the buffer takes the hit.` :
        "Buffer recovers; the goal just arrives later.",
    };
  });
  return { domain, label: DOMAIN_LABEL[domain] ?? cap(domain), rows, realProjection, estimate: !realProjection };
}

// ---------------------------------------------------------------------
// 4. One Question Upgrade — the single input that most tightens the result.
// ---------------------------------------------------------------------
const QUESTION_PRIORITY = {
  home: [
    { id: "downpayment_savings", q: "How much have you saved toward the down payment?" },
    { id: "target_price", q: "Roughly what price are you aiming for?" },
    { id: "monthly_contribution", q: "How much can you put toward it each month?" },
  ],
  wedding: [
    { id: "monthly_contribution", q: "How much are you putting aside each month?" },
    { id: "guest_count", q: "About how many guests?" },
    { id: "partner_contribution", q: "How much is your partner adding each month?" },
  ],
  loan: [
    { id: "balance", q: "What's the current balance?" },
    { id: "rate", q: "What's the interest rate?" },
    { id: "extra_repayment", q: "How much extra could you pay each month?" },
  ],
  retirement: [
    { id: "target_income", q: "What monthly income do you want in retirement?" },
    { id: "retire_age", q: "At what age do you want to stop working?" },
  ],
  emergency: [
    { id: "essential_spending", q: "What's one month of essential spending?" },
    { id: "target_months", q: "How many months of cover do you want?" },
  ],
  travel: [
    { id: "trip_budget", q: "What's the trip budget?" },
    { id: "trip_month", q: "Which month is the trip?" },
  ],
  investment: [
    { id: "liquidity_gate_years", q: "How many years before you'd need this money back?" },
    { id: "amount", q: "How much are you thinking of investing?" },
  ],
  insurance: [
    { id: "dependents", q: "How many people depend on your income?" },
    { id: "desired_cover", q: "How much cover do you want in place?" },
  ],
  family: [
    { id: "shared_amount", q: "What amount do you want to share visibility of?" },
  ],
};

export function nextBestQuestion({ domain, known = [] } = {}) {
  const list = QUESTION_PRIORITY[domain] ?? [];
  const knownSet = new Set(known);
  const next = list.find((q) => !knownSet.has(q.id));
  if (!next) return null;
  return { ...next, domain, remaining: list.filter((q) => !knownSet.has(q.id)).length, estimate: true };
}

// ---------------------------------------------------------------------
// 5. Negative Recommendation — what NOT to do right now, and why.
// ---------------------------------------------------------------------
export function negativeRecommendations({ lt = {}, s2s = {} } = {}) {
  const out = [];
  const b = s2s.breakdown ?? {};
  const safe = round0(s2s.safeToSpend ?? 0);
  const nearBills = round0(b.nearTermObligations ?? 0);
  const nextIncomeDays = s2s.nextIncome?.inDays ?? null;

  if (nearBills > 0 && safe > 0 && safe < nearBills * 1.5) {
    const amt = money(Math.max(200, round0(safe * 0.5)));
    out.push({
      code: "bills_incoming",
      dontKey: "Don't move {amt} out of spending this week", dontParams: { amt },
      dont: `Don't move ${amt} out of spending this week`,
      becauseKey: nextIncomeDays != null ? "{v} of bills land before your income in {d} days. It's protecting them." : "{v} of bills land soon. It's protecting them.",
      becauseParams: { v: money(nearBills), d: nextIncomeDays },
      because: `${money(nearBills)} of bills land${nextIncomeDays != null ? ` before your income in ${nextIncomeDays} days` : " soon"}. It's protecting them.`,
    });
  }
  if (s2s.belowProtectedFloor) {
    out.push({
      code: "below_floor",
      dontKey: "Don't start a new monthly commitment yet", dont: "Don't start a new monthly commitment yet",
      becauseKey: "Your safety buffer is below its floor — rebuild it first, then add.",
      because: "Your safety buffer is below its floor — rebuild it first, then add.",
    });
  }
  const pw = lt.promiseWeight?.pressureWindow ?? null;
  if (pw && round0(pw.shortfall) > 0) {
    const names = arr(pw.driverCommitments).map((d) => DOMAIN_LABEL[d.domain] ?? cap(d.domain));
    out.push({
      code: "already_stretched",
      dontKey: "Don't add another plan this month", dont: "Don't add another plan this month",
      becauseKey: "{a} and {b} already want {v}/month more than is free.",
      becauseParams: { a: names[0] ?? "Two plans", b: names[1] ?? "another", v: money(pw.shortfall) },
      because: `${names.slice(0, 2).join(" and ")} already want ${money(pw.shortfall)}/month more than is free.`,
    });
  }
  const room = Number(lt.availableMonthlyCashflow);
  if (Number.isFinite(room) && room > 0 && room < 300) {
    out.push({
      code: "thin_room",
      dontKey: "Don't raise a plan's monthly amount right now", dont: "Don't raise a plan's monthly amount right now",
      becauseKey: "Only {v}/month is still flexible — a small change would leave no room to absorb a surprise.",
      becauseParams: { v: money(room) },
      because: `Only ${money(room)}/month is still flexible — a small change would leave no room to absorb a surprise.`,
    });
  }
  return { items: out.slice(0, 3), estimate: true };
}

// ---------------------------------------------------------------------
// 6. Future Stress Test — where a plan breaks under a shock.
// ---------------------------------------------------------------------
export function stressTest({ lt = {}, twin = {}, shock = "income_1mo" } = {}) {
  const essential = round0(twin.essentialMonthly ?? lt.monthlyExpenses ?? 0);
  const committed = round0(lt.monthlyCommittedTotal ?? 0);
  const liquid = round0(twin.liquidBuffer ?? twin.safeToSpend?.breakdown?.postedLiquidCash ?? 0);
  const monthlyBurn = essential + committed;
  if (monthlyBurn <= 0) return null;

  const SHOCKS = {
    income_1mo: { label: "Your income stops for 1 month", missedMonths: 1 },
    income_3mo: { label: "Your income stops for 3 months", missedMonths: 3 },
    big_bill: { label: "A surprise SGD 5,000 bill", oneOff: 5000, missedMonths: 0 },
  };
  const sh = SHOCKS[shock] ?? SHOCKS.income_1mo;
  const drain = (sh.oneOff ?? 0) + monthlyBurn * (sh.missedMonths ?? 0);
  const monthsUntilBreak = Math.floor(liquid / monthlyBurn);
  const survivesShock = liquid >= drain;
  // the commitment whose pause would extend the runway most
  const biggest = [...arr(lt.commitments)]
    .filter((c) => (Number(c.monthlyContribution) || 0) > 0)
    .sort((a, b) => (Number(b.monthlyContribution) || 0) - (Number(a.monthlyContribution) || 0))[0];

  return {
    shock: sh.label,
    survivesShock,
    monthsOfRunway: monthsUntilBreak,
    monthlyBurn,
    shortBy: survivesShock ? 0 : round0(drain - liquid),
    weakestPlan: biggest
      ? { domain: biggest.domain, label: DOMAIN_LABEL[biggest.domain] ?? cap(biggest.domain), monthly: round0(biggest.monthlyContribution), pausingBuysMonths: monthlyBurn > 0 ? round1((round0(biggest.monthlyContribution) * (monthsUntilBreak || 1)) / monthlyBurn) : 0 }
      : null,
    breaksAt: survivesShock ? null : `month ${Math.max(1, monthsUntilBreak + 1)}`,
    estimate: true,
  };
}

// ---------------------------------------------------------------------
// 7. Trade-off Ranking — not one "best" answer, but each option scored on
//    a different axis: least painful now / fastest to the goal / safest
//    for the buffer / most flexible to undo.
// ---------------------------------------------------------------------
export function rankTradeoffs(options = []) {
  const opts = arr(options).filter((o) => o && o.id);
  if (opts.length < 2) return { options: opts, winners: {}, estimate: true };
  const by = (fn, dir = 1) => [...opts].sort((a, b) => dir * (fn(b) - fn(a)))[0]?.id;
  const winners = {
    least_painful: by((o) => -(Number(o.monthlyCost) || 0)), // smallest hit to monthly room
    fastest: by((o) => -(Number(o.monthsToGoal) ?? 999)), // soonest ready
    safest: by((o) => Number(o.bufferAfter) ?? 0), // most buffer left
    most_flexible: by((o) => (o.reversible ? 1 : 0) + (Number(o.undoMonths) ? 1 / Number(o.undoMonths) : 0)),
  };
  const tagged = opts.map((o) => ({
    ...o,
    wins: Object.entries(winners).filter(([, id]) => id === o.id).map(([axis]) => axis),
  }));
  return { options: tagged, winners, estimate: true };
}

export const TRADEOFF_AXIS_LABEL = {
  least_painful: "Least painful now",
  fastest: "Fastest to the goal",
  safest: "Safest for your buffer",
  most_flexible: "Easiest to undo",
};

// ---------------------------------------------------------------------
// 8. Reality Confidence — what's a confirmed figure vs an assumption.
// ---------------------------------------------------------------------
export function realityConfidence({ twin = {}, lt = {} } = {}) {
  const confirmed = [];
  const estimated = [];
  const push = (list, label, value) => list.push({ label, value: value == null ? null : (typeof value === "number" ? money(value) : String(value)) });

  const bb = twin.twin?.balanceBreakdown ?? {};
  if (arr(twin.holdings?.cashAccounts).length || bb.total != null || bb.availableNow != null) push(confirmed, "Account balances", bb.availableNow);
  if (arr(twin.holdings?.incomeStreams).length || lt.monthlyExpenses != null) push(confirmed, "Recent income & bills", null);
  if (arr(lt.commitments).length) push(confirmed, "Plan commitments you sealed", lt.monthlyCommittedTotal);
  const cpf = arr(twin.holdings?.assets).find((a) => /cpf/i.test(a.assetClass || a.label || ""));
  if (cpf) push(confirmed, "CPF (SGFinDex-linked)", null);

  if (twin.safeToSpend?.nextIncome?.confidence && twin.safeToSpend.nextIncome.confidence !== "high") push(estimated, "Next income date", twin.safeToSpend.nextIncome.confidence);
  push(estimated, "Insurance cover gap", "your inputs, not a live policy link");
  push(estimated, "Home price & timeline", "an estimate until you set them");
  push(estimated, "Investment returns", "an assumption, not a promise");

  return { confirmed, estimated, estimate: true };
}

// ---------------------------------------------------------------------
// 9. Regret Check — the single downside most likely to sting later.
// ---------------------------------------------------------------------
export function regretCheck({ bufferMonthsAfter = null, floorMonths = 6, monthlyRoomAfter = null, planShiftMonths = 0 } = {}) {
  const risks = [];
  if (bufferMonthsAfter != null && bufferMonthsAfter < floorMonths) {
    risks.push({ code: "buffer_below_floor", weight: 3, text: `Your safety buffer drops to about ${round1(bufferMonthsAfter)} months — below the ${floorMonths} you chose. A bad month would bite.` });
  } else if (bufferMonthsAfter != null && bufferMonthsAfter < floorMonths + 2) {
    risks.push({ code: "buffer_thin", weight: 2, text: `Your buffer lands near its floor (~${round1(bufferMonthsAfter)} months). Little slack for a surprise.` });
  }
  if (monthlyRoomAfter != null && monthlyRoomAfter < 200) {
    risks.push({ code: "no_room", weight: 2, text: `Only about ${money(monthlyRoomAfter)}/month stays flexible — a small overspend would force a plan change.` });
  }
  if (planShiftMonths >= 6) {
    risks.push({ code: "long_delay", weight: 1, text: `Another goal slips about ${round0(planShiftMonths)} months — easy to resent later.` });
  }
  risks.sort((a, b) => b.weight - a.weight);
  return {
    mostLikely: risks[0] ?? { code: "none", weight: 0, text: "No obvious regret — the trade-off looks contained." },
    all: risks,
    estimate: true,
  };
}
