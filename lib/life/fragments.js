// Future Fragments — up to three concrete next moves the person's own
// numbers can already support, each a different KIND of opportunity:
//
//   protect     close a near-term gap before it becomes a problem
//   build       start a life plan they don't have yet
//   accelerate  bring an existing plan forward by redirecting spare money
//
// Every figure is derived from the Life Thread (lt) + Financial Twin
// (twin): the flexible cashflow left after living costs and commitments,
// the safety buffer, the existing commitments and their horizons. Nothing
// here is written or committed — a Fragment is a proposal the person drags
// onto their line to simulate, then confirms (or not).
//
// Pure. Returns [] when there is not enough real data to say anything.

const round0 = (n) => Math.round(Number(n) || 0);
const arr = (v) => (Array.isArray(v) ? v : []);
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;

const DOMAIN_LABEL = {
  home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family",
  investment: "Freedom", retirement: "Retirement", loan: "Loan", travel: "Travel",
};

const nowYear = () => new Date().getFullYear();
const yearFrom = (monthsAhead) => nowYear() + Math.ceil(Math.max(0, monthsAhead) / 12);
const yearOf = (s) => {
  const m = /^(\d{4})/.exec(String(s || ""));
  return m ? Number(m[1]) : null;
};

// Common "Why this appeared" lines — the person's data behind every Fragment.
function whyBase({ hasIncomeHistory, commitments }) {
  const lines = [];
  lines.push(hasIncomeHistory ? "Based on your last 6 months of income" : "Based on the income you entered");
  lines.push("Based on your confirmed fixed spending");
  const names = commitments.map((c) => DOMAIN_LABEL[c.domain] ?? cap(c.domain));
  if (names.length) lines.push(`Based on your current ${names.slice(0, 2).join(" and ")} commitment${names.length > 1 ? "s" : ""}`);
  lines.push("Does not use your Emergency fund");
  lines.push("This is an estimate, not a confirmed result");
  return lines;
}

export function buildFutureFragments({ lt = {}, twin = null } = {}) {
  const flexible = round0(lt.availableMonthlyCashflow); // money left after living costs + commitments
  const essential = round0(lt.monthlyExpenses);
  const safetyNode = arr(lt.lifeNodes).find((n) => n.id === "safety");
  const bufferMonths = safetyNode?.value != null ? Number(safetyNode.value) : null;
  const commitments = arr(lt.commitments).filter((c) => (Number(c.monthlyContribution) || 0) > 0);
  const hasIncomeHistory = arr(twin?.holdings?.incomeStreams).length > 0 || round0(lt.availableMonthlyCashflow) > 0;
  const why = whyBase({ hasIncomeHistory, commitments });

  const oneThing = lt.bankNow?.oneThingThisWeek ?? null;
  const frags = [];

  // ---- PROTECT — a flagged near-term exposure ------------------------
  // A card statement that lands before the next salary: cover it from this
  // month's flexible money so it never touches Safety.
  if (oneThing && oneThing.kind === "card_payment" && round0(oneThing.amount) > 0 && flexible > 0) {
    const amt = round0(oneThing.amount);
    // If the bill is bigger than one month's flexible money, spread it over
    // the whole months it takes so the plan is honest — never "leaves SGD 0".
    const monthsToClear = Math.max(1, Math.ceil(amt / flexible));
    const perMonth = Math.ceil(amt / monthsToClear);
    const detail = monthsToClear === 1
      ? `A ${money(amt)} card statement is due before your next salary. Paying it from this month's flexible money leaves ${money(flexible - amt)}, and never touches your Safety buffer.`
      : `A ${money(amt)} card statement is due before your next salary. Setting aside ${money(perMonth)}/month clears it over ${monthsToClear} months without touching your Safety buffer.`;
    frags.push({
      id: "protect_card_bill",
      kind: "protect",
      title: "Clear the card bill from flexible money",
      detail,
      needsMonthly: monthsToClear === 1 ? 0 : perMonth,
      needsOneOff: monthsToClear === 1 ? amt : 0,
      projected: {
        flexibleAfter: monthsToClear === 1 ? flexible : flexible - perMonth,
        flexibleAfterOneOff: monthsToClear === 1 ? flexible - amt : null,
        monthsToClear,
        bufferMonthsAfter: bufferMonths,
        planShift: null,
      },
      whyItAppeared: [
        `A ${money(amt)} card payment is scheduled before your next income`,
        "Based on your confirmed fixed spending",
        "Does not use your Emergency fund",
        "This is an estimate, not a confirmed result",
      ],
    });
  }

  // ---- BUILD — spare flexible money that isn't doing anything --------
  // Turn it into a freedom fund: 12 months of essential spending, held
  // liquid, reachable any time.
  if (flexible >= 200 && essential > 0) {
    const putAside = Math.min(flexible, Math.max(200, round0(flexible * 0.7)));
    const target = essential * 12;
    const monthsToBuild = Math.ceil(target / putAside);
    frags.push({
      id: "build_freedom_fund",
      kind: "build",
      title: "One year of freedom",
      detail: `Your ${money(putAside)}/month of flexible money could build a 12-month freedom fund (${money(target)}) by ${yearFrom(monthsToBuild)}.`,
      needsMonthly: putAside,
      needsOneOff: 0,
      projected: {
        flexibleAfter: flexible - putAside,
        bufferMonthsAfter: bufferMonths,
        readyYear: yearFrom(monthsToBuild),
        targetAmount: target,
        planShift: null,
      },
      whyItAppeared: why,
    });
  }

  // ---- ACCELERATE — redirect part of flexible into the biggest plan --
  const biggest = [...commitments].sort(
    (a, b) => (Number(b.monthlyContribution) || 0) - (Number(a.monthlyContribution) || 0),
  )[0];
  if (biggest && flexible >= 200) {
    const domain = biggest.domain;
    const current = round0(biggest.monthlyContribution);
    const redirect = Math.min(round0(flexible * 0.3), flexible, Math.max(100, round0(current * 0.3)));
    const node = arr(lt.lifeNodes).find((n) => n.id === (domain === "wedding" || domain === "family" ? "relationships" : domain));
    const horizonYear = yearOf(node?.horizon);
    const monthsRemaining = horizonYear ? Math.max(6, (horizonYear - nowYear()) * 12) : 48;
    // A damped proportional estimate: adding `redirect` to `current` shortens
    // the remaining runway, but returns/price drift mean it is never linear.
    const monthsEarlier = Math.max(1, Math.round(0.5 * (redirect / current) * monthsRemaining));
    if (redirect >= 100) {
      frags.push({
        id: `accelerate_${domain}`,
        kind: "accelerate",
        title: `Bring ${DOMAIN_LABEL[domain] ?? cap(domain)} closer`,
        detail: `Redirecting ${money(redirect)}/month into ${DOMAIN_LABEL[domain] ?? cap(domain)} could move it about ${monthsEarlier} month${monthsEarlier === 1 ? "" : "s"} earlier.`,
        needsMonthly: redirect,
        needsOneOff: 0,
        projected: {
          flexibleAfter: flexible - redirect,
          bufferMonthsAfter: bufferMonths,
          planShift: { domain, monthsEarlier },
        },
        whyItAppeared: why,
      });
    }
  }

  return frags.slice(0, 3);
}

