// Node Moment Sheet — what you see when you tap a Life node, before you
// jump into its Studio: where it stands, how much monthly money it uses,
// its next date, why it last moved, what else it's affecting, and one
// action. Pure.

const round0 = (n) => Math.round(Number(n) || 0);
const sgd = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const arr = (v) => (Array.isArray(v) ? v : []);

const NODE_DOMAIN = { income: null, safety: "emergency", relationships: "wedding", home: "home", freedom: "investment", future: "retirement" };
const NODE_LABEL = { income: "Today", safety: "Safety", relationships: "Wedding", home: "Home", freedom: "Freedom", future: "Retirement" };
const DOMAIN_LABEL = { home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family", investment: "Freedom", retirement: "Retirement", travel: "Travel", loan: "Loan" };
const STUDIO_LABEL = { emergency: "Emergency Fund", wedding: "Wedding", home: "Home", investment: "Investing", retirement: "Retirement" };

export function buildNodeMoment({ nodeId, lt = {}, memory = null, planMovement = [] } = {}) {
  const domain = NODE_DOMAIN[nodeId] ?? null;
  const label = NODE_LABEL[nodeId] ?? cap(nodeId);
  const node = arr(lt.lifeNodes).find((n) => n.id === nodeId) || {};

  // where it stands
  let standing;
  if (nodeId === "safety" && node.value != null) standing = { key: "Covers {n} months of essential spending.", params: { n: Number(node.value).toFixed(1) } };
  else if (node.value != null && (nodeId === "income" || nodeId === "freedom")) standing = { key: "{v} a month.", params: { v: sgd(node.value) } };
  else if (node.moving) standing = { key: "Being reshaped — not committed yet." };
  else if (node.known) standing = { key: "Active and on your line." };
  else standing = { key: "Not set up yet." };

  // monthly money it uses
  const commit = arr(lt.commitments).find((c) => c.domain === domain && (!c.status || c.status === "active"));
  const monthlyUsed = commit ? round0(commit.monthlyContribution) : null;

  // why it last moved — the most recent Life Memory record for this domain
  const rec = memory && arr(memory.records).find((r) => r.domain === domain || r.domain === nodeId);
  const whyMoved = rec ? { what: rec.what, when: rec.when } : null;

  // what else it's affecting
  const affecting = [];
  for (const row of arr(planMovement)) {
    if (row.domain !== domain) continue;
    for (const a of arr(row.affected)) {
      const d = a.domain || row.domain;
      if (d && d !== domain && DOMAIN_LABEL[d]) affecting.push(DOMAIN_LABEL[d]);
    }
  }
  if (rec) for (const p of rec.plansMoved || []) {
    const name = (p?.params?.name ?? String(p?.text ?? p).split(":")[0]).trim();
    if (name && !affecting.includes(name) && name !== label) affecting.push(name);
  }

  return {
    nodeId,
    domain,
    label,
    standing,
    monthlyUsed,
    whyMoved,
    affecting: [...new Set(affecting)].slice(0, 3),
    action: domain ? { key: "Open the {studio} Studio", params: { studio: STUDIO_LABEL[domain] ?? cap(domain) }, nodeId } : { key: "Open Today", nodeId },
  };
}

export { NODE_DOMAIN };
