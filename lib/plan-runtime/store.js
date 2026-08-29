import { query, pool } from "../db.js";
import { assertTransition } from "./state-machine.js";
import { buildPlanVersion, rollUpConfidence } from "./plan-model.js";

// Plan Runtime store - plans, immutable versions, branches, constraints,
// evidence, transitions, guardian policies. Same conventions as every other
// lib/*-store.js (parallel reads, no SQL joins beyond a plan_id FK, atomic
// upsert for the singleton row). State transitions are validated through
// lib/plan-runtime/state-machine.js before any write.

function toArrayLiteral(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return "{}";
  return `{${ids.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",")}}`;
}

// -------------------------------------------------------------------------
// plans
// -------------------------------------------------------------------------

// Atomic upsert (see lib/wedding-store.js's identical pattern) - one plan
// per (profile, domain, goal_key).
export async function getOrCreatePlan(profileKey, { domain, goalKey, title = "", visibility = "private" }) {
  const key = goalKey ?? domain;
  const result = await query(
    `insert into plans (profile_key, domain, goal_key, title, visibility)
     values ($1, $2, $3, $4, $5)
     on conflict (profile_key, domain, goal_key)
     do update set updated_at = now()
     returning *`,
    [profileKey, domain, key, title, visibility],
  );
  return result.rows[0];
}

export async function getPlan(profileKey, { domain, goalKey }) {
  const result = await query(
    `select * from plans where profile_key = $1 and domain = $2 and goal_key = $3 limit 1`,
    [profileKey, domain, goalKey ?? domain],
  );
  return result.rows[0] ?? null;
}

export async function getPlanById(id, profileKey) {
  const result = await query(`select * from plans where id = $1 and profile_key = $2 limit 1`, [id, profileKey]);
  return result.rows[0] ?? null;
}

export async function listPlans(profileKey) {
  const result = await query(`select * from plans where profile_key = $1 order by updated_at desc`, [profileKey]);
  return result.rows;
}

// Move a plan to a new state. Validates the edge (and, if `actor` given, the
// actor permission) against the state machine first. Returns the updated
// row, or throws a typed Error (code ILLEGAL_TRANSITION / ACTOR_NOT_PERMITTED
// / TERMINAL_STATE / UNKNOWN_STATE).
export async function transitionPlan(planId, profileKey, toState, actor = null) {
  const plan = await getPlanById(planId, profileKey);
  if (!plan) {
    const e = new Error("plan_not_found");
    e.code = "PLAN_NOT_FOUND";
    throw e;
  }
  assertTransition(plan.state, toState, actor);
  const result = await query(
    `update plans set state = $1, updated_at = now() where id = $2 and profile_key = $3 returning *`,
    [toState, planId, profileKey],
  );
  return result.rows[0];
}

// -------------------------------------------------------------------------
// plan_versions (immutable)
// -------------------------------------------------------------------------

