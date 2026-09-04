// Explore's sharper edges — the things that make a test feel like a
// consequence, not a calculator. All pure; feed them the Life Thread +
// Financial Twin the rest of the app already produces. Every output is an
// ESTIMATE and says so; nothing here writes.

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
export function costOfDelay({ domain, monthlyContribution, readyYear, twin = {}, deltas = [-12, -6, 0, 6, 12] } = {}) {
  const essential = round0(twin.essentialMonthly ?? twin.monthlyExpenses ?? 0);
  const bufferMonths = twin.bufferMonths != null ? Number(twin.bufferMonths) : null;
  const room = twin.monthlyRoom != null ? Number(twin.monthlyRoom) : null;
  const C = round0(monthlyContribution ?? 0);
  const baseYear = Number(readyYear) || (nowYear() + 4);
  const monthsRemaining = Math.max(6, (baseYear - nowYear()) * 12);
  if (!(C > 0) || essential <= 0) return null;

  const rows = deltas.map((d) => {
    // Pulling in by |d| months (d<0) needs the remaining deposit sooner:
    // a rough one-off from savings ~ C * |d|, which costs buffer + room.
    // Waiting (d>0) gives the buffer |d| * (C/essential) months back.
    const sooner = d < 0 ? Math.abs(d) : 0;
    const later = d > 0 ? d : 0;
    const oneOffPull = C * sooner;
    const bufferDelta = bufferMonths == null ? null : round1((-(oneOffPull) / essential) + (later * (C / essential) * 0.5));
    const roomDelta = d < 0 ? -round0(C * (sooner / Math.max(1, monthsRemaining - sooner))) : 0;
    return {
      delta: d,
      label: d === 0 ? "As planned" : d < 0 ? `${Math.abs(d)} months sooner` : `${d} months later`,
      readyYear: baseYear + Math.round(d / 12),
      bufferMonthsAfter: bufferMonths == null ? null : round1(bufferMonths + (bufferDelta ?? 0)),
      monthlyRoomAfter: room == null ? null : round0(room + roomDelta),
      note:
        d === 0 ? "Your current path." :
        d < 0 ? `Needs about ${money(oneOffPull)} pulled forward — the buffer takes the hit.` :
        "Buffer recovers; the goal just arrives later.",
    };
  });
  return { domain, label: DOMAIN_LABEL[domain] ?? cap(domain), rows, estimate: true };
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
    out.push({
      dont: `Don't move ${money(Math.max(200, round0(safe * 0.5)))} out of spending this week`,
      because: `${money(nearBills)} of bills land${nextIncomeDays != null ? ` before your income in ${nextIncomeDays} days` : " soon"}. It's protecting them.`,
      code: "bills_incoming",
    });
  }
  if (s2s.belowProtectedFloor) {
    out.push({
      dont: "Don't start a new monthly commitment yet",
      because: "Your safety buffer is below its floor — rebuild it first, then add.",
      code: "below_floor",
    });
  }
  const pw = lt.promiseWeight?.pressureWindow ?? null;
  if (pw && round0(pw.shortfall) > 0) {
    const names = arr(pw.driverCommitments).map((d) => DOMAIN_LABEL[d.domain] ?? cap(d.domain));
    out.push({
      dont: "Don't add another plan this month",
      because: `${names.slice(0, 2).join(" and ")} already want ${money(pw.shortfall)}/month more than is free.`,
      code: "already_stretched",
    });
  }
  const room = Number(lt.availableMonthlyCashflow);
  if (Number.isFinite(room) && room > 0 && room < 300) {
    out.push({
      dont: "Don't raise a plan's monthly amount right now",
      because: `Only ${money(room)}/month is still flexible — a small change would leave no room to absorb a surprise.`,
      code: "thin_room",
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
