// Family Relay — the age-adapted surfaces and the smaller flows that hang
// off the shared spine. All pure: feed them the Financial Twin / bankNow /
// obligations that the rest of the app already produces.

const round0 = (n) => Math.round(Number(n) || 0);
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const arr = (v) => (Array.isArray(v) ? v : []);

// ---- Growing Account (child / youth Today) -------------------------
// The simplified picture a child sees: what they have, what's usable this
// week, what they're saving for, the last few things they spent on, and
// what still needs a parent's yes. No net worth, no debt, no jargon.
export function buildGrowingAccount({
  balance = null,
  weeklyAllowance = null,
  spentThisWeek = 0,
  goals = [], // [{ label, saved, target }]
  recentSpending = [], // [{ merchant, amount, at }]
  pendingRequests = [], // [{ amount, merchant }]
} = {}) {
  const remaining = weeklyAllowance == null ? null : Math.max(0, round0(weeklyAllowance) - round0(spentThisWeek));
  return {
    haveText: balance == null ? null : money(balance),
    thisWeek: remaining == null ? null : { remaining, of: round0(weeklyAllowance), text: `${money(remaining)} of ${money(weeklyAllowance)} left this week` },
    savingFor: arr(goals).map((g) => ({
      label: g.label,
      saved: round0(g.saved),
      target: round0(g.target),
      percent: g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : null,
    })),
    recent: arr(recentSpending).slice(0, 4).map((r) => ({ merchant: r.merchant, amount: round0(r.amount), at: r.at ?? null })),
    waitingForYes: arr(pendingRequests).map((p) => ({ amount: round0(p.amount), merchant: p.merchant ?? null })),
  };
}

// ---- Money Seeds -------------------------------------------------
// Long-term funds a guardian can plant from birth. Each grows quietly and,
// when the child is old enough, becomes a node on their own Life Thread.
export const MONEY_SEED_KINDS = [
  { id: "education", label: "Education", becomesDomain: "retirement" },
  { id: "first_home", label: "First home", becomesDomain: "home" },
  { id: "first_computer", label: "First computer", becomesDomain: "investment" },
  { id: "travel", label: "Travel", becomesDomain: "investment" },
  { id: "emergency", label: "Emergency", becomesDomain: "emergency" },
  { id: "custom", label: "A custom future", becomesDomain: "investment" },
];

export function summariseMoneySeeds(seeds = [], { childAge = null, maturesAtAge = 18 } = {}) {
  const total = arr(seeds).reduce((s, x) => s + round0(x.balance), 0);
  return {
    total,
    totalText: money(total),
    seeds: arr(seeds).map((x) => {
      const kind = MONEY_SEED_KINDS.find((k) => k.id === x.kind) ?? MONEY_SEED_KINDS[MONEY_SEED_KINDS.length - 1];
      const yearsToGo = childAge == null ? null : Math.max(0, maturesAtAge - childAge);
      return {
        kind: kind.id,
        label: x.label || kind.label,
        balance: round0(x.balance),
        balanceText: money(x.balance),
        monthly: round0(x.monthly),
        becomesDomain: kind.becomesDomain,
        yearsToGo,
        note: yearsToGo == null ? null : yearsToGo === 0 ? "Ready to become a plan on their line" : `Becomes a plan on their line in about ${yearsToGo} year${yearsToGo === 1 ? "" : "s"}`,
      };
    }),
  };
}

// ---- Learn Through Real Money ----------------------------------
// A single short line at the moment of a real spend — a real trade-off,
// not a lesson. Returns null when there's nothing concrete to say.
export function learnMoment({ balance = null, amount, goal = null } = {}) {
  const amt = round0(amount);
  if (!(amt > 0) || balance == null) return null;
  const after = round0(balance) - amt;
  const parts = [`You have ${money(balance)}.`];
  if (goal && (goal.dailyRate > 0 || goal.monthlyContribution > 0)) {
    const perDay = goal.dailyRate > 0 ? goal.dailyRate : round0(goal.monthlyContribution) / 30;
    const days = perDay > 0 ? Math.round(amt / perDay) : 0;
    if (days >= 1) parts.push(`Spending ${money(amt)} now moves "${goal.label}" about ${days} day${days === 1 ? "" : "s"} later.`);
  }
  if (after < 0) parts.push(`That's ${money(-after)} more than you have.`);
  else parts.push(`You'd have ${money(after)} left.`);
  return { text: parts.join(" "), balanceAfter: after };
}

