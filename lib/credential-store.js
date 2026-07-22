import crypto from "crypto";
import { query } from "./db.js";

function computeContentHash(snapshot) {
  return crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

// Issuing is a snapshot, not a live query - the hash is fixed at this moment so a third party who
// re-fetches by id later sees exactly what was issued, even if the customer's real scores have
// since moved on. That immutability is what makes the credential portable/verifiable rather than
// just another live dashboard view.
export async function issueCredential(profileKey, snapshot) {
  const contentHash = computeContentHash(snapshot);
  const result = await query(
    `insert into credentials (profile_key, snapshot, content_hash) values ($1, $2, $3) returning id, issued_at`,
    [profileKey, JSON.stringify(snapshot), contentHash],
  );
  const row = result.rows[0];
  return { id: row.id, issuedAt: row.issued_at.toISOString(), contentHash, snapshot };
}

export async function getCredential(id) {
  const result = await query(`select * from credentials where id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, snapshot: row.snapshot, contentHash: row.content_hash, issuedAt: row.issued_at.toISOString() };
}
