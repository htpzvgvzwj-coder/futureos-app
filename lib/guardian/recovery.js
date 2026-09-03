// Recovery Mode — when the money is already in trouble, Guardian doesn't
// just warn. It produces an ordered recovery sequence and a date to be
// back to normal. Guardian never runs it on its own: it proposes, you
// confirm each step.
//
// Pure: feed it the safe-to-spend view + rescue cases + active commitments.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());

// domains a recovery step may pause without needing a separate confirmation
// (Home and Wedding always need you; the emergency buffer is never touched)
const PAUSABLE = new Set(["travel", "investment", "freedom", "retirement"]);

export function buildRecoveryPlan({ safeToSpend = {}, rescueCases = [], commitments = [] } = {}) {
  const bd = safeToSpend.breakdown ?? {};
  const belowFloor = Boolean(safeToSpend.belowProtectedFloor) || Number(safeToSpend.projectedLowBalanceBeforeIncome) < 0;
  const inTrouble = belowFloor || rescueCases.length > 0;
  if (!inTrouble) return { inTrouble: false, steps: [], recoveryDate: null };

  const active = commitments
    .map((c) => ({ domain: c.domain, monthly: round2(c.monthlyContribution ?? 0), id: c.id ?? null }))
    .filter((c) => c.monthly > 0);
  const pausable = active.filter((c) => PAUSABLE.has(c.domain));
  const pausableFreed = round2(pausable.reduce((s, c) => s + c.monthly, 0));

  const trimmable = rescueCases
    .flatMap((r) => r.options ?? [])
    .filter((o) => /cancel|pause|reduce|trim|duplicate|subscription/i.test(`${o.id} ${o.label}`))
    .slice(0, 2);

  const nextIncome = safeToSpend.nextIncome ?? null;
  const recoveryDate = nextIncome?.expectedDate ?? null;

  const steps = [
    {
      order: 1,
      kind: "guarantee_bills",
      label: "Keep your essential bills covered",
      detail: `${money(bd.nearTermObligations ?? 0)} of bills due before your next income stays first in line.`,
      needsConfirm: false,
    },
    {
      order: 2,
      kind: "protect_floor",
      label: "Protect your safety floor",
      detail: `Your emergency buffer (${money(bd.protectedReserve ?? 0)}) is not touched by any of this.`,
      needsConfirm: false,
    },
    {
      order: 3,
      kind: "pause_plans",
      label: "Pause what can wait",
      detail: pausable.length
        ? `${pausable.map((p) => cap(p.domain)).join(", ")} can pause, freeing about ${money(pausableFreed)}/month. Home and Wedding are left alone.`
        : "No plan can be safely paused right now.",
      needsConfirm: pausable.length > 0,
      targets: pausable.map((p) => p.domain),
      frees: pausableFreed,
    },
    {
      order: 4,
      kind: "trim_spend",
      label: "Trim repeated or optional spending",
      detail: trimmable.length ? trimmable.map((o) => o.label).join(" · ") : "Nothing obvious to cut from your recent transactions.",
      needsConfirm: false,
    },
    {
      order: 5,
      kind: "recovery_date",
      label: recoveryDate ? "Back to normal by" : "Recovery date",
      detail: recoveryDate ? `${recoveryDate} — when your next income lands. Guardian recalculates after every real change.` : "Needs a known next-income date.",
      needsConfirm: false,
    },
  ];

  return { inTrouble: true, steps, recoveryDate, pausableFreed };
}
