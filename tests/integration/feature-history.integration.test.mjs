// Per-feature history — the Guardian sub-section scopes. Seeds a mix of
// Change Ledger + audit events and checks each sub-feature returns only
// what belongs to it (incl. the action_type filter). Real Neon DB.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [hist, ledger, audit, db] = await Promise.all([
    import("../../lib/history/feature-history.js"),
    import("../../lib/change-ledger/store.js"),
    import("../../lib/account-control/store.js"),
    import("../../lib/db.js"),
  ]);
  return { hist, ledger, audit, pool: db.pool };
}

async function makeUser(pool) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`fh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanup(pool, uid) {
  for (const t of ["change_ledger_events", "audit_events"]) {
    await pool.query(`delete from ${t} where profile_key = $1`, [uid]).catch(() => {});
  }
  await pool.query(`delete from users where id = $1`, [uid]).catch(() => {});
}

test("Guardian sub-section histories are correctly scoped", opts, async () => {
  const { hist, ledger, audit, pool } = await mods();
  const uid = await makeUser(pool);
  try {
    // a collision path (guardian ledger, action_type plan_updated) + its audit
    await ledger.recordEventSafe({
      profileKey: uid,
      actor: "user",
      sourceFeature: "guardian",
      actionType: "plan_updated",
      status: "scheduled",
      messageKey: "ledger.collisionPathChosen",
      cause: { trigger: "guardian_collision_path", pathId: "pause_smaller" },
      impactSet: [{ goalId: "cashflow", metric: "freeMonthlyCashflow", before: 100, after: 400, unit: "sgd_per_month", direction: "up" }],
    });
    await audit.recordAuditEvent(null, uid, { kind: "guardian_collision_path_applied", detail: { pathId: "pause_smaller", freed: 300 } });

    // a recovery step (guardian ledger, action_type commitment_paused) + audit
    await ledger.recordEventSafe({
      profileKey: uid,
      actor: "user",
      sourceFeature: "guardian",
      actionType: "commitment_paused",
      status: "paused",
      messageKey: "ledger.recoveryPausedPlans",
      cause: { trigger: "guardian_recovery" },
      impactSet: [{ goalId: "cashflow", metric: "freeMonthlyCashflow", before: 0, after: 250, unit: "sgd_per_month", direction: "up" }],
    });
    await audit.recordAuditEvent(null, uid, { kind: "guardian_recovery_step_applied", detail: { order: 3, freed: 250 } });

    // a contract change + an approval (audit only)
    await audit.recordAuditEvent(null, uid, { kind: "guardian_contract_changed", detail: { capability: "pause_plan_contribution", level: "act" } });
    await audit.recordAuditEvent(null, uid, { kind: "authorization_approved", detail: { amount: 500 } });

    const collision = await hist.buildFeatureHistory(uid, "guardian:collision");
    const recovery = await hist.buildFeatureHistory(uid, "guardian:recovery");
    const contract = await hist.buildFeatureHistory(uid, "guardian:contract");
    const approvals = await hist.buildFeatureHistory(uid, "guardian:approvals");
    const moves = await hist.buildFeatureHistory(uid, "guardian:moves");
    const all = await hist.buildFeatureHistory(uid, "guardian");

    // collision: its ledger row (plan_updated) + its audit, NOT the recovery ledger row
    assert.ok(collision.some((e) => /plan updated/i.test(e.what)), "collision has its ledger row");
    assert.ok(collision.some((e) => /collision path applied/i.test(e.what)), "collision has its audit row");
    assert.ok(!collision.some((e) => /commitment paused/i.test(e.what)), "collision does NOT include the recovery ledger row");

    // recovery: its commitment_paused ledger row + audit, NOT the plan_updated row
    assert.ok(recovery.some((e) => /commitment paused/i.test(e.what)));
    assert.ok(!recovery.some((e) => /plan updated/i.test(e.what)));

    // contract: only the contract audit
    assert.equal(contract.length, 1);
    assert.match(contract[0].what, /contract changed/i);

    // approvals: only the approval audit
    assert.ok(approvals.some((e) => /approved/i.test(e.what)));
    assert.ok(!approvals.some((e) => /contract/i.test(e.what)));

    // moves: both guardian ledger rows + both action audits
    assert.ok(moves.some((e) => /plan updated/i.test(e.what)));
    assert.ok(moves.some((e) => /commitment paused/i.test(e.what)));

    // the page-foot aggregate still sees everything
    assert.ok(all.length >= 5);
  } finally {
    await cleanup(pool, uid);
  }
});

test("money_rescue and protect_handoff sub-features are scoped to their own events", opts, async () => {
  const { hist, ledger, audit, pool } = await mods();
  const uid = await makeUser(pool);
  try {
    // a Money Rescue action: emergency ledger, action_type rescue_adopted
    await ledger.recordEventSafe({
      profileKey: uid,
      actor: "user",
      sourceFeature: "emergency",
      actionType: "rescue_adopted",
      status: "active",
      messageKey: "changeLedger.event.rescue_adopted.drawdown_emergency_fund",
      cause: { trigger: "hardship_recovery_action_applied", guardianAction: "drawdown_emergency_fund" },
      impactSet: [{ goalId: "emergency", metric: "emergencyBuffer", before: 6, after: 4.5, unit: "months", direction: "down" }],
    });
    // an Emergency Studio seal (also sourceFeature emergency) — must NOT show in money_rescue
    await ledger.recordEventSafe({
      profileKey: uid,
      actor: "user",
      sourceFeature: "emergency",
      actionType: "branch_sealed",
      status: "active",
      messageKey: "changeLedger.event.branch_sealed.headline",
      impactSet: [{ goalId: "emergency", metric: "monthlyContribution", before: 0, after: 250, unit: "sgd_per_month", direction: "up" }],
    });
    // a Protection Studio seal: insurance ledger + a written handoff plan
    await ledger.recordEventSafe({
      profileKey: uid,
      actor: "user",
      sourceFeature: "insurance",
      actionType: "branch_sealed",
      status: "active",
      messageKey: "changeLedger.event.branch_sealed.headline",
      impactSet: [{ goalId: "insurance", metric: "monthlyContribution", before: 0, after: 78, unit: "sgd_per_month", direction: "up" }],
    });
    await audit.recordAuditEvent(null, uid, { kind: "handoff_plan_described", detail: { kind: "general" } });

    const rescue = await hist.buildFeatureHistory(uid, "money_rescue");
    const protect = await hist.buildFeatureHistory(uid, "protect_handoff");

    assert.equal(rescue.length, 1, "money_rescue: only the rescue_adopted row");
    assert.match(rescue[0].what, /rescue adopted/i);

    assert.ok(protect.some((e) => /branch sealed/i.test(e.what)), "protect_handoff has the insurance seal");
    assert.ok(protect.some((e) => /handoff plan described/i.test(e.what)), "protect_handoff has the handoff plan");
    assert.ok(!protect.some((e) => /rescue adopted/i.test(e.what)), "protect_handoff excludes rescue events");
  } finally {
    await cleanup(pool, uid);
  }
});
