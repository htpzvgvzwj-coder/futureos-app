// Phase 6 Round 5 - Care extras: nudges ("I need you to look at this") and
// owner-defined shared ranges for household members (never exact amounts).

import { query } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";

// ---- nudges -----------------------------------------------
// The owner pushes one specific thing to a linked person. It auto-expires.
export async function createNudge(ownerKey, { roleId, subjectKey, title, detail = null, ref = {} }) {
  if (!subjectKey) throw new Error("nudge needs a linked person");
  const r = await query(
    `insert into care_nudges (profile_key, role_id, subject_key, title, detail, ref)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [ownerKey, roleId ?? null, subjectKey, String(title || "Please take a look").slice(0, 140), detail, JSON.stringify(ref || {})],
  );
  await recordAuditEvent(null, ownerKey, { kind: "care_nudge_sent", detail: { subjectKey, title } });
  return mapNudge(r.rows[0]);
}

// Open nudges addressed to `viewerKey` about `ownerKey`.
export async function listNudges(viewerKey, ownerKey) {
  const r = await query(
    `select * from care_nudges
      where subject_key = $1 and profile_key = $2 and status = 'open' and expires_at > now()
      order by created_at desc limit 20`,
    [viewerKey, ownerKey],
  );
  return r.rows.map(mapNudge);
}

export async function resolveNudge(viewerKey, id) {
  const r = await query(
    `update care_nudges set status = 'done' where id = $1 and subject_key = $2 and status = 'open' returning id`,
    [id, viewerKey],
  );
  return r.rows.length > 0;
}

function mapNudge(r) {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail ?? null,
    ref: typeof r.ref === "string" ? safeJson(r.ref) : r.ref ?? {},
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}
function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// ---- shared ranges --------------------------------------
export const RANGE_CATEGORIES = ["rent", "groceries", "transport", "utilities", "savings", "childcare", "other"];

export async function setSharedRange(ownerKey, { category, low, high, note = null }) {
  const cat = RANGE_CATEGORIES.includes(category) ? category : "other";
  const lo = Math.max(0, Math.round(Number(low) || 0));
  const hi = Math.max(lo, Math.round(Number(high) || 0));
  const r = await query(
    `insert into care_shared_ranges (profile_key, category, low, high, note, updated_at)
     values ($1,$2,$3,$4,$5,now())
     on conflict (profile_key, category) do update set low = excluded.low, high = excluded.high, note = excluded.note, updated_at = now()
     returning *`,
    [ownerKey, cat, lo, hi, note],
  );
  await recordAuditEvent(null, ownerKey, { kind: "care_shared_range_set", detail: { category: cat, low: lo, high: hi } });
  return mapRange(r.rows[0]);
}

export async function deleteSharedRange(ownerKey, category) {
  const r = await query(`delete from care_shared_ranges where profile_key = $1 and category = $2 returning id`, [ownerKey, category]);
  return r.rows.length > 0;
}

export async function listSharedRanges(ownerKey) {
  const r = await query(`select * from care_shared_ranges where profile_key = $1 order by category asc`, [ownerKey]);
  return r.rows.map(mapRange);
}

function mapRange(r) {
  return { category: r.category, low: Number(r.low), high: Number(r.high), note: r.note ?? null, updatedAt: r.updated_at };
}
