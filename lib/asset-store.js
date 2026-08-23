import { query } from "./db.js";
import { isValidCategory, isValidSubtype } from "./asset-taxonomy.js";

// Every write here validates category/subtype against the fixed taxonomy
// (lib/asset-taxonomy.js) before touching the database - this is the real
// server-side enforcement of "closed picklist, not free text" (the frontend
// picker only using the same list is not sufficient on its own).
function assertValidTaxonomy(category, subtype) {
  if (!isValidCategory(category)) throw new Error("invalid_category");
  if (!isValidSubtype(category, subtype)) throw new Error("invalid_subtype");
}

export async function listAssets(profileKey) {
  const result = await query(
    `select id, category, subtype, name, value, strength_rating, details, notes, created_at, updated_at
     from assets where profile_key = $1 order by created_at desc`,
    [profileKey]
  );
  return result.rows.map(mapRow);
}

export async function createAsset(profileKey, { category, subtype, name, value, strengthRating, details, notes }) {
  assertValidTaxonomy(category, subtype);
  const result = await query(
    `insert into assets (profile_key, category, subtype, name, value, strength_rating, details, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, category, subtype, name, value, strength_rating, details, notes, created_at, updated_at`,
    [profileKey, category, subtype, name, value ?? null, strengthRating ?? null, details ?? {}, notes ?? null]
  );
  return mapRow(result.rows[0]);
}

// Full-replace edit (the frontend edit form always submits the complete
// item, not a sparse patch) - simpler and avoids ambiguity over whether an
// omitted field means "leave alone" or "clear it".
export async function updateAsset(profileKey, id, { name, value, strengthRating, details, notes }) {
  const result = await query(
    `update assets set
       name = $3,
       value = $4,
       strength_rating = $5,
       details = $6,
       notes = $7,
       updated_at = now()
     where id = $1 and profile_key = $2
     returning id, category, subtype, name, value, strength_rating, details, notes, created_at, updated_at`,
    [id, profileKey, name, value ?? null, strengthRating ?? null, details ?? {}, notes ?? null]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function deleteAsset(profileKey, id) {
  const result = await query(`delete from assets where id = $1 and profile_key = $2 returning id`, [id, profileKey]);
  return result.rows.length > 0;
}

function mapRow(row) {
  return {
    id: row.id,
    category: row.category,
    subtype: row.subtype,
    name: row.name,
    value: row.value === null ? null : Number(row.value),
    strengthRating: row.strength_rating === null ? null : Number(row.strength_rating),
    details: row.details ?? {},
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