// Append the next immutable version. Reads the current version, builds the
// next one via plan-model.js, writes it, and bumps plans.current_version -
// all in one transaction so the chain can never fork.
export async function appendPlanVersion(planId, profileKey, { patch = {}, cause = {}, evidence = [], actor = "user", stateAtVersion = null }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const planRes = await client.query(`select * from plans where id = $1 and profile_key = $2 for update`, [planId, profileKey]);
    const plan = planRes.rows[0];
    if (!plan) throw Object.assign(new Error("plan_not_found"), { code: "PLAN_NOT_FOUND" });

    const baseRes = await client.query(
      `select version, data, evidence from plan_versions where plan_id = $1 order by created_at desc limit 1`,
      [planId],
    );
    const base = baseRes.rows[0]
      ? { version: baseRes.rows[0].version, data: baseRes.rows[0].data }
      : null;

    const next = buildPlanVersion({ base, patch, cause, evidence, actor });
    const state = stateAtVersion ?? plan.state;

    const insertRes = await client.query(
      `insert into plan_versions
         (plan_id, profile_key, version, supersedes_version, actor, state_at_version, data, cause, evidence,
          confidence, evidence_maturity_percent, uncertainty_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [
        planId,
        profileKey,
        next.version,
        next.supersedesVersion,
        actor,
        state,
        JSON.stringify(next.data),
        JSON.stringify(cause),
        JSON.stringify(evidence),
        next.confidence,
        next.evidenceMaturityPercent,
        next.uncertaintyNote,
      ],
    );
    await client.query(`update plans set current_version = $1, updated_at = now() where id = $2`, [next.version, planId]);
    await client.query("commit");
    return insertRes.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCurrentPlanVersion(planId) {
  const result = await query(
    `select * from plan_versions where plan_id = $1 order by created_at desc limit 1`,
    [planId],
  );
  return result.rows[0] ?? null;
}

export async function listPlanVersions(planId) {
  const result = await query(`select * from plan_versions where plan_id = $1 order by created_at asc`, [planId]);
  return result.rows;
}

export async function setVersionLedgerEvent(versionId, ledgerEventId) {
  await query(`update plan_versions set ledger_event_id = $1 where id = $2`, [ledgerEventId, versionId]);
}

// -------------------------------------------------------------------------
// plan_branches (Future Field Peel / Compare / Merge / Seal)
// -------------------------------------------------------------------------

export async function createBranch(planId, profileKey, { label, baseVersion, data = {}, delta = {}, feasibility = {} }) {
  const result = await query(
    `insert into plan_branches (plan_id, profile_key, label, base_version, data, delta, feasibility)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [planId, profileKey, label, baseVersion, JSON.stringify(data), JSON.stringify(delta), JSON.stringify(feasibility)],
  );
  return result.rows[0];
}

export async function listBranches(planId, { includeWithdrawn = false } = {}) {
  const result = await query(
    `select * from plan_branches where plan_id = $1 ${includeWithdrawn ? "" : "and status <> 'withdrawn'"} order by created_at asc`,
    [planId],
  );
  return result.rows;
}

export async function getBranch(id, profileKey) {
  const result = await query(`select * from plan_branches where id = $1 and profile_key = $2 limit 1`, [id, profileKey]);
  return result.rows[0] ?? null;
}

export async function updateBranch(id, profileKey, { data, delta, feasibility, status, sealedCommitmentId }) {
  const sets = [];
  const values = [];
  const push = (col, val, cast = "") => {
    values.push(val);
    sets.push(`${col} = $${values.length}${cast}`);
  };
  if (data !== undefined) push("data", JSON.stringify(data));
  if (delta !== undefined) push("delta", JSON.stringify(delta));
  if (feasibility !== undefined) push("feasibility", JSON.stringify(feasibility));
  if (status !== undefined) push("status", status);
  if (sealedCommitmentId !== undefined) push("sealed_commitment_id", sealedCommitmentId);
  if (!sets.length) return getBranch(id, profileKey);
  values.push(id, profileKey);
  const result = await query(
    `update plan_branches set ${sets.join(", ")}, updated_at = now()
     where id = $${values.length - 1} and profile_key = $${values.length} returning *`,
    values,
  );
  return result.rows[0] ?? null;
}

// -------------------------------------------------------------------------
// plan_constraints (Pins)
// -------------------------------------------------------------------------

export async function setConstraint(profileKey, { planId = null, kind, operator, value = null, valueText = null, scope = "domain", cause = {} }) {
  // A pin of the same kind at the same scope replaces the previous one
  // (released, not deleted - the history stays).
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update plan_constraints set active = false, released_at = now()
       where profile_key = $1 and kind = $2 and scope = $3 and active = true
         and (plan_id is not distinct from $4)`,
      [profileKey, kind, scope, planId],
    );
    const result = await client.query(
      `insert into plan_constraints (profile_key, plan_id, kind, operator, value, value_text, scope, cause)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [profileKey, planId, kind, operator, value, valueText, scope, JSON.stringify(cause)],
    );
    await client.query("commit");
    return result.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseConstraint(id, profileKey) {
  const result = await query(
    `update plan_constraints set active = false, released_at = now()
     where id = $1 and profile_key = $2 and active = true returning *`,
    [id, profileKey],
  );
  return result.rows[0] ?? null;
}

// Every constraint that applies to a given plan: its own plan-scoped pins,
// its domain-scoped pins, and global (scope 'all') pins.
export async function getApplicableConstraints(profileKey, { planId = null, domain = null } = {}) {
  const result = await query(
    `select * from plan_constraints
     where profile_key = $1 and active = true
       and (scope = 'all' or (scope = 'plan' and plan_id = $2) or (scope = 'domain' and $3 is not null))
     order by created_at asc`,
    [profileKey, planId, domain],
  );
  return result.rows;
}

