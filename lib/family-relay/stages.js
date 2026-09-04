// Family Relay — money, protection and responsibility move with every life
// stage, on one spine: the same Life Thread, Guardian Contract, Change
// Ledger and permission system, with the surface adapted to where a person
// is. This module is the pure stage + capability model. No DB, no AI.
//
//   child            a minor's account a guardian fully controls
//   youth            everyday spending works; key actions need approval
//   independent      a normal adult account
//   family_guardian  an adult who also approves / manages someone else's
//   later_life       an adult who has invited trusted help, on their terms

export const STAGES = ["child", "youth", "independent", "family_guardian", "later_life"];

export const STAGE_LABEL = {
  child: "Child account",
  youth: "Youth, with a guardian",
  independent: "Independent adult",
  family_guardian: "Family guardian",
  later_life: "Later-life, with trusted help",
};

// What a person at each stage can do with their OWN money, before any
// guardian relationship narrows it further. `ask` = allowed but a request
// goes to a linked guardian first.
const STAGE_CAPS = {
  child: {
    view: "yes", save: "yes", spend_small: "ask", spend_new_merchant: "ask",
    pay_out: "no", cards: "no", fx: "no", invest: "no", borrow: "no",
  },
  youth: {
    view: "yes", save: "yes", spend_small: "yes", spend_new_merchant: "ask",
    pay_out: "ask", cards: "yes", fx: "ask", invest: "ask", borrow: "no",
  },
  independent: {
    view: "yes", save: "yes", spend_small: "yes", spend_new_merchant: "yes",
    pay_out: "yes", cards: "yes", fx: "yes", invest: "yes", borrow: "yes",
  },
  family_guardian: {
    view: "yes", save: "yes", spend_small: "yes", spend_new_merchant: "yes",
    pay_out: "yes", cards: "yes", fx: "yes", invest: "yes", borrow: "yes",
  },
  later_life: {
    view: "yes", save: "yes", spend_small: "yes", spend_new_merchant: "yes",
    pay_out: "yes", cards: "yes", fx: "yes", invest: "yes", borrow: "yes",
  },
};

export const CAPABILITY_LABEL = {
  view: "See the money",
  save: "Put money aside",
  spend_small: "Small everyday spending",
  spend_new_merchant: "Pay somewhere new",
  pay_out: "Send money out",
  cards: "Use a card",
  fx: "Change currency",
  invest: "Invest",
  borrow: "Borrow",
};

export function ageFromBirthYear(birthYear, now = new Date()) {
  const y = Number(birthYear);
  if (!Number.isFinite(y) || y < 1900 || y > now.getFullYear()) return null;
  return now.getFullYear() - y;
}

// The Today surface a person at this stage sees.
export const STAGE_SURFACE = {
  child: "growing_account", // simplified: balance, this week, what I'm saving for, ask to pay
  youth: "growing_account",
  independent: "standard",
  family_guardian: "standard",
  later_life: "calm_today", // larger type, one balance, next income, next bill, one thing, who to call
};

// roles: [{ role, scope, status }] from lifecycle_roles (this account's rows)
export function resolveStage({ accountType = "individual", birthYear = null, roles = [] } = {}) {
  const age = ageFromBirthYear(birthYear);
  if (accountType === "guardian_managed_child") return "child";
  if (accountType === "youth") return age != null && age < 13 ? "child" : "youth";

  const active = roles.filter((r) => r.status == null || r.status === "active");
  const managesSomeone = active.some((r) => ["guardian", "dependent"].includes(r.role) && (r.scope === "manage" || r.scope === "approve" || r.role === "dependent"));
  const hasTrustedHelp = active.some((r) => ["trusted_contact", "guardian"].includes(r.role) && (r.scope === "suggest" || r.scope === "view"));

  if (managesSomeone) return "family_guardian";
  if (hasTrustedHelp) return "later_life";
  return "independent";
}

// stage + whether a guardian is actually linked -> the effective rule per
// capability: "yes" | "ask" (needs a linked guardian's approval) | "no".
// If a capability is "ask" but NO guardian is linked yet, it holds ("no")
// rather than silently allowing — the request has nowhere to go.
export function stageCapabilities(stage, { guardianLinked = false } = {}) {
  const caps = STAGE_CAPS[stage] ?? STAGE_CAPS.independent;
  const out = {};
  for (const [k, v] of Object.entries(caps)) {
    out[k] = v === "ask" && !guardianLinked ? "no" : v;
  }
  return out;
}

// A compact description of a stage for the Family Relay panel.
export function describeStage(stage, { guardianLinked = false } = {}) {
  const caps = stageCapabilities(stage, { guardianLinked });
  const yes = Object.keys(caps).filter((k) => caps[k] === "yes");
  const ask = Object.keys(caps).filter((k) => caps[k] === "ask");
  const no = Object.keys(caps).filter((k) => caps[k] === "no");
  return {
    stage,
    label: STAGE_LABEL[stage],
    surface: STAGE_SURFACE[stage],
    can: yes.map((k) => CAPABILITY_LABEL[k]),
    needsApproval: ask.map((k) => CAPABILITY_LABEL[k]),
    cannot: no.map((k) => CAPABILITY_LABEL[k]),
  };
}
