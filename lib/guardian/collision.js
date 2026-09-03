// Collision Radar — when two or more plans start competing for the same
// monthly cashflow. Not "you're overcommitted": it names the plans, the
// exact monthly shortfall, and three genuinely different ways out.
//
// Pure: feed it the active commitments + the available monthly cashflow.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());

export function detectCollision({ commitments = [], availableMonthly = null } = {}) {
  const active = commitments
    .map((c) => ({ domain: c.domain, monthly: round2(c.monthlyContribution ?? c.monthly ?? 0), id: c.id ?? null }))
    .filter((c) => c.monthly > 0);
  const totalCommitted = round2(active.reduce((s, c) => s + c.monthly, 0));

  if (availableMonthly == null) {
    return { collision: false, reason: "unknown_cashflow", totalCommitted };
  }
  const shortfall = round2(totalCommitted - Number(availableMonthly));
  if (shortfall <= 0 || active.length < 2) {
    return { collision: false, totalCommitted, availableMonthly: round2(availableMonthly), headroom: round2(-shortfall) };
  }

  const sorted = [...active].sort((a, b) => b.monthly - a.monthly);
  const [big, small] = sorted;
  const half = round2(shortfall / 2);

  return {
    collision: true,
    shortfallMonthly: shortfall,
    totalCommitted,
    availableMonthly: round2(availableMonthly),
    plans: active.map((c) => ({ domain: c.domain, monthly: c.monthly })),
    competing: [big.domain, small.domain],
    summary: `${cap(big.domain)} needs ${money(big.monthly)}/month and ${cap(small.domain)} needs ${money(small.monthly)}/month, but only ${money(availableMonthly)}/month is free — a ${money(shortfall)}/month collision.`,
    paths: [
      {
        id: "pause_smaller",
        label: `Pause ${cap(small.domain)} for now`,
        effect: `Frees ${money(small.monthly)}/month immediately. ${cap(small.domain)} stops moving until you resume it.`,
        target: { domain: small.domain, op: "pause" },
      },
      {
        id: "shrink_larger",
        label: `Make ${cap(big.domain)} smaller`,
        effect: `Drop ${cap(big.domain)} to ${money(Math.max(0, big.monthly - shortfall))}/month. It reaches its target later, both plans keep moving.`,
        target: { domain: big.domain, op: "reduce", to: round2(Math.max(0, big.monthly - shortfall)) },
      },
      {
        id: "ease_both",
        label: "Lower both plans a little",
        effect: `Each drops about ${money(half)}/month. Both keep moving, both reach their target a bit later.`,
        target: { op: "reduce_both", domains: [big.domain, small.domain], each: half },
      },
    ],
  };
}

function money(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
