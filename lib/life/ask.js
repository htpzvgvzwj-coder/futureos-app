// Two of Life's deeper interactions, both pure and both refusing to invent
// a number:
//
//   buildFutureEcho(lt)      - for each plan you're funding, how much it
//                              will have RECEIVED at +1 / +3 / +5 years if
//                              today's monthly amount just keeps running.
//                              Contributions only — no assumed market
//                              return, no compounding we can't stand behind.
//
//   answerLineQuestion(q,ctx) - a deterministic answer to a plain-language
//                              question about the line. Matches a handful
//                              of intents against real thread data; when it
//                              can't, it says what it CAN answer rather
//                              than guessing.

const round0 = (n) => Math.round(Number(n) || 0);
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const arr = (v) => (Array.isArray(v) ? v : []);

const NODE_LABEL = { income: "Today", safety: "Safety", home: "Home", relationships: "Family", freedom: "Freedom", future: "Retirement" };
const DOMAIN_LABEL = { home: "Home", emergency: "your safety buffer", wedding: "the wedding", family: "Family", investment: "investing", retirement: "Retirement", travel: "travel", loan: "the loan" };

const HORIZONS = [1, 3, 5];

export function buildFutureEcho({ lt = {} } = {}) {
  const byDomain = {};
  for (const c of arr(lt.commitments)) {
    if (c.status && c.status !== "active") continue;
    const d = c.domain;
    const m = Number(c.monthlyContribution) || 0;
    if (m <= 0) continue;
    byDomain[d] = (byDomain[d] || 0) + m;
  }
  const rows = Object.entries(byDomain).map(([domain, monthly]) => ({
    domain,
    label: DOMAIN_LABEL[domain] ? cap(DOMAIN_LABEL[domain]) : cap(domain),
    monthly,
    at: HORIZONS.map((years) => ({ years, added: monthly * 12 * years })),
  }));
  rows.sort((a, b) => b.monthly - a.monthly);

  // A safety echo only when we actually know the buffer AND the room to add
  // to it — months gained per year at the current free-cashflow rate.
  const safety = arr(lt.lifeNodes).find((n) => n.id === "safety");
  const free = lt.availableMonthlyCashflow;
  let safetyEcho = null;
  if (safety?.value != null && Number.isFinite(Number(free)) && Number(free) > 0 && lt.monthlyExpenses) {
    const monthsPerYear = (Number(free) * 12) / Number(lt.monthlyExpenses);
    safetyEcho = {
      nowMonths: Number(safety.value),
      at: HORIZONS.map((years) => ({ years, months: Number(safety.value) + monthsPerYear * years })),
    };
  }

  return { plans: rows, safety: safetyEcho, basis: "contributions only — no assumed investment return" };
}

// ---- Ask the Line ---------------------------------------------------------

function planProgress(lt, domain) {
  // months-to-go for a domain, when we can compute it honestly
  const c = arr(lt.commitments).find((x) => x.domain === domain && (!x.status || x.status === "active"));
  if (!c || !(Number(c.monthlyContribution) > 0)) return null;
  const plan = arr(lt.activePlans).find((p) => p.domain === domain);
  const patch = plan?.patch || {};
  const target = Number(patch.total_budget ?? patch.estimated_price ?? patch.target_amount);
  const current = Number(patch.current_savings ?? 0);
  if (!Number.isFinite(target) || target <= 0) return { monthly: c.monthlyContribution, target: null };
  const remaining = Math.max(0, target - current);
  return { monthly: c.monthlyContribution, target, current, remaining, months: Math.ceil(remaining / c.monthlyContribution) };
}