// The safety floor a placed Fragment must not push the buffer below. Kept
// conservative and independent of any single Studio's setting.
export const FRAGMENT_SAFETY_FLOOR_MONTHS = 6;

// simulateFragment — turn a Fragment (optionally with an adjusted monthly
// amount) into the impact receipt shown once it is placed on the line:
// what it needs, what's left flexible, whether Safety stays protected, and
// which plan moves. Pure; no writes.
export function simulateFragment(fragment, lt = {}, { overrideMonthly = null } = {}) {
  if (!fragment) return null;
  const flexible = round0(lt.availableMonthlyCashflow);
  const safetyNode = arr(lt.lifeNodes).find((n) => n.id === "safety");
  const bufferMonths = safetyNode?.value != null ? Number(safetyNode.value) : (fragment.projected?.bufferMonthsAfter ?? null);
  const needMonthly = overrideMonthly != null ? Math.max(0, round0(overrideMonthly)) : round0(fragment.needsMonthly);
  const needOneOff = round0(fragment.needsOneOff);

  const flexibleAfter = needMonthly > 0 ? flexible - needMonthly : flexible;
  const lines = [];
  if (needMonthly > 0) lines.push({ key: "Needs {v}/month", params: { v: money(needMonthly) }, text: `Needs ${money(needMonthly)}/month` });
  if (needOneOff > 0) lines.push({ key: "Needs {v} once", params: { v: money(needOneOff) }, text: `Needs ${money(needOneOff)} once` });
  lines.push(
    flexibleAfter >= 0
      ? { key: "Leaves {v}/month still flexible", params: { v: money(flexibleAfter) }, text: `Leaves ${money(flexibleAfter)}/month still flexible` }
      : { key: "This is {v}/month more than you have flexible", params: { v: money(-flexibleAfter) }, text: `This is ${money(-flexibleAfter)}/month more than you have flexible` },
  );

  // Guardian check: Fragments are built to leave Safety alone, so the
  // buffer after == the buffer now. Flag only if that ever changes.
  const bufferAfter = fragment.projected?.bufferMonthsAfter ?? bufferMonths;
  const safetyOk = bufferAfter == null || bufferAfter >= FRAGMENT_SAFETY_FLOOR_MONTHS;
  const guardian = safetyOk
    ? { ok: true, key: "Guardian: this doesn't touch your Safety buffer.", text: "Guardian: this doesn't touch your Safety buffer." }
    : { ok: false, key: "Guardian: this would pull your Safety buffer below {n} months.", params: { n: FRAGMENT_SAFETY_FLOOR_MONTHS }, text: `Guardian: this would pull your Safety buffer below ${FRAGMENT_SAFETY_FLOOR_MONTHS} months.` };

  const planShift = fragment.projected?.planShift ?? null;
  if (planShift) {
    lines.push({
      key: "{d}: about {m} months earlier",
      params: { d: DOMAIN_LABEL[planShift.domain] ?? cap(planShift.domain), m: planShift.monthsEarlier },
      text: `${DOMAIN_LABEL[planShift.domain] ?? cap(planShift.domain)}: about ${planShift.monthsEarlier} months earlier`,
    });
  }

  return {
    fragmentId: fragment.id,
    kind: fragment.kind,
    needMonthly,
    needOneOff,
    flexibleAfter,
    affordable: flexibleAfter >= 0,
    bufferMonths: bufferAfter,
    safetyOk,
    guardian,
    planShift,
    lines,
  };
}

