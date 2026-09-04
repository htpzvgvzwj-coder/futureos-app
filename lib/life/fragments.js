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
    const leftThisMonth = flexible - amt;
    frags.push({
      id: "protect_card_bill",
      kind: "protect",
      title: "Clear the card bill from flexible money",
      detail: `A ${money(amt)} card statement is due before your next salary. Paying it from this month's flexible money leaves ${money(Math.max(0, leftThisMonth))} and never touches your Safety buffer.`,
      needsMonthly: 0,
      needsOneOff: amt,
      projected: {
        flexibleAfterOneOff: Math.max(0, leftThisMonth),
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
