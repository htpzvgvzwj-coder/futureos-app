// Private Constellation domain integration test (Living Thread commit 9)
// against the REAL database. Proves: TWO INDEPENDENT identities join one
// family plan via the invite code, each writes ONLY their own private
// view, the blind merge runs server-side, and neither viewer's response
// carries the other's affordability numbers or per-item marks.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [store, ps, finance, db] = await Promise.all([
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/family/participant-store.js"),
    import("../../lib/family/private-constellation-finance.js"),
    import("../../lib/db.js"),
  ]);
  return { store, ps, finance, pool: db.pool };
}

test("Private Constellation: two independent identities join + confirm separately; neither viewer response leaks the other's numbers", opts, async (t) => {
  const { store, ps, finance, pool } = await mods();
  const pk = `itest-constellation-${Date.now()}`;
  const partnerKey = `${pk}-partner`;
  let familyPlanId = null;
  t.after(async () => {
    if (familyPlanId) await pool.query("delete from family_participants where family_plan_id = $1", [familyPlanId]);
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from family_plans where plan_id = $1", [id]);
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "family", goalKey: "family", title: "family" });
  await store.appendPlanVersion(plan.id, pk, { patch: { shared_monthly_contribution: 2000, partner_share_ratio: 0.55, items: [{ id: "education", label: "Education", monthlyCost: 700 }] }, cause: { trigger: "itest" }, actor: "system" });

  const familyPlan = await ps.ensureFamilyPlan({ planId: plan.id, createdBy: pk });
  familyPlanId = familyPlan.id;
  await ps.ensureParticipant({ familyPlanId, participantKey: pk, role: "initiator", displayName: "Initiator" });

  // A SECOND, independent identity joins via the invite code.
  const joined = await ps.joinByInviteCode({ inviteCode: familyPlan.invite_code, participantKey: partnerKey, displayName: "Partner" });
  assert.equal(joined.ok, true, "partner joined by code");

  const full = await ps.joinByInviteCode({ inviteCode: familyPlan.invite_code, participantKey: `${pk}-third` });
  assert.equal(full.ok, false, "a third identity is refused");
  assert.equal(full.error, "family_plan_full");

  // Each identity writes ONLY their own private view.
  await ps.saveOwnView({ familyPlanId, participantKey: pk, privateView: { affordableMin: 900, affordableMax: 1400, marks: { education: "mustKeep" } }, confirm: true });
  await ps.saveOwnView({ familyPlanId, participantKey: partnerKey, privateView: { affordableMin: 800, affordableMax: 1300, marks: { education: "mustKeep" } }, confirm: true });

  const participants = await ps.listParticipants(familyPlanId);
  assert.equal(participants.length, 2);

  const planData = { shared_monthly_contribution: 2000, partner_share_ratio: 0.55, items: [{ id: "education", label: "Education", monthlyCost: 700 }], participants };

  // The INITIATOR's view.
  const asInitiator = finance.computePrivateConstellation({ planData, viewerKey: pk, context: { monthlyIncome: 8000, monthlyExpenses: 4000, otherGoalsMonthlyOutflow: 900 } });
  assert.equal(asInitiator.viewerView.affordableMax, 1400, "initiator sees their own number");
  assert.equal(asInitiator.otherParticipant.confirmed, true);
  assert.equal(asInitiator.otherParticipant.affordableMax, undefined);
  assert.ok(!JSON.stringify(asInitiator.otherParticipant).includes("1300"), "partner's number does not leak to the initiator");
  assert.equal(asInitiator.bothConfirmed, true);
  assert.equal(asInitiator.sealable, true, "both joined + both confirmed + feasible band");

  // The PARTNER's view - mirror image, still redacted the other way.
  const asPartner = finance.computePrivateConstellation({ planData, viewerKey: partnerKey, context: { monthlyIncome: 7000, monthlyExpenses: 3500, otherGoalsMonthlyOutflow: 700 } });
  assert.equal(asPartner.viewerView.affordableMax, 1300, "partner sees their own number");
  assert.ok(!JSON.stringify(asPartner.otherParticipant).includes("1400"), "initiator's number does not leak to the partner");

  // Structural: a scoped query for one identity's row never returns the other's private_view.
  const scoped = await pool.query("select private_view from family_participants where family_plan_id = $1 and participant_key = $2", [familyPlanId, pk]);
  assert.equal(scoped.rows.length, 1);
  assert.equal(scoped.rows[0].private_view.affordableMax, 1400);
});
