// CRUD for the four Financial Twin row tables: financial_assets,
// liabilities, income_streams, recurring_obligations. Thin - all the
// accounting lives in twin.js; this just persists the customer's confirmed
// facts with provenance.

import { query } from "../db.js";
import { FINANCIAL_ASSET_CLASSES, LIABILITY_CLASSES, LIQUIDITY_CLASSES, SOURCE_TYPES, OWNER_TYPES } from "./classes.js";

const num = (v) => (v == null ? null : Number(v));

// ---- financial_assets ----------------------------------------------

function mapAsset(r) {
  return {
    id: r.id,
    assetClass: r.asset_class,
    label: r.label,
    linkedAccountId: r.linked_account_id,
    currency: r.currency,
    currentValue: num(r.current_value),
    availableValue: num(r.available_value),
    liquidityClass: r.liquidity_class,
    restrictedPurpose: r.restricted_purpose,
    ownerType: r.owner_type,
    ownershipPercent: num(r.ownership_percent),
    sourceType: r.source_type,
    sourceName: r.source_name,
    confidence: r.confidence,
    isUserConfirmed: r.is_user_confirmed,
    asOf: r.as_of,
    lastSyncedAt: r.last_synced_at,
  };
}

export async function listFinancialAssets(profileKey) {
  const res = await query(`select * from financial_assets where profile_key = $1 order by created_at asc`, [profileKey]);
  return res.rows.map(mapAsset);
}

export async function createFinancialAsset(profileKey, a = {}) {
  if (!FINANCIAL_ASSET_CLASSES.includes(a.assetClass)) throw new Error(`invalid asset_class: ${a.assetClass}`);
  if (a.liquidityClass && !LIQUIDITY_CLASSES.includes(a.liquidityClass)) throw new Error(`invalid liquidity_class: ${a.liquidityClass}`);
  if (a.ownerType && !OWNER_TYPES.includes(a.ownerType)) throw new Error(`invalid owner_type: ${a.ownerType}`);
  const sourceType = SOURCE_TYPES.includes(a.sourceType) ? a.sourceType : "user_confirmed";
  const res = await query(
    `insert into financial_assets
       (profile_key, asset_class, label, linked_account_id, currency, current_value, available_value,
        liquidity_class, restricted_purpose, owner_type, ownership_percent, source_type, source_name,
        confidence, is_user_confirmed, as_of)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,coalesce($16, now()))
     returning *`,
    [
      profileKey, a.assetClass, a.label ?? "", a.linkedAccountId ?? null, a.currency ?? "SGD",
      num(a.currentValue) ?? 0, num(a.availableValue), a.liquidityClass ?? "liquid", a.restrictedPurpose ?? null,
      a.ownerType ?? "self", a.ownershipPercent ?? 100, sourceType, a.sourceName ?? null,
      a.confidence ?? "medium", a.isUserConfirmed ?? true, a.asOf ?? null,
    ],
  );
  return mapAsset(res.rows[0]);
}

export async function updateFinancialAsset(profileKey, id, p = {}) {
  const res = await query(
    `update financial_assets set
       label = coalesce($3,label), current_value = coalesce($4,current_value),
       available_value = coalesce($5,available_value), liquidity_class = coalesce($6,liquidity_class),
       restricted_purpose = coalesce($7,restricted_purpose), ownership_percent = coalesce($8,ownership_percent),
       source_type = coalesce($9,source_type), confidence = coalesce($10,confidence),
       is_user_confirmed = coalesce($11,is_user_confirmed), as_of = coalesce($12, now()), updated_at = now()
     where id = $1 and profile_key = $2 returning *`,
    [
      id, profileKey, p.label ?? null, num(p.currentValue), num(p.availableValue), p.liquidityClass ?? null,
      p.restrictedPurpose ?? null, p.ownershipPercent ?? null, p.sourceType ?? null, p.confidence ?? null,
      p.isUserConfirmed ?? null, p.asOf ?? null,
    ],
  );
  return res.rows[0] ? mapAsset(res.rows[0]) : null;
}

export async function deleteFinancialAsset(profileKey, id) {
  const res = await query(`delete from financial_assets where id = $1 and profile_key = $2 returning id`, [id, profileKey]);
  return res.rows.length > 0;
}