// ---- Growing Permissions ------------------------------------------
// The ladder of what opens with age + a family decision. Nothing opens on
// its own; each rung is applied or held, and every change is a Life
// Memory record.
const PERMISSION_RUNGS = [
  { atAge: 0, id: "view_save", label: "See the money and put some aside" },
  { atAge: 7, id: "small_spend", label: "Small everyday spending, familiar shops" },
  { atAge: 13, id: "new_merchant_ask", label: "Pay somewhere new (asks a guardian)" },
  { atAge: 16, id: "small_autonomy", label: "Spend a set weekly amount without asking" },
  { atAge: 18, id: "cards_fx", label: "Own card and currency change" },
  { atAge: 18, id: "full_handover", label: "Full account — the guardian steps back" },
];

export function growingPermissions({ childAge = null, appliedRungIds = [] } = {}) {
  const applied = new Set(appliedRungIds);
  return PERMISSION_RUNGS.map((r) => ({
    ...r,
    state: applied.has(r.id)
      ? "applied"
      : childAge != null && childAge >= r.atAge
        ? "ready" // age reached, waiting for the family to apply it
        : "future",
  }));
}

// ---- Calm Today (later-life Today) -------------------------------
// Fewer things at once: one balance, the next income, the next bill, the
// single thing that needs attention, and who to call. Nothing is removed —
// it's still all there under a normal view.
export function buildCalmToday({ balance = null, nextIncome = null, nextBill = null, oneThing = null, trustedContacts = [] } = {}) {
  return {
    balanceText: balance == null ? null : money(balance),
    nextIncome: nextIncome ? { label: nextIncome.label ?? "Next income", amount: round0(nextIncome.amount), when: nextIncome.when ?? null } : null,
    nextBill: nextBill ? { label: nextBill.label ?? "Next bill", amount: round0(nextBill.amount), when: nextBill.when ?? null } : null,
    oneThing: oneThing ? { text: oneThing.text ?? oneThing.headline ?? null, kind: oneThing.kind ?? null } : null,
    callList: arr(trustedContacts).map((c) => ({ label: c.relationLabel || c.label || "A trusted contact", role: c.role ?? null })),
  };
}

// ---- Bill Continuity -------------------------------------------
// The critical bills, whether each has money set aside before its date,
// and roughly how long the current balance would keep them running with
// no income (forgetfulness, hospitalisation, a late payday).
const CRITICAL_CATEGORIES = new Set(["housing", "utilities", "health", "insurance"]);

export function buildBillContinuity({ obligations = [], balance = null, monthlyIncome = null } = {}) {
  const critical = arr(obligations)
    .filter((o) => CRITICAL_CATEGORIES.has(o.category) || /rent|mortgage|electric|water|insurance|premium|care/i.test(`${o.label} ${o.merchant}`))
    .map((o) => ({
      label: o.label,
      monthly: round0(o.monthlyAmount),
      nextDue: o.nextDueDate ?? null,
      covered: balance != null && round0(balance) >= round0(o.monthlyAmount),
    }));
  const monthlyCritical = critical.reduce((s, c) => s + c.monthly, 0);
  const monthsCovered = balance == null || monthlyCritical <= 0 ? null : Math.floor(round0(balance) / monthlyCritical);
  return {
    bills: critical,
    monthlyCriticalText: money(monthlyCritical),
    monthsCovered,
    monthsCoveredText: monthsCovered == null ? null : `About ${monthsCovered} month${monthsCovered === 1 ? "" : "s"} of critical bills covered with no income`,
    incomeKnown: monthlyIncome != null,
  };
}

// ---- Life Handover checklist ----------------------------------
// What a successor would need. Marks each item done / missing from what's
// already in the account, without ever standing in for the legal steps.
export function buildHandoverChecklist({ accountsCount = 0, incomeCount = 0, obligationsCount = 0, rolesCount = 0, handoff = null, beneficiaryCount = 0 } = {}) {
  const item = (id, label, done, hint) => ({ id, label, done: Boolean(done), hint });
  return [
    item("accounts", "A list of accounts and assets", accountsCount > 0, "From your linked accounts and the Financial Twin"),
    item("recurring", "The recurring payments that must keep running", obligationsCount > 0, "From your bills and subscriptions"),
    item("income", "Where the money comes in", incomeCount > 0, "From your income streams"),
    item("people", "Who is authorised, and for what", rolesCount > 0, "From your circle in Family & Care"),
    item("successor", "A named successor and when the plan applies", Boolean(handoff?.successorRoleId || handoff?.successorLabel), "Write a handoff plan"),
    item("instructions", "What the successor should know or do", Boolean(handoff?.instructions), "Add instructions to the handoff plan"),
    item("beneficiary", "A beneficiary / nominee check", beneficiaryCount > 0, "Add a beneficiary to your circle"),
  ];
}
