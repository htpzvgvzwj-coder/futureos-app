// The Living Thread — Life's one continuously-changing line. Not a grid of
// nine Studios: a Life Direction sentence, three numbers, a vertical line
// of the nodes that really exist, and the single most recent change with
// its knock-on effects.
//
// Pure: feed it the Life Thread + Money Moments + Change Ledger + the
// Collision Radar result. Node state is one of four visual forms:
//   solid  - confirmed and affecting money
//   hollow - not enough information
//   ghost  - being simulated, not committed
//   pulse  - changed recently

const round0 = (n) => Math.round(Number(n) || 0);
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());

const NODE_LABEL = {
  income: "Today", // the money that arrives / is here now
  safety: "Safety",
  home: "Home",
  relationships: "Family",
  freedom: "Freedom",
  future: "Retirement",
};
// which node a domain belongs to
const DOMAIN_NODE = { home: "home", emergency: "safety", wedding: "relationships", family: "relationships", investment: "freedom", retirement: "future", loan: "freedom", travel: "freedom" };

const arr = (v) => (Array.isArray(v) ? v : []);

// A short note is only shown when a node needs attention — a solid,
// settled node says everything through its filled dot and its value.
const NODE_NOTE = { hollow: "Not started", ghost: "Draft — not sealed", pulse: "Just moved" };
const NODE_OPEN = {
  income: "Open Today",
  safety: "Open Safety",
  home: "Open Home",
  relationships: "Open Family",
  freedom: "Open Freedom",
  future: "Open Retirement",
};

function recentlyChangedDomains(lt, moments, planMovement) {
  const set = new Set();
  const lc = lt?.latestChange;
  if (lc?.occurredAt && Date.now() - new Date(lc.occurredAt).getTime() < 21 * 86_400_000) {
    const d = lc.cause?.domain || String(lc.actionType || "").split("_")[0];
    if (d) set.add(d);
  }
  for (const m of arr(moments)) {
    if (m.state !== "new") continue;
    for (const p of arr(m.affectedPlans)) if (p.domain) set.add(p.domain);
  }
  for (const row of arr(planMovement)) {
    if (row.domain && (row.monthlyReleased || row.lastChange)) set.add(row.domain);
  }
  return set;
}

function nodeVisualState(node, changedDomains) {
  const domain = DOMAIN_NODE[node.id] ? node.id : node.id;
  if (changedDomains.has(node.id) || changedDomains.has(domain)) return "pulse";
  if (node.state === "moving") return "ghost"; // an active draft branch = simulating
  if (!node.known || node.state === "unknown") return "hollow";
  return "solid";
}

function valueText(node) {
  if (node.id === "safety" && node.value != null) return `${Number(node.value).toFixed(1)} months`;
  if (node.value != null && (node.id === "income" || node.id === "freedom")) return `${money(node.value)}/mo`;
  // Home / Wedding / Retirement carry a horizon label ("2031", "2028", "at 63")
  // rather than a monthly figure.
  if (node.horizon && (node.id === "home" || node.id === "relationships" || node.id === "future")) return String(node.horizon);
  return null;
}

export function buildLivingThread({ lt = {}, moments = [], planMovement = [], collision = null } = {}) {
  const changed = recentlyChangedDomains(lt, moments, planMovement);
  const rawNodes = arr(lt.lifeNodes);

  const nodes = rawNodes.map((n) => {
    const state = nodeVisualState(n, changed);
    const inCollision = collision?.collision && (collision.competing ?? []).some((d) => DOMAIN_NODE[d] === n.id || d === n.id);
    return {
      id: n.id,
      label: NODE_LABEL[n.id] ?? cap(n.id),
      state,
      valueText: valueText(n),
      ring: n.id === "safety" && (n.waiting || (lt.turningPointCounts?.open ?? 0) > 0), // Guardian protecting
      collision: Boolean(inCollision),
      note: inCollision ? "Competing for money" : state === "solid" ? null : NODE_NOTE[state] ?? null,
      cta: state === "hollow" ? "Set this up" : NODE_OPEN[n.id] ?? "Open",
    };
  });

  // only show nodes that mean something; keep a single ghost future slot.
  // Order follows a life sequence (now -> safety -> the people-first goals
  // -> the long horizon), not the raw store order.
  const NODE_ORDER = { income: 0, safety: 1, relationships: 2, home: 3, freedom: 4, future: 5 };
  const shown = nodes
    .filter((n) => n.state !== "hollow" || n.id === "income" || n.id === "safety")
    .sort((a, b) => (NODE_ORDER[a.id] ?? 9) - (NODE_ORDER[b.id] ?? 9));
  const hiddenCount = nodes.length - shown.length;

  const d = buildDirection({ lt, collision });
  const numbers = buildNumbers(lt);
  const whatMoved = buildWhatMoved(lt, planMovement);
  const weather = buildWeather({ lt, collision });

  return {
    direction: d.text, // English, for tests / non-i18n callers
    directionKey: d.key, // dictionary key = the English template
    directionParams: d.params ?? null, // {name} fills for directionKey
    numbers,
    weather,
    nodes: shown,
    futureSlot: hiddenCount > 0 ? { label: "See what could come next", route: "explore" } : null,
    whatMoved,
  };
}