export function answerLineQuestion(question, { lt = {}, collision = null } = {}) {
  const q = String(question || "").toLowerCase().trim();
  if (!q) return { kind: "empty", text: null, examples: EXAMPLES };

  // 1. safety / buffer — how long would it last
  if (/(how long|how many months|what).*(safety|buffer|emergency)|last.*(no income|without)/.test(q)) {
    const s = arr(lt.lifeNodes).find((n) => n.id === "safety");
    if (s?.value == null) return { kind: "safety", text: "Your safety buffer isn't worked out yet — add your savings and essential spending in Today." };
    return { kind: "safety", text: `Your safety buffer would cover about ${Number(s.value).toFixed(1)} months of essential spending with no income coming in.` };
  }

  // 2. what if I stop / pause <domain>
  const stop = q.match(/(?:stop|pause|drop|cancel)\s+(?:the\s+|my\s+)?(\w+)/);
  if (stop) {
    const dom = normDomain(stop[1]);
    const c = arr(lt.commitments).find((x) => x.domain === dom && (!x.status || x.status === "active"));
    if (!c) return { kind: "pause", text: `You don't have an active monthly commitment to ${DOMAIN_LABEL[dom] ?? dom} to pause.` };
    return {
      kind: "pause",
      text: `Pausing ${DOMAIN_LABEL[dom] ?? dom} frees ${money(c.monthlyContribution)} a month. Your other plans keep running; Guardian records it so you can resume anytime.`,
    };
  }

  // 3. when can I afford / reach / finish <domain>
  const when = q.match(/(?:when|how long).*(?:afford|reach|finish|done|complete|hit).*?(\w+)?$/) || q.match(/(\w+).*(?:by when|timeline|how long)/);
  if (when && /afford|reach|finish|done|complete|timeline|by when|how long/.test(q)) {
    const dom = normDomain((when[1] || "").trim());
    const p = planProgress(lt, dom);
    if (!p) return { kind: "timeline", text: `Tell me which plan — try "when can I afford home" or "how long until the wedding is funded".` };
    if (p.target == null) return { kind: "timeline", text: `${cap(DOMAIN_LABEL[dom] ?? dom)} is funded at ${money(p.monthly)}/month, but it has no target amount set, so there's no finish line to count to yet.` };
    if (p.months === 0) return { kind: "timeline", text: `${cap(DOMAIN_LABEL[dom] ?? dom)} is already fully funded.` };
    return { kind: "timeline", text: `At ${money(p.monthly)}/month, ${DOMAIN_LABEL[dom] ?? dom} reaches ${money(p.target)} in about ${p.months} months (${money(p.remaining)} to go).` };
  }

  // 4. free / spare each month
  if (/(how much|what).*(free|spare|left|available).*(month|monthly)?|money.*left over/.test(q)) {
    const f = lt.availableMonthlyCashflow;
    if (f == null) return { kind: "free", text: "That's not worked out yet — add your monthly income and bills in Today." };
    return { kind: "free", text: `About ${money(f)} a month is free after your bills and plan commitments.` };
  }

  // 5. collision / competing
  if (/(compet|collision|clash|conflict|fight).*(money|plan|cash)?|too many plans/.test(q)) {
    if (collision?.collision) return { kind: "collision", text: collision.summary };
    return { kind: "collision", text: "None of your plans are competing for the same money right now." };
  }

  // 6. total committed / promised
  if (/(how much|what).*(commit|promis|putting).*(plan|future|month)/.test(q)) {
    return { kind: "committed", text: `You've promised ${money(lt.monthlyCommittedTotal ?? 0)} a month to your active plans.` };
  }

  return { kind: "unknown", text: null, examples: EXAMPLES };
}

const EXAMPLES = [
  "How long would my safety buffer last?",
  "What if I pause the wedding?",
  "When can I afford home?",
  "How much is free each month?",
  "Are any plans competing for money?",
];

function normDomain(word) {
  const w = String(word || "").toLowerCase();
  if (/wedding|marry|marriage/.test(w)) return "wedding";
  if (/home|house|flat|hdb|property|bto/.test(w)) return "home";
  if (/emergency|safety|buffer/.test(w)) return "emergency";
  if (/invest|freedom|portfolio/.test(w)) return "investment";
  if (/retire|pension|cpf/.test(w)) return "retirement";
  if (/travel|trip|holiday/.test(w)) return "travel";
  if (/loan|debt|mortgage/.test(w)) return "loan";
  if (/family|kid|child|parent/.test(w)) return "family";
  return w;
}

export { NODE_LABEL };
