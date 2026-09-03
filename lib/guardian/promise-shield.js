// Promise Shield — Guardian doesn't just protect a balance, it protects the
// promises the money is already carrying. Every dollar sits in one of four
// buckets, and when a spend or a new plan lands, Guardian says which
// promise it eats into — not just "you spent more".
//
// Pure: feed it the Financial Twin + the safe-to-spend view.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const PROMISE_BUCKETS = ["free", "bills", "safety", "goals"];

export function buildPromiseShield({ twin = {}, safeToSpend = {} } = {}) {
  const bb = twin.balanceBreakdown ?? {};
  const bd = safeToSpend.breakdown ?? {};
  const currency = safeToSpend.currency ?? twin.currency ?? "SGD";

  const buckets = [
    {
      id: "free",
      name: "Free to use",
      amount: round2(bb.availableNow ?? safeToSpend.safeToSpend ?? 0),
      note: "No promise attached — this is your Safe-to-Spend.",
    },
    {
      id: "bills",
      name: "Promised to bills",
      amount: round2(bd.nearTermObligations ?? 0),
      note: "Set aside for bills due before your next income.",
    },
    {
      id: "safety",
      name: "Kept for safety",
      amount: round2(bb.protectedFor ?? bd.protectedReserve ?? twin.protectedAssets ?? 0),
      note: "Your emergency buffer — Guardian never spends this.",
    },
    {
      id: "goals",
      name: "Promised to your goals",
      amount: round2(bb.spokenFor ?? bd.alreadyCommitted ?? twin.committedMonthlyTotal ?? 0),
      note: "Committed to Home, Wedding, Retirement and other plans.",
    },
  ];
  const total = round2(buckets.reduce((s, b) => s + b.amount, 0));
  return { currency, buckets, total };
}

// Which promise a spend of `amount` from free money would break into.
// Walks free -> bills -> safety; a spend inside `free` breaks nothing.
export function whichPromise(amount, shield) {
  const amt = round2(amount);
  const free = shield?.buckets?.find((b) => b.id === "free")?.amount ?? 0;
  if (amt <= free) {
    return { breaks: null, message: "This stays inside your free-to-use money — no promise is touched." };
  }
  const over = round2(amt - free);
  const bills = shield?.buckets?.find((b) => b.id === "bills")?.amount ?? 0;
  if (over <= bills) {
    return { breaks: "bills", overBy: over, message: `This goes ${shield.currency} ${over.toLocaleString("en-SG")} into money promised to bills.` };
  }
  return {
    breaks: "safety",
    overBy: round2(over - bills),
    message: `This would reach past your bills money into your safety buffer by ${shield.currency} ${round2(over - bills).toLocaleString("en-SG")}.`,
  };
}
