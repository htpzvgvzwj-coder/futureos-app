// Life Memory — the record of why your money life became what it is, not a
// transaction log. It reads the Change Ledger (the one spine every surface
// already writes to) and keeps only the events that moved your direction:
// a plan created / changed / paused / confirmed, a Guardian action, a
// recovery step, a large money move, a new asset or debt. Routine spending
// stays in Transaction Activity.
//
// Every record answers five things — what happened, why it matters, how
// much money changed, which plans moved, what Guardian did — plus a
// Source. The raw before/after/impact is carried on `evidence` for the
// UI to reveal on tap.
//
// Pure: feed it the ledger events + the Financial Twin + the Life Thread.

const round0 = (n) => Math.round(Number(n) || 0);
const sgd = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const arr = (v) => (Array.isArray(v) ? v : []);
const humanize = (s) => String(s || "").replace(/[_:.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

// action_type -> which events are direction-changing enough for the line.
const KEEP = new Set([
  "plan_created", "plan_updated", "plan_impact",
  "commitment_created", "commitment_paused", "commitment_resumed", "commitment_reduced",
  "branch_created", "branch_merged", "branch_sealed",
  "guardian_action", "rescue_adopted", "turning_point",
  "asset_added", "liability_added", "income_changed", "reality_checkin_applied",
  "quote_imported", "allocation_set",
]);
// a payment_made only matters here when it's large
const LARGE_PAYMENT = 800;

const DOMAIN_LABEL = {
  home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family",
  investment: "Freedom", retirement: "Retirement", loan: "Loan", travel: "Travel",
  insurance: "Protection",
};

const NON_DOMAIN_GOAL = new Set(["cashflow", "spendable", "debt", "freeMonthlyCashflow", "spendableNow", "all", "flexible"]);

function domainOf(ev) {
  const rel = arr(ev.related_goal_ids).find((g) => DOMAIN_LABEL[g]);
  if (rel) return rel;
  if (ev.cause?.domain && DOMAIN_LABEL[ev.cause.domain]) return ev.cause.domain;
  const src = ev.source_feature;
  if (DOMAIN_LABEL[src]) return src;
  const imp = arr(ev.impact_set).map((i) => i.goalId).find((g) => DOMAIN_LABEL[g]);
  return imp ?? null;
}

// the free-cashflow / spendable move behind this event, if any
function moneyDelta(ev) {
  const set = arr(ev.impact_set);
  const cf = set.find((i) => /cashflow|spendable/i.test(`${i.goalId} ${i.metric}`) && i.before != null && i.after != null);
  if (!cf) return null;
  return { label: /spendable/i.test(`${cf.goalId} ${cf.metric}`) ? "Money you can spend now" : "Free each month", before: Number(cf.before), after: Number(cf.after), unit: cf.unit || "sgd" };
}

// which real plans this event moved (domain goals only), each as a line
// Each entry: { text, key?, params? } — `text` is the finished English,
// `key`/`params` localise it. `name` (the domain label) is passed as a
// param so the caller can translate it.
function plansMoved(ev) {
  const out = [];
  const seen = new Set();
  for (const i of arr(ev.impact_set)) {
    if (NON_DOMAIN_GOAL.has(i.goalId) || !DOMAIN_LABEL[i.goalId]) continue;
    const name = DOMAIN_LABEL[i.goalId];
    let entry = null;
    if (i.unit === "date_shift_months" && i.after != null && Number(i.after) !== 0) {
      const m = Math.abs(round0(i.after));
      entry = Number(i.after) < 0
        ? { key: "{name}: {m} months sooner", params: { name, m }, text: `${name}: ${m} months sooner` }
        : { key: "{name}: {m} months later", params: { name, m }, text: `${name}: ${m} months later` };
    } else if (i.metric && /month/i.test(i.metric) && i.before != null && i.after != null && i.before !== i.after) {
      const v = Number(i.after).toFixed(1);
      entry = { key: "{name}: {v} months", params: { name, v }, text: `${name}: ${v} months` };
    } else if (i.before != null && i.after != null && i.before !== i.after) {
      const fmt = i.unit === "sgd" || i.unit === "sgd_per_month" ? sgd : (x) => String(x);
      const suffix = i.unit === "sgd_per_month" ? "/mo" : "";
      const text = `${name}: ${fmt(i.before)}${suffix} → ${fmt(i.after)}${suffix}`;
      entry = { key: "{name}: {before} → {after}", params: { name, before: `${fmt(i.before)}${suffix}`, after: `${fmt(i.after)}${suffix}` }, text };
    }
    if (entry && !seen.has(entry.text)) {
      seen.add(entry.text);
      out.push(entry);
    }
  }
  return out.slice(0, 4);
}

// Each returns a full-literal key (the domain label baked in) so it can be
// a plain dictionary entry — no nested placeholder translation needed.
function whatHappened(ev, domain) {
  const d = domain ? DOMAIN_LABEL[domain] : "A";
  // A few events read better from their cause than from the action_type alone.
  if (ev.action_type === "reality_checkin_applied") {
    return ev.cause?.trigger === "income_detected" ? "Salary arrived" : "Reality caught up with your plan";
  }
  if (ev.action_type === "plan_updated" && (ev.cause?.guestCountBefore != null || ev.cause?.adjusted)) {
    return `${d} plan adjusted`;
  }
  if (ev.action_type === "guardian_action" && arr(ev.impact_set).length === 0 && ev.uncertainty_note) {
    return "Guardian noticed";
  }
  switch (ev.action_type) {
    case "plan_created": case "commitment_created": return `${d} plan created`;
    case "plan_updated": return `${d} plan changed`;
    case "plan_impact": case "turning_point": return `${d} plan shifted`;
    case "commitment_paused": return `${d} plan paused`;
    case "commitment_resumed": return `${d} plan resumed`;
    case "commitment_reduced": return `${d} plan reduced`;
    case "branch_created": return `${d} — a possible path`;
    case "branch_merged": return `${d} paths merged`;
    case "branch_sealed": return `${d} plan confirmed`;
    case "rescue_adopted": return "You took a recovery step";
    case "guardian_action": return "Guardian made a move";
    case "quote_imported": return "A quote became a plan";
    case "allocation_set": return domain ? `${d} put to work` : "Freed money put to work";
    case "asset_added": return "You added an asset";
    case "liability_added": return "You added a debt";
    case "income_changed": return "Your income changed";
    case "payment_made": return "A large payment";
    default: return humanize(ev.action_type);
  }
}

// `why` is deliberately domain-free — `what` already names the plan — so
// every one of these is a fixed, translatable string.
function whyItMatters(ev, money) {
  if (ev.uncertainty_note) return ev.uncertainty_note;
  if (money) {
    return money.after > money.before
      ? "It freed up money you have each month, which lets your other plans move faster."
      : "It tightened the money you have each month, which slows how fast your other plans can move.";
  }
  switch (ev.action_type) {
    case "commitment_paused": return "This plan stops moving until you resume it — the money it was using is free again.";
    case "branch_sealed": return "This is now a real commitment Guardian protects.";
    case "rescue_adopted": return "It changed your plan on purpose to get you back above your safety line.";
    case "guardian_action": return "Guardian changed something inside the scope you gave it.";
    default: return "It moved a plan on your line.";
  }
}

function sourceOf(ev) {
  const t = ev.cause?.trigger;
  if (t === "hardship_recovery_action_applied") return "You adopted this in Money Rescue";
  if (t === "guardian_collision_path") return "You chose this in Guardian's Collision Radar";
  if (t === "guardian_recovery") return "You confirmed this in Guardian's Recovery Mode";
  if (/^future_field/.test(t || "")) return "You confirmed this in its Studio";
  if (t === "sample_data" || t === "demo_seed") return "The example dataset";
  if (ev.actor === "guardian") return "A linked guardian";
  if (ev.actor === "system") return "Automatic — Future Bank detected it";
  return "Your Change Ledger";
}

function guardianResponse(ev) {
  if (ev.actor === "guardian") return "Guardian made this change";
  if (ev.source_feature === "guardian") return "Guardian proposed this";
  if (arr(ev.impact_set).some((i) => /safet|emergenc/i.test(`${i.goalId} ${i.metric}`) && Number(i.after) < Number(i.before))) {
    return "Guardian flagged the hit to your safety buffer";
  }
  return "Guardian found no safety risk";
}

function normalize(ev) {
  const domain = domainOf(ev);
  const money = moneyDelta(ev);
  return {
    id: ev.id ?? null,
    when: ev.occurred_at ?? ev.created_at ?? null,
    domain,
    what: whatHappened(ev, domain),
    why: whyItMatters(ev, money),
    money, // { label, before, after, unit } | null
    plansMoved: plansMoved(ev),
    guardian: guardianResponse(ev),
    source: sourceOf(ev),
    confirmed: ["active", "confirmed", "sealed", "scheduled"].includes(ev.status),
    reversible: ["plan_updated", "commitment_paused", "commitment_reduced", "branch_created", "allocation_set"].includes(ev.action_type),
    planVersion: ev.plan_branch_id ?? ev.cause?.resultVersion ?? ev.cause?.baseVersion ?? null,
    evidence: {
      before: ev.before_snapshot ?? null,
      after: ev.after_snapshot ?? null,
      impactSet: arr(ev.impact_set),
      confidence: ev.confidence ?? null,
      messageKey: ev.message_key ?? null,
      actionType: ev.action_type,
      actor: ev.actor,
    },
  };
}

function keep(ev) {
  if (KEEP.has(ev.action_type)) return true;
  if (ev.action_type === "payment_made") {
    const amt = arr(ev.impact_set).map((i) => Math.abs(Number(i.before) - Number(i.after))).find((n) => Number.isFinite(n));
    return (amt ?? 0) >= LARGE_PAYMENT;
  }
  return false;
}

function startingPoint({ twin, lifeThread }) {
  const accounts = arr(twin?.holdings?.cashAccounts).length;
  const incomes = arr(twin?.holdings?.incomeStreams).length;
  const plans = arr(lifeThread?.commitments).length;
  const parts = [];
  if (accounts) parts.push(`${accounts} account${accounts === 1 ? "" : "s"}`);
  if (incomes) parts.push(`${incomes} income source${incomes === 1 ? "" : "s"}`);
  if (plans) parts.push(`${plans} plan${plans === 1 ? "" : "s"}`);
  const hasParts = parts.length > 0;
  return {
    id: "starting-point",
    when: null,
    bucket: "startingPoint",
    domain: null,
    what: "Your starting point",
    why: "This is the money picture Future Bank first built for you. Every record above is a change from here.",
    money: null,
    plansMoved: [],
    guardian: "Guardian began protecting your money from here.",
    source: "Your accounts, income and plans",
    detail: hasParts ? `Built from ${parts.join(", ")}.` : "Add an account or a plan and your line begins.",
    detailKey: hasParts ? "Built from {a} accounts, {i} income sources and {p} plans." : "Add an account or a plan and your line begins.",
    detailParams: hasParts ? { a: accounts, i: incomes, p: plans } : null,
    confirmed: true,
    reversible: false,
    planVersion: null,
    evidence: null,
  };
}

function bucketFor(when, now = new Date()) {
  if (!when) return "earlier";
  const d = new Date(when);
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return "today";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "thisMonth";
  return "earlier";
}

export const MEMORY_BUCKETS = ["today", "thisMonth", "earlier", "startingPoint"];
export const MEMORY_BUCKET_LABEL = { today: "Today", thisMonth: "This month", earlier: "Earlier", startingPoint: "Your starting point" };

export function buildLifeMemory({ events = [], twin = null, lifeThread = null } = {}) {
  const now = new Date();
  const records = arr(events)
    .filter(keep)
    .map(normalize)
    .filter((r) => r.when)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .map((r) => ({ ...r, bucket: bucketFor(r.when, now) }));

  const sp = startingPoint({ twin, lifeThread });
  const all = [...records, sp];

  const byBucket = MEMORY_BUCKETS.map((id) => ({
    id,
    label: MEMORY_BUCKET_LABEL[id],
    records: all.filter((r) => r.bucket === id),
  })).filter((b) => b.records.length > 0);

  return {
    records: all,
    buckets: byBucket,
    latest: records[0] ?? null, // null => nothing has changed yet; the UI shows the starting point instead
    startingPoint: sp,
    count: records.length,
  };
}

// One-line "latest movement" summary for the Life page default state.
export function latestMovementLine(memory) {
  const r = memory?.latest;
  if (!r) return null;
  const bits = []; // { key, params } | { text }
  if (r.money) {
    const up = r.money.after > r.money.before;
    const amt = sgd(Math.abs(r.money.after - r.money.before));
    bits.push({
      key: up ? "Your {what} increased by {amt}." : "Your {what} dropped by {amt}.",
      params: { what: r.money.label, amt },
    });
  }
  if (r.plansMoved[0]) bits.push(r.plansMoved[0]);
  return { headlineKey: r.what, headline: r.what, lines: bits.slice(0, 2), when: r.when };
}

export { DOMAIN_LABEL };
