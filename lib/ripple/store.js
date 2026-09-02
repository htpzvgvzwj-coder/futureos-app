// Current Ripple store - the PERSISTENT source for "what changed and what
// it did" (section 六). The UI never assembles a ripple from page-local
// state; it reads rows from here. A `possible` ripple can be superseded by
// a `confirmed` one (Seal) without losing history; near-duplicate causes
// merge via `dedupe_key`.

import { query } from "../db.js";

export const RIPPLE_KINDS = [
  "studio_impact",
  "payment_milestone",
  "budget_gap",
  "salary_change",
  "recurring_change",
  "transaction_change",
  "commitment_change",
  "completion",
  "fragment",
];
export const RIPPLE_STATES = ["possible", "placed", "confirmed", "revoked", "superseded"];
export const RIPPLE_SEVERITIES = ["information", "turning_point", "action_required"];

function mapRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    domain: r.domain,
    cause: r.cause,
    monthlyDelta: r.monthly_delta == null ? null : Number(r.monthly_delta),
    affectedGoals: r.affected_goals ?? [],
    state: r.state,
    severity: r.severity,
    dedupeKey: r.dedupe_key,
    sourceRef: r.source_ref ?? {},
    snapshotId: r.snapshot_id,
    supersededBy: r.superseded_by,
    occurredAt: r.occurred_at,
    createdAt: r.created_at,
  };
}

export async function listRippleEvents(profileKey, { limit = 20, includeInactive = false } = {}) {
  const res = await query(
    `select * from ripple_events
     where profile_key = $1 ${includeInactive ? "" : "and state <> 'superseded'"}
     order by occurred_at desc, created_at desc
     limit ${Number(limit) || 20}`,
    [profileKey],
  );
  return res.rows.map(mapRow);
}

// Upsert-by-dedupe: if an active ripple with the same dedupe_key exists,
// SUPERSEDE it and insert the fresh one (history kept, one active row).
export async function recordRippleEvent(profileKey, input) {
  if (!RIPPLE_KINDS.includes(input.kind)) throw new Error(`bad ripple kind: ${input.kind}`);
  const state = input.state ?? "possible";
  if (!RIPPLE_STATES.includes(state)) throw new Error(`bad ripple state: ${state}`);
  const severity = input.severity ?? "information";
  if (!RIPPLE_SEVERITIES.includes(severity)) throw new Error(`bad ripple severity: ${severity}`);

  const insert = async (runner) => {
    if (input.dedupeKey) {
      await runner.query(
        `update ripple_events set state = 'superseded', superseded_by = null
         where profile_key = $1 and dedupe_key = $2 and state not in ('superseded','revoked')`,
        [profileKey, input.dedupeKey],
      );
    }
    const res = await runner.query(
      `insert into ripple_events
         (profile_key, kind, domain, cause, monthly_delta, affected_goals, state, severity, dedupe_key, source_ref, snapshot_id, occurred_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11,coalesce($12, now()))
       returning *`,
      [
        profileKey,
        input.kind,
        input.domain ?? null,
        input.cause ?? "",
        input.monthlyDelta ?? null,
        JSON.stringify(input.affectedGoals ?? []),
        state,
        severity,
        input.dedupeKey ?? null,
        JSON.stringify(input.sourceRef ?? {}),
        input.snapshotId ?? null,
        input.occurredAt ?? null,
      ],
    );
    return mapRow(res.rows[0]);
  };
  return insert({ query: (t, p) => query(t, p) });
}

// Advance a ripple's lifecycle: possible -> placed -> confirmed, or -> revoked.
export async function setRippleState(profileKey, id, nextState) {
  if (!RIPPLE_STATES.includes(nextState)) throw new Error(`bad ripple state: ${nextState}`);
  const res = await query(
    `update ripple_events set state = $3 where id = $1 and profile_key = $2 returning *`,
    [id, profileKey, nextState],
  );
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

// When a plan is sealed: the matching `possible` studio_impact ripple for
// that domain becomes `confirmed`.
export async function confirmDomainRipple(profileKey, domain, { snapshotId = null } = {}) {
  const res = await query(
    `update ripple_events set state = 'confirmed', snapshot_id = coalesce($3, snapshot_id)
     where profile_key = $1 and domain = $2 and kind = 'studio_impact' and state in ('possible','placed')
     returning *`,
    [profileKey, domain, snapshotId],
  );
  return res.rows.map(mapRow);
}

export async function revokeDomainRipple(profileKey, domain) {
  const res = await query(
    `update ripple_events set state = 'revoked'
     where profile_key = $1 and domain = $2 and kind = 'studio_impact' and state in ('possible','placed','confirmed')
     returning *`,
    [profileKey, domain],
  );
  return res.rows.map(mapRow);
}
