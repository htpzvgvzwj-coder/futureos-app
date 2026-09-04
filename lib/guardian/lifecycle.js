// Guardian Phase 4 — the whole-life view. Guardian does not lean on the
// same thing at 24, at 38 with a mortgage and a child, or at 67 drawing
// the money down. deriveLifeStage turns what we actually know — who
// supervises whom, which plans are live, whether the safety floor holds,
// whether money is being drawn down — into a stage and the ONE thing
// Guardian watches hardest there. It never asks for an age it wasn't given.

const arr = (v) => (Array.isArray(v) ? v : []);

const STAGE = {
  supported: {
    id: "supported",
    label: "Supported account",
    focus: "your daily limit and who signs off the big moves",
    why: "Someone you trust can see this account and approve large changes — Guardian keeps that boundary clear.",
  },
  recovering: {
    id: "recovering",
    label: "Rebuilding",
    focus: "getting your safety buffer back above its floor",
    why: "Until the buffer holds, Guardian pauses what it safely can and leaves the essentials alone.",
  },
  retirement: {
    id: "retirement",
    label: "Drawing down",
    focus: "making the money last — your withdrawal rate and protected floor",
    why: "The risk now is outliving the money, not missing a savings target, so Guardian watches the drawdown.",
  },
  family: {
    id: "family",
    label: "Family & home",
    focus: "the plans with other people attached — Home and Family — and the shared safety net",
    why: "More of your money is promised to people who depend on it, so Guardian guards those promises first.",
  },
  building: {
    id: "building",
    label: "Building",
    focus: "the balance between your plans so none crowds out the safety buffer",
    why: "Several goals are running at once — Guardian's job is to keep them from starving each other.",
  },
  establishing: {
    id: "establishing",
    label: "Getting started",
    focus: "your first full safety buffer, and keeping new commitments inside what's free each month",
    why: "Early on, one over-commitment does the most damage, so Guardian watches the monthly headroom.",
  },
  unknown: {
    id: "unknown",
    label: "Not enough yet",
    focus: "getting your first real numbers in — income, bills, and one goal",
    why: "Guardian can only protect what it can see. Add those and the rest comes to life.",
  },
};

const FAMILY_DOMAINS = new Set(["wedding", "home", "family"]);

export function deriveLifeStage({
  supervisedByOthers = 0,
  iSupervise = 0,
  commitments = [],
  belowSafetyFloor = false,
  retirementDrawdown = false,
} = {}) {
  const active = arr(commitments).filter((c) => (!c.status || c.status === "active") && Number(c.monthlyContribution) > 0);
  const domains = new Set(active.map((c) => c.domain));
  const alsoCaregiver = Number(iSupervise) > 0;

  let base;
  if (Number(supervisedByOthers) > 0) base = STAGE.supported;
  else if (belowSafetyFloor) base = STAGE.recovering;
  else if (retirementDrawdown || domains.has("retirement_drawdown")) base = STAGE.retirement;
  else if ([...domains].some((d) => FAMILY_DOMAINS.has(d)) || alsoCaregiver) base = STAGE.family;
  else if (active.length >= 2 || domains.has("retirement")) base = STAGE.building;
  else if (active.length >= 1) base = STAGE.establishing;
  else base = STAGE.unknown;

  return {
    ...base,
    alsoCaregiver,
    caregiverNote: alsoCaregiver
      ? `You also look after ${iSupervise === 1 ? "one account" : `${iSupervise} accounts`} — their requests come to you first.`
      : null,
  };
}

export { STAGE as LIFE_STAGES };
