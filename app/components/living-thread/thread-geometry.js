// Living Thread - pure geometry for the ONE continuous life-line surface.
//
// Every Lens (Today / Life / Explore / Guardian) calls buildThreadGeometry
// with the SAME canonical inputs. The `lens` argument selects which overlay
// LAYERS are emitted for drawing - it never changes a number, a node
// state, a ripple magnitude or the spine. Switching Lens is a pure
// projection of one computed geometry.
//
// No React, no DOM, no network. Deterministic (no Math.random, no Date).

// Canonical left-to-right order of the six life nodes: earlier / more
// foundational on the left, longer-horizon on the right. The "now" marker
// sits between `safety` and `home`.
export const NODE_ORDER = ["income", "safety", "home", "relationships", "freedom", "future"];

const NODE_LABEL = {
  income: "Income",
  safety: "Safety",
  home: "Home",
  relationships: "Relationships",
  freedom: "Freedom",
  future: "Future",
};

// domain -> the life node it enters through (mirror of cross-studio-impact's
// GOAL_TO_NODE, kept here so geometry has no lib import).
const DOMAIN_NODE = {
  home: "home",
  emergency: "safety",
  loan: "income",
  retirement: "future",
  travel: "freedom",
  investment: "freedom",
  insurance: "safety",
  family: "relationships",
  wedding: "relationships",
};

function clampNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// One node's drawn state, from the canonical lifeNode + whether a Studio is
// mid-change on it and whether an aggregated group confirmed / placed there.
function nodeStateFor(node, { moving, placement }) {
  if (placement === "confirmed") return "solid";
  if (placement === "placed") return "placed";
  if (node?.waiting) return "waiting";
  if (moving || node?.moving) return "ghost";
  if (node?.known) return "known";
  return "unknown";
}

