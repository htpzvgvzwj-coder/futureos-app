import test from "node:test";
import assert from "node:assert/strict";
import { computePrivateConstellation, redactParticipantView, sharedContributionForViewerShare } from "../lib/family/private-constellation-finance.js";
import { projectPrivateConstellationImpact } from "../lib/family/private-constellation-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const ctx = { monthlyIncome: 8000, monthlyExpenses: 4000, otherGoalsMonthlyOutflow: 900 };
const items = [
  { id: "education", label: "Education", category: "education", monthlyCost: 700 },
  { id: "holiday", label: "Holiday", category: "lifestyle", monthlyCost: 300 },
];
const you = { participant_key: "u_you", role: "initiator", display_name: "You", confirmed: true, private_view: { affordableMin: 900, affordableMax: 1400, marks: { education: "mustKeep", holiday: "flexible" } } };
const partner = { participant_key: "u_partner", role: "partner", display_name: "Partner", confirmed: true, private_view: { affordableMin: 800, affordableMax: 1300, marks: { education: "mustKeep", holiday: "flexible" } } };
const plan = (over = {}) => ({ shared_monthly_contribution: 2000, partner_share_ratio: 0.55, items, participants: [you, partner], ...over });

test("the viewer sees their own view in full but only a redacted silhouette of the partner", () => {
  const c = computePrivateConstellation({ planData: plan(), viewerKey: "u_you", context: ctx });
  assert.equal(c.available, true);
  assert.equal(c.viewerView.marks.education, "mustKeep");
  assert.equal(c.viewerView.affordableMax, 1400);
  // the partner is redacted - no numbers, no per-item marks
  assert.equal(c.otherParticipant.confirmed, true);
  assert.equal(c.otherParticipant.markCount, 2);
  assert.equal(c.otherParticipant.affordableMax, undefined);
  assert.equal(c.otherParticipant.marks, undefined);
  assert.ok(!JSON.stringify(c.otherParticipant).includes("1300"), "no partner number leaks");
});

test("redactParticipantView never carries numbers or per-item marks", () => {
  const r = redactParticipantView(partner);
  assert.deepEqual(Object.keys(r).sort(), ["confirmed", "displayName", "hasRange", "joined", "markCount", "role"].sort());
});

test("SECTION M causal test: a higher shared contribution raises the VIEWER's share (their split) - pressure on near-term goals - and frees it when lowered", () => {
  const base = computePrivateConstellation({ planData: plan(), viewerKey: "u_you", context: ctx });
  const more = computePrivateConstellation({ planData: plan({ shared_monthly_contribution: 3000 }), viewerKey: "u_you", context: ctx });
  assert.ok(more.viewerShare.value > base.viewerShare.value, "more shared -> more of the viewer's own share");
  assert.ok(more.currentBreathingRoomAfter.value < base.currentBreathingRoomAfter.value, "the viewer's current room drops");

  const impUp = projectPrivateConstellationImpact({ branchPlan: plan({ shared_monthly_contribution: 3000 }), realityPlan: plan(), context: ctx, viewerKey: "u_you" });
  assert.equal(validateImpactSet(impUp).ok, true);
  assert.ok(impUp.resourceDelta.addedPressureMonthly > 0);
  assert.equal(impUp.resourceDelta.freedMonthly, 0);
  assert.ok(impUp.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  for (const g of impUp.affectedGoals) assert.equal(g.confirmedAfter, null, "possible only until allocated");
  // the impactSet never carries the partner's share
  assert.ok(!("otherShareAfter" in impUp.resourceDelta));

  const impDown = projectPrivateConstellationImpact({ branchPlan: plan({ shared_monthly_contribution: 1000 }), realityPlan: plan(), context: ctx, viewerKey: "u_you" });
  assert.ok(impDown.resourceDelta.freedMonthly > 0);
  assert.equal(impDown.resourceDelta.addedPressureMonthly, 0);
});

test("nothing seals until BOTH independent identities have joined and confirmed separately", () => {
  const soloJoined = computePrivateConstellation({ planData: plan({ participants: [you] }), viewerKey: "u_you", context: ctx });
  assert.equal(soloJoined.bothJoined, false);
  assert.equal(soloJoined.sealable, false);
  assert.equal(soloJoined.sealableReason, "waiting_for_partner_to_join");
  assert.ok(soloJoined.unknowns.includes("partner_participation"));

  const oneUnconfirmed = computePrivateConstellation({ planData: plan({ participants: [you, { ...partner, confirmed: false }] }), viewerKey: "u_you", context: ctx });
  assert.equal(oneUnconfirmed.bothConfirmed, false);
  assert.equal(oneUnconfirmed.sealable, false);
  assert.equal(oneUnconfirmed.sealableReason, "waiting_for_confirmations");
});

test("a conflict (one Must Keep, one Flexible) needs both to reconfirm; sharedContributionForViewerShare back-solves the split", () => {
  const conflicted = computePrivateConstellation({
    planData: plan({ participants: [you, { ...partner, private_view: { affordableMin: 800, affordableMax: 1300, marks: { education: "flexible", holiday: "flexible" } } }] }),
    viewerKey: "u_you",
    context: ctx,
  });
  assert.ok(conflicted.conflictCount >= 1);
  assert.equal(conflicted.bothConfirmedRequired, true);
  assert.equal(sharedContributionForViewerShare({ targetViewerShare: 1100, ratio: 0.55 }), 2000);
});

test("familyAdapter carries the Constellation, the domain pins, and a valid cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("family");
  const f = adapter.feasibility(plan(), { ...ctx, viewerKey: "u_you" });
  assert.ok(f.constellation && f.constellation.available);
  const m = adapter.constraintMetrics(plan(), f, { ...ctx, viewerKey: "u_you" });
  assert.equal(m.no_balance_share, true);
  assert.equal(m.minimum_confirmations, 2);
  assert.equal(m.no_partner_data_in_viewer_response, false);
  const impact = adapter.projectImpacts(plan({ shared_monthly_contribution: 3000 }), plan(), { ...ctx, viewerKey: "u_you" }, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