// -------------------------------------------------------------------------
// plan_evidence (Evidence Radar / Quote-to-Plan)
// -------------------------------------------------------------------------

export async function upsertEvidence(planId, profileKey, entry) {
  const result = await query(
    `insert into plan_evidence
       (plan_id, profile_key, field, label, truthfulness, value, range_low, range_high, required, impact_weight,
        source_kind, source_ref, source_updated_at, valid_until)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (plan_id, field) do update set
       label = excluded.label,
       truthfulness = excluded.truthfulness,
       value = excluded.value,
       range_low = excluded.range_low,
       range_high = excluded.range_high,
       required = excluded.required,
       impact_weight = excluded.impact_weight,
       source_kind = excluded.source_kind,
       source_ref = excluded.source_ref,
       source_updated_at = excluded.source_updated_at,
       valid_until = excluded.valid_until,
       updated_at = now()
     returning *`,
    [
      planId,
      profileKey,
      entry.field,
      entry.label ?? "",
      entry.truthfulness ?? "estimate",
      entry.value === undefined ? null : JSON.stringify(entry.value),
      entry.rangeLow ?? null,
      entry.rangeHigh ?? null,
      entry.required ?? false,
      entry.impactWeight ?? 0,
      entry.sourceKind ?? null,
      entry.sourceRef ?? null,
      entry.sourceUpdatedAt ?? null,
      entry.validUntil ?? null,
    ],
  );
  return result.rows[0];
}

export async function listEvidence(planId) {
  const result = await query(`select * from plan_evidence where plan_id = $1 order by impact_weight desc, created_at asc`, [planId]);
  return result.rows;
}

export function summarizeEvidenceConfidence(evidenceRows) {
  return rollUpConfidence(
    evidenceRows.map((row) => ({
      field: row.field,
      truthfulness: row.truthfulness,
      required: row.required,
      value: row.value,
    })),
  );
}

// -------------------------------------------------------------------------
// plan_transitions (Handover / Metamorphosis)
// -------------------------------------------------------------------------

export async function createTransition(profileKey, { fromPlanId, toPlanId = null, transitionType, residualAmount = null, data = {} }) {
  const result = await query(
    `insert into plan_transitions (profile_key, from_plan_id, to_plan_id, transition_type, residual_amount, data)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [profileKey, fromPlanId, toPlanId, transitionType, residualAmount, JSON.stringify(data)],
  );
  return result.rows[0];
}

export async function respondToTransition(id, profileKey, status) {
  const result = await query(
    `update plan_transitions set status = $1, responded_at = now()
     where id = $2 and profile_key = $3 and status = 'proposed' returning *`,
    [status, id, profileKey],
  );
  return result.rows[0] ?? null;
}

export async function listTransitions(profileKey) {
  const result = await query(`select * from plan_transitions where profile_key = $1 order by created_at desc`, [profileKey]);
  return result.rows;
}

// -------------------------------------------------------------------------
// guardian_policies
// -------------------------------------------------------------------------

export async function upsertGuardianPolicy(profileKey, { planId = null, commitmentId = null, canMoveMoney = false, canReschedule = false, canNotify = true, pauseConditions = [], reconfirmAfterDays = null }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update guardian_policies set active = false, revoked_at = now()
       where profile_key = $1 and active = true and (plan_id is not distinct from $2)`,
      [profileKey, planId],
    );
    const result = await client.query(
      `insert into guardian_policies
         (profile_key, plan_id, commitment_id, can_move_money, can_reschedule, can_notify, pause_conditions, reconfirm_after_days)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [profileKey, planId, commitmentId, canMoveMoney, canReschedule, canNotify, JSON.stringify(pauseConditions), reconfirmAfterDays],
    );
    await client.query("commit");
    return result.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveGuardianPolicy(profileKey, planId) {
  const result = await query(
    `select * from guardian_policies where profile_key = $1 and active = true and (plan_id is not distinct from $2) order by created_at desc limit 1`,
    [profileKey, planId],
  );
  return result.rows[0] ?? null;
}

export { toArrayLiteral as _toArrayLiteral };
