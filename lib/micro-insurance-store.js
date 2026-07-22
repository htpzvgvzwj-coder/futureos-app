import { query } from "./db.js";

// Single demo persona today — no auth/multi-user system exists in this app. One row per offer, no
// sessions/messages table (mirrors lib/decision-store.js's shape - this is a triggered event, not a
// conversation).

export async function saveOffer(profileKey, { triggerPurpose, gapAmount, durationMonths, monthlyPremium, totalPremium }) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
  const result = await query(
    `insert into micro_insurance_offers
       (profile_key, trigger_purpose, gap_amount, duration_months, monthly_premium, total_premium, status, expires_at)
     values ($1, $2, $3, $4, $5, $6, 'offered', $7)
     returning id, created_at, expires_at`,
    [profileKey, triggerPurpose, gapAmount, durationMonths, monthlyPremium, totalPremium, expiresAt.toISOString()],
  );
  const row = result.rows[0];
  return { id: row.id, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString() };
}

function mapRow(row) {
  return {
    id: row.id,
    triggerPurpose: row.trigger_purpose,
    gapAmount: Number(row.gap_amount),
    durationMonths: row.duration_months,
    monthlyPremium: Number(row.monthly_premium),
    totalPremium: Number(row.total_premium),
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function getLatestPendingOffer(profileKey) {
  const result = await query(
    `select * from micro_insurance_offers where profile_key = $1 and status = 'offered' order by created_at desc limit 1`,
    [profileKey],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function updateOfferStatus(id, profileKey, status) {
  const result = await query(
    `update micro_insurance_offers set status = $1 where id = $2 and profile_key = $3 returning *`,
    [status, id, profileKey],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getAllOffers(profileKey) {
  const result = await query(`select * from micro_insurance_offers where profile_key = $1 order by created_at desc`, [profileKey]);
  return result.rows.map(mapRow);
}