// Returns { text, key, params }: `text` is the finished English sentence
// (kept for tests and any caller that does not localise); `key` is the
// English template that doubles as the dictionary key, `params` fills its
// {placeholders}.
function buildDirection({ lt, collision }) {
  if (collision?.collision) {
    const [a, b] = collision.competing ?? [];
    const params = { a: cap(a), b: cap(b) };
    const key = "Your life is protected, but {a} and {b} are beginning to compete for the same money.";
    return { text: key.replace("{a}", params.a).replace("{b}", params.b), key, params };
  }
  const safety = arr(lt.lifeNodes).find((n) => n.id === "safety");
  if (safety?.waiting) {
    const key = "Your safety buffer is below your floor — that's the first thing to rebuild.";
    return { text: key, key };
  }
  const moving = arr(lt.lifeNodes).find((n) => n.state === "moving");
  if (moving) {
    const params = { node: (NODE_LABEL[moving.id] ?? moving.id).toLowerCase() };
    const key = "You're reshaping {node} — nothing is committed until you seal it.";
    return { text: key.replace("{node}", params.node), key, params };
  }
  const commitments = arr(lt.commitments);
  // Two or more plans that together claim most of the money left after
  // living costs: the future is funded, but the monthly space is contested.
  const committedTotal = lt.monthlyCommittedTotal ?? commitments.reduce((s, c) => s + (Number(c.monthlyContribution) || 0), 0);
  const afterLiving = committedTotal + (Number(lt.availableMonthlyCashflow) || 0);
  const domainsByWeight = [...commitments].sort((a, b) => (Number(b.monthlyContribution) || 0) - (Number(a.monthlyContribution) || 0));
  if (domainsByWeight.length >= 2 && afterLiving > 0 && committedTotal >= 0.55 * afterLiving) {
    const params = { a: cap(domainsByWeight[0].domain), b: cap(domainsByWeight[1].domain) };
    const key = "Your future is funded, but {a} and {b} are competing for the same monthly space.";
    return { text: key.replace("{a}", params.a).replace("{b}", params.b), key, params };
  }
  if (commitments.length > 0) {
    const key = "Your plans are moving forward and your safety buffer is intact.";
    return { text: key, key };
  }
  const key = "Start a plan and Life shows where your money is taking you.";
  return { text: key, key };
}

// Three numbers that describe the same money relationship — what's yours
// after living costs, what you've promised, what's still free. Safety is
// NOT a fourth number here: it lives on the Safety node on the line.
function buildNumbers(lt) {
  const flexible = lt.availableMonthlyCashflow;
  const committed = lt.monthlyCommittedTotal ?? 0;
  const afterLiving = flexible == null ? null : flexible + committed;
  return [
    {
      id: "afterLiving",
      label: "Available after living costs",
      value: afterLiving == null ? null : `${money(afterLiving)}`,
      emptyHint: "Add your income",
      source:
        afterLiving == null
          ? "Add your monthly income and essential spending in Today, and this fills in."
          : "What's left from your income once essential living costs are covered, before any plan.",
    },
    {
      id: "committed",
      label: "Promised to plans",
      value: `${money(committed)}/mo`,
      source:
        committed > 0
          ? "The sum of your active plan commitments — Home, Wedding, Retirement and the rest."
          : "You haven't committed a monthly amount to any plan yet.",
    },
    {
      id: "flexible",
      label: "Still flexible",
      value: flexible == null ? null : `${money(flexible)}/mo`,
      emptyHint: "Add your income and bills",
      source: "Money left after living costs and everything promised to plans — free to move.",
    },
  ];
}

function buildWhatMoved(lt, planMovement) {
  const lc = lt.latestChange;
  if (!lc) return null;
  const impacts = [];
  for (const row of arr(planMovement)) {
    if (row.monthlyReleased > 0) impacts.push(`${cap(row.domain)}: frees ${money(row.monthlyReleased)}/month`);
    for (const a of arr(row.affected)) {
      if (a.monthsDelta) impacts.push(`${cap(a.domain || row.domain)}: ${a.monthsDelta > 0 ? `${a.monthsDelta} months later` : `${Math.abs(a.monthsDelta)} months sooner`}`);
      else if (a.before != null && a.after != null && a.before !== a.after) impacts.push(`${cap(a.domain || row.domain)}: ${money(a.before)} → ${money(a.after)}`);
    }
  }
  return {
    headline: lc.headline || cap(String(lc.actionType || "a change").replace(/_/g, " ")),
    when: lc.occurredAt,
    status: lc.status,
    impacts: [...new Set(impacts)].slice(0, 3),
  };
}

// Future cashflow weather, not an abstract score. `note` is the finished
// English string; `noteKey` / `noteParams` localise it (noteKey doubles as
// the dictionary key).
function buildWeather({ lt, collision }) {
  const safety = arr(lt.lifeNodes).find((n) => n.id === "safety");
  if (safety?.waiting) {
    return { id: "exposed", label: "Exposed", note: "You're below your safety floor.", noteKey: "You're below your safety floor." };
  }
  if (collision?.collision) {
    return { id: "tight", label: "Tight", note: collision.summary, noteKey: collision.summaryKey ?? collision.summary, noteParams: collision.summaryParams ?? null };
  }
  const lc = lt.latestChange;
  if (lc && /pause|recover|revoke/i.test(lc.actionType || "")) {
    return { id: "recovering", label: "Recovering", note: "A recent change is easing the pressure.", noteKey: "A recent change is easing the pressure." };
  }
  const free = Number(lt.availableMonthlyCashflow);
  if (Number.isFinite(free) && free > 500 && arr(lt.commitments).length > 0) {
    const params = { amount: money(free) };
    const noteKey = "About {amount}/month is free to put to work.";
    return { id: "opportunity", label: "Opportunity", note: noteKey.replace("{amount}", params.amount), noteKey, noteParams: params };
  }
  return { id: "calm", label: "Calm", note: "Your plans fit the money you have.", noteKey: "Your plans fit the money you have." };
}
