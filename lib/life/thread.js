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
    };
  });

  // only show nodes that mean something; keep a single ghost future slot
  const shown = nodes.filter((n) => n.state !== "hollow" || n.id === "income" || n.id === "safety");
  const hiddenCount = nodes.length - shown.length;

  const direction = buildDirection({ lt, collision });
  const numbers = buildNumbers(lt);
  const whatMoved = buildWhatMoved(lt, planMovement);
  const weather = buildWeather({ lt, collision });

  return {
    direction,
    numbers,
    weather,
    nodes: shown,
    futureSlot: hiddenCount > 0 ? { label: "What might come next?", route: "explore" } : null,
    whatMoved,
  };
}

function buildDirection({ lt, collision }) {
  if (collision?.collision) {
    const [a, b] = collision.competing ?? [];
    return `Your life is protected, but ${cap(a)} and ${cap(b)} are beginning to compete for the same money.`;
  }
  const safety = arr(lt.lifeNodes).find((n) => n.id === "safety");
  if (safety?.waiting) return "Your safety buffer is below your floor — that's the first thing to rebuild.";
  const moving = arr(lt.lifeNodes).find((n) => n.state === "moving");
  if (moving) return `You're reshaping ${(NODE_LABEL[moving.id] ?? moving.id).toLowerCase()} — nothing is committed until you seal it.`;
  const committed = arr(lt.commitments).length;
  if (committed > 0) return "Your plans are moving forward and your safety buffer is intact.";
  return "Start a plan and Life shows where your money is taking you.";
}

function buildNumbers(lt) {
  const free = lt.availableMonthlyCashflow;
  const committed = lt.monthlyCommittedTotal ?? 0;
  const safetyNode = arr(lt.lifeNodes).find((n) => n.id === "safety");
  return [
    {
      id: "free",
      label: "Free each month",
      value: free == null ? null : `${money(free)}`,
      source: "What arrives each month, minus your bills and what you've committed to plans.",
    },
    {
      id: "committed",
      label: "Promised to your future",
      value: `${money(committed)}/mo`,
      source: "The sum of your active plan commitments (Home, Wedding, Retirement…).",
    },
    {
      id: "safety",
      label: "Safety buffer",
      value: safetyNode?.value != null ? `${Number(safetyNode.value).toFixed(1)} months` : null,
      source: "Your emergency money divided by a month of essential spending.",
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

// Future cashflow weather, not an abstract score.
function buildWeather({ lt, collision }) {
  const safety = arr(lt.lifeNodes).find((n) => n.id === "safety");
  if (safety?.waiting) return { id: "exposed", label: "Exposed", note: "You're below your safety floor." };
  if (collision?.collision) return { id: "tight", label: "Tight", note: collision.summary };
  const lc = lt.latestChange;
  if (lc && /pause|recover|revoke/i.test(lc.actionType || "")) return { id: "recovering", label: "Recovering", note: "A recent change is easing the pressure." };
  const free = Number(lt.availableMonthlyCashflow);
  if (Number.isFinite(free) && free > 500 && arr(lt.commitments).length > 0) {
    return { id: "opportunity", label: "Opportunity", note: `About ${money(free)}/month is free to put to work.` };
  }
  return { id: "calm", label: "Calm", note: "Your plans fit the money you have." };
}