// ---- liabilities --------------------------------------------------

function mapLiability(r) {
  return {
    id: r.id,
    liabilityClass: r.liability_class,
    label: r.label,
    linkedAccountId: r.linked_account_id,
    currency: r.currency,
    currentBalance: num(r.current_balance),
    originalPrincipal: num(r.original_principal),
    apr: num(r.apr),
    minimumMonthly: num(r.minimum_monthly),
    nextDueDate: r.next_due_date,
    ownerType: r.owner_type,
    ownershipPercent: num(r.ownership_percent),
    sourceType: r.source_type,
    asOf: r.as_of,
  };
}

export async function listLiabilities(profileKey) {
  const res = await query(`select * from liabilities where profile_key = $1 order by created_at asc`, [profileKey]);
  return res.rows.map(mapLiability);
}

export async function createLiability(profileKey, l = {}) {
  if (!LIABILITY_CLASSES.includes(l.liabilityClass)) throw new Error(`invalid liability_class: ${l.liabilityClass}`);
  const sourceType = SOURCE_TYPES.includes(l.sourceType) ? l.sourceType : "user_confirmed";
  const res = await query(
    `insert into liabilities
       (profile_key, liability_class, label, linked_account_id, currency, current_balance, original_principal,
        apr, minimum_monthly, next_due_date, owner_type, ownership_percent, source_type, as_of)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,coalesce($14, now()))
     returning *`,
    [
      profileKey, l.liabilityClass, l.label ?? "", l.linkedAccountId ?? null, l.currency ?? "SGD",
      num(l.currentBalance) ?? 0, num(l.originalPrincipal), num(l.apr), num(l.minimumMonthly),
      l.nextDueDate ?? null, l.ownerType ?? "self", l.ownershipPercent ?? 100, sourceType, l.asOf ?? null,
    ],
  );
  return mapLiability(res.rows[0]);
}

export async function updateLiability(profileKey, id, p = {}) {
  const res = await query(
    `update liabilities set
       label = coalesce($3,label), current_balance = coalesce($4,current_balance),
       apr = coalesce($5,apr), minimum_monthly = coalesce($6,minimum_monthly),
       next_due_date = coalesce($7,next_due_date), ownership_percent = coalesce($8,ownership_percent),
       source_type = coalesce($9,source_type), as_of = coalesce($10, now()), updated_at = now()
     where id = $1 and profile_key = $2 returning *`,
    [id, profileKey, p.label ?? null, num(p.currentBalance), num(p.apr), num(p.minimumMonthly), p.nextDueDate ?? null, p.ownershipPercent ?? null, p.sourceType ?? null, p.asOf ?? null],
  );
  return res.rows[0] ? mapLiability(res.rows[0]) : null;
}

export async function deleteLiability(profileKey, id) {
  const res = await query(`delete from liabilities where id = $1 and profile_key = $2 returning id`, [id, profileKey]);
  return res.rows.length > 0;
}

// ---- income_streams --------------------------------------------

function mapIncome(r) {
  return {
    id: r.id,
    label: r.label,
    kind: r.kind,
    monthlyAmount: num(r.monthly_amount),
    currency: r.currency,
    payDayOfMonth: r.pay_day_of_month,
    nextExpectedDate: r.next_expected_date,
    sourceType: r.source_type,
    detectedFromAccountId: r.detected_from_account_id,
    active: r.active,
    asOf: r.as_of,
  };
}

export async function listIncomeStreams(profileKey, { activeOnly = true } = {}) {
  const res = await query(
    `select * from income_streams where profile_key = $1 ${activeOnly ? "and active = true" : ""} order by created_at asc`,
    [profileKey],
  );
  return res.rows.map(mapIncome);
}

