// Deterministic intent -> Studio routing. Pure: no network, no state.
// It NEVER creates or seals a plan - it only decides which Studio the
// customer's words point at, and how confident that is.

// One entry per Studio: the screen key, a label key, a "why" key, and the
// keyword groups that point at it.
export const INTENT_ROUTES = [
  { id: "loan", screen: "repaymentPath", labelKey: "explore.route.loan", whyKey: "explore.why.loan", keywords: ["debt", "loan", "repay", "repayment", "owe", "instal", "mortgage payment", "pay off", "pay down"] },
  { id: "retirement", screen: "futureLifeTimeline", labelKey: "explore.route.retirement", whyKey: "explore.why.retirement", keywords: ["retire", "retirement", "old age", "pension", "cpf life", "later life", "stop working"] },
  { id: "travel", screen: "tripOrbit", labelKey: "explore.route.travel", whyKey: "explore.why.travel", keywords: ["trip", "travel", "holiday", "vacation", "flight", "overseas", "getaway"] },
  { id: "investment", screen: "capitalPaths", labelKey: "explore.route.investment", whyKey: "explore.why.investment", keywords: ["invest", "portfolio", "returns", "grow my money", "grow savings", "wealth", "compound", "rsp"] },
  { id: "insurance", screen: "protectionEnvelope", labelKey: "explore.route.insurance", whyKey: "explore.why.insurance", keywords: ["insure", "insurance", "protect", "cover", "coverage", "income protection", "critical illness", "dependent", "term life"] },
  { id: "family", screen: "familyConstellation", labelKey: "explore.route.family", whyKey: "explore.why.family", keywords: ["partner", "spouse", "together", "joint", "shared budget", "our money", "family budget", "co-plan"] },
  { id: "wedding", screen: "weddingLivingPlan", labelKey: "explore.route.wedding", whyKey: "explore.why.wedding", keywords: ["wedding", "marry", "married", "marriage", "engaged", "engagement", "banquet"] },
  { id: "home", screen: "homeHorizon", labelKey: "explore.route.home", whyKey: "explore.why.home", keywords: ["house", "home", "flat", "hdb", "condo", "property", "down payment", "deposit", "bto", "resale"] },
  { id: "emergency", screen: "needEmergency", labelKey: "explore.route.emergency", whyKey: "explore.why.emergency", keywords: ["emergency", "buffer", "safety net", "rainy day", "shock", "runway", "reserve"] },
];

// Broad category hints for when the words are about a FEELING, not a goal.
const CATEGORY_HINTS = [
  { id: "reduce_pressure", match: ["pressure", "tight", "stretched", "less each month", "cut back", "too much every month", "struggling"], suggests: ["loan", "family", "emergency"] },
  { id: "protect", match: ["protect", "safe", "what if something happens", "cover us"], suggests: ["insurance", "emergency"] },
  { id: "grow_flexibility", match: ["more freedom", "options later", "flexible future", "grow"], suggests: ["investment", "retirement"] },
  { id: "prepare", match: ["prepare", "get ready", "coming up", "planning for"], suggests: ["home", "wedding", "travel"] },
];

export function routeIntent(rawText, { activeDomains = [] } = {}) {
  const text = String(rawText || "").toLowerCase().trim();
  if (!text) return { confidence: "empty", matches: [], category: null };

  const matches = INTENT_ROUTES.map((route) => {
    const hits = route.keywords.filter((k) => text.includes(k));
    return { route, hits: hits.length };
  })
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const category = CATEGORY_HINTS.find((c) => c.match.some((m) => text.includes(m))) ?? null;

  if (matches.length === 1) {
    return { confidence: "high", pick: matches[0].route, matches: [matches[0].route], category };
  }
  if (matches.length >= 2) {
    // ambiguous - if one of them is already an active goal, lean that way
    const active = matches.find((m) => activeDomains.includes(m.route.id));
    return {
      confidence: active ? "medium" : "low",
      pick: active ? active.route : null,
      matches: matches.slice(0, 3).map((m) => m.route),
      category,
    };
  }
  if (category) {
    return {
      confidence: "low",
      pick: null,
      matches: category.suggests.map((id) => INTENT_ROUTES.find((r) => r.id === id)).filter(Boolean),
      category,
    };
  }
  return { confidence: "none", pick: null, matches: [], category: null };
}