// describeFuture — a person's own words -> a ghost Fragment. A light
// keyword classifier (no model call): it names the goal type, the Studio
// that owns it, and a rough monthly figure from spare flexible money. The
// UI still asks the person to confirm the specifics.
const GOAL_PATTERNS = [
  { type: "education", studio: "retirement", horizonYears: 3, re: /\b(stud(y|ies)|degree|master|mba|univ|course|school|tuition|overseas study)\b/i, label: "Study / education" },
  { type: "relocation", studio: "home", horizonYears: 3, re: /\b(relocat|move (abroad|overseas)|emigrat|migrat|live (abroad|overseas)|move to)\b/i, label: "Relocation" },
  { type: "property", studio: "home", horizonYears: 5, re: /\b(house|home|flat|hdb|condo|property|down ?payment|renovat)\b/i, label: "Property" },
  { type: "vehicle", studio: "investment", horizonYears: 2, re: /\b(car|vehicle|coe|motorbike)\b/i, label: "Vehicle" },
  { type: "travel", studio: "investment", horizonYears: 1, re: /\b(travel|trip|holiday|vacation|backpack|gap year)\b/i, label: "Travel" },
  { type: "business", studio: "investment", horizonYears: 3, re: /\b(business|startup|start-up|side ?hustle|company|shop)\b/i, label: "Business" },
  { type: "family", studio: "family", horizonYears: 3, re: /\b(baby|child|kid|wedding|marry|marriage|parent care|elderly)\b/i, label: "Family" },
];

export function describeFuture(text, lt = {}) {
  const t = String(text || "").trim();
  if (t.length < 3) return null;
  const flexible = round0(lt.availableMonthlyCashflow);
  const match = GOAL_PATTERNS.find((p) => p.re.test(t)) ?? { type: "custom", studio: "investment", horizonYears: 3, label: "A future goal" };
  const yearMatch = /\b(in|after)\s+(\d{1,2})\s+year/i.exec(t) || /\b(\d{1,2})\s*(?:yr|years?)\b/i.exec(t);
  const horizonYears = yearMatch ? Math.min(30, Math.max(1, Number(yearMatch[2] ?? yearMatch[1]))) : match.horizonYears;
  const suggestMonthly = flexible > 0 ? Math.max(100, round0(Math.min(flexible, flexible * 0.5) / 50) * 50) : null;

  const questions = [
    { id: "amount", q: "Roughly how much will this need in total?" },
    { id: "when", q: `Is ${nowYear() + horizonYears} about the right year, or sooner?` },
  ];

  return {
    id: `described_${match.type}`,
    kind: "build",
    described: true,
    goalType: match.type,
    goalLabel: match.label,
    studio: match.studio,
    title: match.label,
    detail: suggestMonthly
      ? `Sounds like a ${match.label.toLowerCase()} goal around ${nowYear() + horizonYears}. About ${money(suggestMonthly)}/month of your flexible money could start it — confirm the details and it goes on your line as a possibility.`
      : `Sounds like a ${match.label.toLowerCase()} goal around ${nowYear() + horizonYears}. Add some flexible monthly room first, then it can go on your line.`,
    needsMonthly: suggestMonthly ?? 0,
    needsOneOff: 0,
    horizonYear: nowYear() + horizonYears,
    questions,
    projected: {
      flexibleAfter: suggestMonthly ? flexible - suggestMonthly : flexible,
      bufferMonthsAfter: (arr(lt.lifeNodes).find((n) => n.id === "safety")?.value ?? null),
      planShift: null,
    },
    whyItAppeared: [
      "From what you described",
      "Placed at an estimated year — you can move it",
      suggestMonthly ? "Sized from your spare flexible money" : "Needs flexible monthly room to size",
      "This is an estimate, not a confirmed result",
    ],
  };
}