export async function createIncomeStream(profileKey, i = {}) {
  const sourceType = SOURCE_TYPES.includes(i.sourceType) ? i.sourceType : "user_confirmed";
  const res = await query(
    `insert into income_streams
       (profile_key, label, kind, monthly_amount, currency, pay_day_of_month, next_expected_date, source_type, detected_from_account_id, active, as_of)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11, now())) returning *`,
    [
      profileKey, i.label ?? "", i.kind ?? "salary", num(i.monthlyAmount) ?? 0, i.currency ?? "SGD",
      i.payDayOfMonth ?? null, i.nextExpectedDate ?? null, sourceType, i.detectedFromAccountId ?? null,
      i.active ?? true, i.asOf ?? null,
    ],
  );
  return mapIncome(res.rows[0]);
}

export async function updateIncomeStream(profileKey, id, p = {}) {
  const res = await query(
    `update income_streams set
       label = coalesce($3,label), monthly_amount = coalesce($4,monthly_amount),
       pay_day_of_month = coalesce($5,pay_day_of_month), next_expected_date = coalesce($6,next_expected_date),
       source_type = coalesce($7,source_type), active = coalesce($8,active), as_of = coalesce($9, now()), updated_at = now()
     where id = $1 and profile_key = $2 returning *`,
    [id, profileKey, p.label ?? null, num(p.monthlyAmount), p.payDayOfMonth ?? null, p.nextExpectedDate ?? null, p.sourceType ?? null, p.active ?? null, p.asOf ?? null],
  );
  return res.rows[0] ? mapIncome(res.rows[0]) : null;
}

export async function deleteIncomeStream(profileKey, id) {
  const res = await query(`delete from income_streams where id = $1 and profile_key = $2 returning id`, [id, profileKey]);
  return res.rows.length > 0;
}

// ---- recurring_obligations ------------------------------------

function mapRecurring(r) {
  return {
    id: r.id,
    label: r.label,
    kind: r.kind,
    merchant: r.merchant,
    monthlyAmount: num(r.monthly_amount),
    currency: r.currency,
    cadence: r.cadence,
    nextDueDate: r.next_due_date,
    recurringGroup: r.recurring_group,
    category: r.category,
    sourceType: r.source_type,
    active: r.active,
  };
}

export async function listRecurringObligations(profileKey, { activeOnly = true } = {}) {
  const res = await query(
    `select * from recurring_obligations where profile_key = $1 ${activeOnly ? "and active = true" : ""} order by monthly_amount desc`,
    [profileKey],
  );
  return res.rows.map(mapRecurring);
}

export async function upsertRecurringObligation(profileKey, o = {}) {
  const sourceType = SOURCE_TYPES.includes(o.sourceType) ? o.sourceType : "system_estimated";
  // dedupe by recurring_group when present
  if (o.recurringGroup) {
    const existing = await query(
      `select id from recurring_obligations where profile_key = $1 and recurring_group = $2`,
      [profileKey, o.recurringGroup],
    );
    if (existing.rows[0]) {
      const res = await query(
        `update recurring_obligations set
           label = coalesce($3,label), merchant = coalesce($4,merchant), monthly_amount = coalesce($5,monthly_amount),
           cadence = coalesce($6,cadence), next_due_date = coalesce($7,next_due_date), category = coalesce($8,category),
           source_type = $9, active = coalesce($10,active), updated_at = now()
         where id = $1 and profile_key = $2 returning *`,
        [existing.rows[0].id, profileKey, o.label ?? null, o.merchant ?? null, num(o.monthlyAmount), o.cadence ?? null, o.nextDueDate ?? null, o.category ?? null, sourceType, o.active ?? null],
      );
      return mapRecurring(res.rows[0]);
    }
  }
  const res = await query(
    `insert into recurring_obligations
       (profile_key, label, kind, merchant, monthly_amount, currency, cadence, next_due_date, recurring_group, category, source_type, active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [
      profileKey, o.label ?? "", o.kind ?? "subscription", o.merchant ?? null, num(o.monthlyAmount) ?? 0,
      o.currency ?? "SGD", o.cadence ?? "monthly", o.nextDueDate ?? null, o.recurringGroup ?? null,
      o.category ?? null, sourceType, o.active ?? true,
    ],
  );
  return mapRecurring(res.rows[0]);
}

export async function deleteRecurringObligation(profileKey, id) {
  const res = await query(`delete from recurring_obligations where id = $1 and profile_key = $2 returning id`, [id, profileKey]);
  return res.rows.length > 0;
}
