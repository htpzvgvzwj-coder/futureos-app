// Guardian's honesty layer: which of its protection claims are backed by
// real linked data, and which outside links it genuinely can't see through
// yet — so "protected" never quietly means "assumed". Pure, no DB.

const CONSEQUENCE = {
  sgfindex: "Retirement, Home and Freedom figures are still what you typed — not CPF, IRAS or bank-verified balances.",
  insurer: "Your Protection gap is an estimate — no real policy is linked yet, so Guardian can't see your actual cover.",
  payment_provider: "Guardian can't see money once it leaves your own accounts — external payments aren't linked yet.",
};

// connections: the array from GET /api/connections ({ id, name, connected }).
export function guardianBlindSpots({ connections = [] } = {}) {
  const gaps = (Array.isArray(connections) ? connections : [])
    .filter((c) => c && !c.connected)
    .map((c) => ({
      provider: c.id,
      name: c.name,
      textKey: CONSEQUENCE[c.id] ?? "This link isn't connected yet, so Guardian is working from what you typed.",
    }));
  return { gaps, estimate: true };
}
