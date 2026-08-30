// Pure helpers for the Life screen's per-node Evidence drawer. Keeps the
// "relevant history" node-specific instead of showing the same global
// latest-three Change Ledger events for every node.

export const LIFE_NODE_DOMAINS = {
  income: ["income", "profile", "personal_economy", "expense"],
  safety: ["emergency", "buffer", "hardship"],
  home: ["home"],
  relationships: ["wedding", "family", "relationship", "joint"],
  freedom: ["investment", "loan", "capital", "repayment"],
  future: ["retirement", "future_life"],
};

export function eventMatchesNode(event, nodeId) {
  const keys = LIFE_NODE_DOMAINS[nodeId] ?? [];
  const hay = `${event?.domain ?? ""} ${event?.goal_key ?? ""} ${event?.action_type ?? ""} ${event?.message_key ?? ""}`.toLowerCase();
  return keys.some((k) => hay.includes(k));
}

export function nodeEvents(events, nodeId, limit = 3) {
  return (Array.isArray(events) ? events : []).filter((e) => eventMatchesNode(e, nodeId)).slice(0, limit);
}