// Build the full geometry object once. `lens` only gates `layers`.
export function buildThreadGeometry({
  lifeNodes = [],
  crossGoalEdges = [],
  studioImpacts = {},
  activeDrafts = [],
  guardianDecision = null,
  latestChange = null,
  width = 960,
  height = 320,
  lens = "life",
} = {}) {
  const byId = Object.fromEntries((lifeNodes ?? []).map((n) => [n.id, n]));
  const aggregated = studioImpacts?.aggregated ?? [];
  const perStudio = studioImpacts?.perStudio ?? [];
  const resourceLedger = studioImpacts?.resourceLedger ?? {};
  const nodeImpacts = studioImpacts?.nodeImpacts ?? {};

  // placement per node from the aggregated groups folded onto nodes
  const placementByNode = {};
  for (const [nodeId, groups] of Object.entries(nodeImpacts)) {
    let p = "possible";
    for (const g of groups ?? []) {
      if (g.state === "conflict") {
        p = "conflict";
        break;
      }
      if (g.placement === "confirmed" || g.state === "solid") p = "confirmed";
      else if (g.placement === "placed" && p !== "confirmed") p = "placed";
    }
    placementByNode[nodeId] = p;
  }

  const movingDomains = new Set((activeDrafts ?? []).filter((d) => d.isActive).map((d) => d.domain));
  const movingNodes = new Set([...movingDomains].map((d) => DOMAIN_NODE[d]).filter(Boolean));

  // --- spine + node coordinates ---------------------------------------
  const padX = Math.round(width * 0.06);
  const usableW = width - padX * 2;
  const midY = Math.round(height / 2);
  const step = usableW / (NODE_ORDER.length - 1);

  const nodes = NODE_ORDER.map((id, i) => {
    const n = byId[id] ?? null;
    const placement = placementByNode[id] ?? "possible";
    const state = placement === "conflict" ? "conflict" : nodeStateFor(n, { moving: movingNodes.has(id), placement });
    // vertical offset gives the line a gentle, deterministic wave so it
    // reads as a life line, not an axis.
    const wave = Math.round(Math.sin(i * 0.9) * (height * 0.12));
    return {
      id,
      label: NODE_LABEL[id] ?? id,
      x: Math.round(padX + i * step),
      y: midY - wave,
      state,
      placement,
      known: Boolean(n?.known),
      value: clampNum(n?.value),
      enterable: Boolean(DOMAIN_NODE_REVERSE[id]),
      domain: DOMAIN_NODE_REVERSE[id] ?? null,
    };
  });
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // the "now" marker: between safety and home
  const safety = nodeById.safety;
  const home = nodeById.home;
  const nowX = safety && home ? Math.round((safety.x + home.x) / 2) : Math.round(width / 2);
  const nowY = safety && home ? Math.round((safety.y + home.y) / 2) : midY;

  // spine as one continuous smooth path through every node
  const spinePath = smoothPath(nodes.map((n) => [n.x, n.y]));

  // --- decision ripples: real impactSet, not hardcoded ---------------
  // one ripple per (source Studio -> affected node), magnitude + unit from
  // the aggregated group, ghost / placed / solid from its placement.
  const ripples = [];
  for (const s of perStudio) {
    const fromNode = nodeById[DOMAIN_NODE[s.domain]] ?? null;
    if (!fromNode) continue;
    const ledger = resourceLedger[s.resourceId] ?? null;
    for (const g of aggregated) {
      const toId = nodeOfGoal(g.targetGoalId);
      const toNode = toId ? nodeById[toId] : null;
      if (!toNode || toNode.id === fromNode.id) continue;
      const mag = g.state === "conflict" ? null : Math.abs(clampNum(g.state === "solid" ? g.confirmedDelta : g.placedDelta ?? g.possibleDelta) ?? 0);
      ripples.push({
        id: `${s.domain}:${g.targetGoalId}:${g.metric}`,
        fromDomain: s.domain,
        from: fromNode.id,
        to: toNode.id,
        x1: fromNode.x,
        y1: fromNode.y,
        x2: toNode.x,
        y2: toNode.y,
        arc: arcPath(fromNode, toNode, height),
        direction: g.direction ?? "flat",
        favourable: g.favourable ?? null,
        magnitude: mag,
        unit: g.unit ?? null,
        state: g.state === "conflict" ? "conflict" : g.placement ?? (g.state === "solid" ? "confirmed" : "possible"),
        // animation speed is derived from the REAL magnitude - bigger
        // movement travels faster - never a fixed constant.
        speedMs: mag == null ? 0 : Math.max(600, 2600 - Math.min(2000, mag * 4)),
        sealed: Boolean(ledger && ledger.state === "confirmed"),
      });
    }
  }

  // --- conflicts (baseline mismatch / >1 active branch) --------------
  const conflicts = [];
  for (const g of aggregated) {
    if (g.state === "conflict") {
      conflicts.push({ kind: "baseline", targetGoalId: g.targetGoalId, metric: g.metric, reason: g.invalidReason ?? "baseline_mismatch", node: nodeOfGoal(g.targetGoalId) });
    }
  }
  for (const c of studioImpacts?.conflicts ?? []) {
    conflicts.push({ kind: "moment", domain: c.domain, reason: "two_active_branches", node: DOMAIN_NODE[c.domain] ?? null });
  }

  // --- edges (canonical crossGoalEdges, ghost/solid tagged) ---------
  const edges = (crossGoalEdges ?? []).map((e) => {
    const a = nodeById[e.from];
    const b = nodeById[e.to];
    return {
      from: e.from,
      to: e.to,
      x1: a?.x ?? null,
      y1: a?.y ?? null,
      x2: b?.x ?? null,
      y2: b?.y ?? null,
      direction: e.direction ?? "flat",
      unit: e.unit ?? null,
      magnitude: clampNum(e.magnitude),
      impactState: e.impactState ?? "none", // none | ghost | solid | conflict
      basis: e.basis ?? null,
    };
  });

  // --- future fragment(s) from the resource ledger -----------------
  const fragments = Object.values(resourceLedger).map((r) => ({
    resourceId: r.resourceId,
    domain: r.domain,
    kind: r.kind,
    state: r.state, // possible | placed | confirmed
    totalMonthly: r.totalMonthly,
    placedMonthly: r.placedMonthly,
    unplacedMonthly: r.unplacedMonthly,
    node: DOMAIN_NODE[r.domain] ?? null,
  }));

  // --- lens layers: presentation only -------------------------------
  const LAYERS = {
    today: ["spine", "now", "bankNow", "lastChange", "oneAction"],
    life: ["spine", "nodes", "edges", "ripples", "conflicts", "enterStudios"],
    explore: ["spine", "nodes", "reality", "activeBranch", "alternatives", "fragmentPlacement", "ripples"],
    guardian: ["spine", "now", "guardianWatch", "guardianTriggers", "guardianCannot", "nextCheck", "standDown"],
  };

  return {
    lens,
    layers: LAYERS[lens] ?? LAYERS.life,
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    snapshotId: studioImpacts?.snapshotId ?? null,
    spinePath,
    now: { x: nowX, y: nowY },
    nodes,
    edges,
    ripples,
    conflicts,
    fragments,
    hasBaselineConflict: Boolean(studioImpacts?.hasBaselineConflict) || conflicts.length > 0,
    lastChange: latestChange
      ? { id: latestChange.id, label: latestChange.headline ?? latestChange.label ?? latestChange.kind ?? "change", at: latestChange.occurredAt ?? latestChange.at ?? null }
      : null,
    guardian: guardianDecision
      ? { needsDecision: Boolean(guardianDecision.needsDecision), reason: guardianDecision.reason ?? null, nextCheck: guardianDecision.nextCheckAt ?? guardianDecision.nextCheck ?? null }
      : null,
  };
}

const DOMAIN_NODE_REVERSE = {
  home: "home",
  safety: "emergency",
  income: "loan",
  future: "retirement",
  freedom: "travel",
  relationships: "wedding",
};

function nodeOfGoal(goalId) {
  const map = {
    emergency: "safety",
    safety: "safety",
    home: "home",
    retirement: "future",
    future: "future",
    wedding: "relationships",
    family: "relationships",
    relationships: "relationships",
    investment: "freedom",
    flexible: "freedom",
    freedom: "freedom",
    income: "income",
  };
  return map[goalId] ?? null;
}

// A smooth Catmull-Rom-ish path through points, as an SVG `d` string.
export function smoothPath(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// An arc between two nodes, bowed above the spine, as an SVG `d` string.
export function arcPath(a, b, height) {
  if (!a || !b) return "";
  const midX = (a.x + b.x) / 2;
  const lift = Math.min(height * 0.4, Math.abs(b.x - a.x) * 0.4 + 24);
  const midY = Math.min(a.y, b.y) - lift;
  return `M ${a.x} ${a.y} Q ${round(midX)} ${round(midY)}, ${b.x} ${b.y}`;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
