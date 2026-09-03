// Guardian Contract — a revocable permission agreement, not an on/off switch.
//
// Every Guardian capability sits at one of three levels:
//   watch - Guardian only observes and records
//   ask   - Guardian may surface the issue and ask you to decide
//   act   - Guardian may carry out THIS capability inside its stated scope
//
// A fixed set of capabilities can never be raised to `act` — moving
// emergency money, or changing the Wedding / Home plan, always needs you.

import { query } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";

export const CONTRACT_LEVELS = ["watch", "ask", "act"];

// capability -> { label, scope, defaultLevel, maxLevel }
export const CAPABILITIES = {
  notify_a_guardian: { label: "Tell a linked guardian when something needs a look", scope: "Only the health state, never amounts.", defaultLevel: "watch", maxLevel: "act" },
  flag_unusual_transaction: { label: "Flag an unusual or repeated payment", scope: "Surfaces it — never blocks or reverses it.", defaultLevel: "watch", maxLevel: "act" },
  pause_plan_contribution: { label: "Pause a plan's monthly contribution", scope: "Only Travel or a plan you mark pausable, only while Safe-to-Spend is negative.", defaultLevel: "ask", maxLevel: "act" },
  resume_plan_contribution: { label: "Resume a paused contribution", scope: "Only a contribution Guardian itself paused, once Safe-to-Spend recovers.", defaultLevel: "ask", maxLevel: "act" },
  adjust_budget_range: { label: "Adjust a spending range you set", scope: "Inside the min/max you defined.", defaultLevel: "ask", maxLevel: "ask" },
  move_between_own_accounts: { label: "Move money between your own accounts", scope: "e.g. top up the bills account before a due date.", defaultLevel: "ask", maxLevel: "ask" },
  move_emergency_funds: { label: "Move money out of your emergency buffer", scope: "Never on its own.", defaultLevel: "ask", maxLevel: "ask" },
  change_wedding_plan: { label: "Change the Wedding plan", scope: "Never on its own.", defaultLevel: "ask", maxLevel: "ask" },
  change_home_plan: { label: "Change the Home plan", scope: "Never on its own.", defaultLevel: "ask", maxLevel: "ask" },
  make_external_payment: { label: "Send money outside your own accounts", scope: "Never — Future Bank has no external rail.", defaultLevel: "ask", maxLevel: "ask" },
};

export const NEVER_ACT = Object.entries(CAPABILITIES)
  .filter(([, c]) => c.maxLevel !== "act")
  .map(([k]) => k);

function rank(level) {
  return CONTRACT_LEVELS.indexOf(level);
}

export async function getContracts(profileKey) {
  const r = await query(`select capability, level, updated_at from guardian_contracts where profile_key = $1`, [profileKey]);
  const set = new Map(r.rows.map((x) => [x.capability, x]));
  return Object.entries(CAPABILITIES).map(([capability, meta]) => {
    const row = set.get(capability);
    return {
      capability,
      label: meta.label,
      scope: meta.scope,
      level: row?.level ?? meta.defaultLevel,
      maxLevel: meta.maxLevel,
      canAct: meta.maxLevel === "act",
      updatedAt: row?.updated_at ?? null,
    };
  });
}

export async function setContract(profileKey, capability, level) {
  const meta = CAPABILITIES[capability];
  if (!meta) throw new Error(`unknown capability: ${capability}`);
  if (!CONTRACT_LEVELS.includes(level)) throw new Error(`invalid level: ${level}`);
  if (rank(level) > rank(meta.maxLevel)) throw new Error(`"${capability}" can never be set to "${level}" — it stays at "${meta.maxLevel}" or lower`);
  await query(
    `insert into guardian_contracts (profile_key, capability, level, updated_at)
     values ($1,$2,$3,now())
     on conflict (profile_key, capability) do update set level = excluded.level, updated_at = now()`,
    [profileKey, capability, level],
  );
  await recordAuditEvent(null, profileKey, { kind: "guardian_contract_changed", detail: { capability, level } });
  return getContracts(profileKey);
}

// Reset every capability to its default (the "revoke" in "revocable").
export async function resetContracts(profileKey) {
  await query(`delete from guardian_contracts where profile_key = $1`, [profileKey]);
  await recordAuditEvent(null, profileKey, { kind: "guardian_contract_reset", detail: {} });
  return getContracts(profileKey);
}

// The plain-language "may / may never" lines for the Guardian home.
export function contractSummary(contracts) {
  const may = contracts.filter((c) => c.level === "act").map((c) => c.label);
  const asks = contracts.filter((c) => c.level === "ask").map((c) => c.label);
  const never = contracts.filter((c) => !c.canAct).map((c) => c.label);
  return { may, asks, never };
}
