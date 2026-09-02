import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCENE_PHASES,
  PHASE_OUTLET,
  MOMENT_OUTLETS,
  momentForPhase,
} from "../lib/living-scene/spine.js";
import {
  commitmentGateOpen,
  allocationGoalId,
  allocationSettled,
} from "../lib/living-scene/gates.js";
import { eventMatchesNode, nodeEvents } from "../lib/life/node-evidence.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, "..", p), "utf8");

// ---- Part 1: exactly one MomentOutlet per phase ----------------------
test("every phase maps to at most one MomentOutlet (or none)", () => {
  for (const phase of SCENE_PHASES) {
    const outlet = momentForPhase(phase);
    assert.ok(outlet === null || (typeof outlet === "string" && MOMENT_OUTLETS.includes(outlet)), `${phase} -> ${outlet}`);
    // a single id or null - never an array of outlets
    assert.ok(!Array.isArray(outlet));
  }
});

test("Memory has NO outlet and is never shown during Guardian", () => {
  assert.equal(PHASE_OUTLET.memory, null, "memory is drawer-only, no phase outlet");
  assert.equal(momentForPhase("guardian"), "guardian_watch");
  assert.notEqual(momentForPhase("guardian"), "sealed_receipt");
  assert.ok(momentForPhase("guardian") !== null && momentForPhase("guardian") !== "memory");
});

test("reality shows no outlet; committed shows only the sealed receipt", () => {
  assert.equal(momentForPhase("reality"), null);
  assert.equal(momentForPhase("committed"), "sealed_receipt");
});

test("SceneShell no longer renders cumulative reached layers or a phase tracker", () => {
  const shell = read("app/components/living-scene/SceneShell.jsx");
  assert.ok(!/phaseReached|mergeReached|s\.reached/.test(shell), "no phaseReached-gated cumulative layer stack");
  assert.ok(/MomentOutlet/.test(shell), "renders the single MomentOutlet");
  // seven-dot tracker / Step N are gone from the runtime UI
  const provider = read("app/components/living-scene/LivingSceneProvider.jsx");
  assert.ok(!/LivingSpine/.test(shell) && !fs.existsSync(path.join(root, "..", "app/components/living-scene/LivingSpine.jsx")), "LivingSpine removed");
  assert.ok(!/spine\.step|SpineTrack|SpineDot/.test(shell + provider), "no Step N / dot tracker markup");
});

// ---- Part 2.1: Shadow Guardian is never automatic -------------------
test("Shadow Guardian preview is called ONLY from an explicit stressTest, never in an effect", () => {
  const provider = read("app/components/living-scene/LivingSceneProvider.jsx");
  const outlet = read("app/components/living-scene/MomentOutlet.jsx");
  // the only shadow-preview fetch in the provider is inside stressTest
  const hits = [...provider.matchAll(/shadow-preview/g)];
  assert.ok(hits.length >= 1, "stressTest still exists");
  // no useEffect body in the provider references shadow-preview
  for (const chunk of provider.split("useEffect").slice(1)) {
    assert.ok(!/shadow-preview/.test(chunk.slice(0, 500)), "no useEffect auto-calls shadow-preview");
  }
  assert.ok(/const stressTest = useCallback\([\s\S]{0,400}shadow-preview/.test(provider), "shadow-preview lives inside stressTest");
  // MomentOutlet's GuardianWatch calls stressTest only from onClick
  assert.ok(/onClick=\{\(\) => s\.stressTest\(\)\}/.test(outlet), "stress-test is an explicit action");
  assert.ok(!/useEffect[\s\S]{0,200}shadow-preview/.test(outlet), "GuardianWatch has no auto shadow fetch");
});

// ---- Part 2.2: allocation never silently routes to Home ------------
test("allocationGoalId returns the customer's explicit target only - no Home default", () => {
  // goal leg with no target -> invalid, no goalId at all
  assert.deepEqual(allocationGoalId({ allocation: { goalMonthly: 200 }, allocationTarget: null }), { goalId: null, valid: false });
  // goal leg WITH a target -> exactly that target
  assert.deepEqual(allocationGoalId({ allocation: { goalMonthly: 200 }, allocationTarget: "emergency" }), { goalId: "emergency", valid: true });
  assert.deepEqual(allocationGoalId({ allocation: { goalMonthly: 200 }, allocationTarget: "retirement" }), { goalId: "retirement", valid: true });
  // "home" only ever appears when the customer explicitly picked home
  assert.equal(allocationGoalId({ allocation: { goalMonthly: 200 }, allocationTarget: "home" }).goalId, "home");
  // no goal leg -> emergency/flexible, still never a silent "home"
  assert.equal(allocationGoalId({ allocation: { emergencyMonthly: 100 } }).goalId, "emergency");
  assert.equal(allocationGoalId({ allocation: { flexibleMonthly: 100 } }).goalId, "flexible");
  assert.equal(allocationGoalId({ allocation: {} }).goalId, "flexible");
});

test("none of Loan/Travel/Investment/Insurance/Retirement/Family default an untargeted allocation to Home", () => {
  for (const _domain of ["loan", "travel", "investment", "insurance", "retirement", "family"]) {
    const r = allocationGoalId({ allocation: { goalMonthly: 300 }, allocationTarget: null });
    assert.equal(r.valid, false);
    assert.notEqual(r.goalId, "home");
  }
  const provider = read("app/components/living-scene/LivingSceneProvider.jsx");
  assert.ok(!/goalId:\s*["']home["']/.test(provider), "no hardcoded goalId: \"home\" in confirmSeal");
});

// ---- Part 2.4: commitment gated on completeness ------------------
test("commitment review is closed while allocation / turning point / branch are incomplete", () => {
  const base = { branchDirty: true, sealed: false, allocationSettled: true, turningPoint: null, turningPointAck: false, serverBranchId: "b1", branchSealable: true };
  assert.equal(commitmentGateOpen(base), true);
  assert.equal(commitmentGateOpen({ ...base, allocationSettled: false }), false, "incomplete allocation blocks it");
  assert.equal(commitmentGateOpen({ ...base, turningPoint: { id: "x" }, turningPointAck: false }), false, "unacked turning point blocks it");
  assert.equal(commitmentGateOpen({ ...base, turningPoint: { id: "x" }, turningPointAck: true }), true);
  assert.equal(commitmentGateOpen({ ...base, serverBranchId: null }), false, "no server branch blocks it");
  assert.equal(commitmentGateOpen({ ...base, branchSealable: false }), false, "unsealable branch blocks it");
  assert.equal(commitmentGateOpen({ ...base, branchDirty: false }), false);
  assert.equal(commitmentGateOpen({ ...base, sealed: true }), false);
});

test("allocationSettled requires an explicit target when the goal leg is funded", () => {
  assert.equal(allocationSettled({ resourceQuestion: false }), true, "no resource question -> settled");
  assert.equal(allocationSettled({ resourceQuestion: true, allocationTouched: false }), false);
  assert.equal(allocationSettled({ resourceQuestion: true, allocationTouched: true, overspent: true }), false);
  assert.equal(allocationSettled({ resourceQuestion: true, allocationTouched: true, allocation: { goalMonthly: 100 }, allocationTarget: null }), false);
  assert.equal(allocationSettled({ resourceQuestion: true, allocationTouched: true, allocation: { goalMonthly: 100 }, allocationTarget: "home" }), true);
  assert.equal(allocationSettled({ resourceQuestion: true, allocationTouched: true, allocation: { flexibleMonthly: 100 } }), true);
});

// ---- Part 2.5: no synthetic Decision Echo from one slider ----------
test("Retirement and Investment scenes carry no synthetic Decision Echo", () => {
  // Retirement is now Future-Day Loom (Living Thread commit 5). It has a
  // REAL turning point (liquidity conflict / breathing floor) - not a
  // synthetic echo - and the real Decision Echo comes from the server's
  // >=3 user-confirmed Ledger actions gate, not from one adjustment.
  const ret = read("app/features/retirement/FutureDayLoom.jsx");
  const inv = read("app/features/investment/CapitalPrism.jsx");
  assert.ok(!/function retirementEcho/.test(ret) && !/futureLifeTimeline\.echo/.test(ret), "no synthetic retirementEcho");
  assert.ok(/detectDecisionEchoes|projection\?\.decisionEcho|decisionEcho/.test(read("app/api/future-day-loom/route.js")), "the real Decision Echo comes from the >=3 gate");
  // Investment is now Capital Prism (Living Thread commit 7). Its turning
  // point is REAL (over-allocated / readiness gate), and the real Decision
  // Echo comes from the server's >=3 user-confirmed Ledger actions gate.
  assert.ok(!/function capitalEcho/.test(inv), "no synthetic capitalEcho");
  assert.ok(!/turningPointFor=\{null\}/.test(inv) && /turningPointFor=\{prismTurningPoint\}/.test(inv), "investment has a real turning point");
  assert.ok(/detectDecisionEchoes|projection\?\.decisionEcho|decisionEcho/.test(read("app/api/capital-prism/route.js")), "the real Decision Echo comes from the >=3 gate");
});

// ---- Part 3: Explore chat opens in chat mode ---------------------
test("Explore 'Talk it through' opens MirrorChatScreen directly in chat view", () => {
  const page = read("app/page.jsx");
  assert.ok(/initialView\s*=\s*"tools"/.test(page), "MirrorChatScreen has an initialView prop");
  assert.ok(/initialView === "chat" \? "chat" : "tools"/.test(page), "chat view honoured");
  assert.ok(/exploreChatScreen[\s\S]{0,200}initialView="chat"/.test(page), "EXPLORE_CHAT passes initialView=\"chat\"");
  assert.ok(!/\bExploreLifeField\b/.test(page), "old 7-node ExploreLifeField grid is gone");
  assert.ok(/<ExploreView\b/.test(page), "the Explore tab renders ExploreView (7 bank capability zones + 9 Studios)");
});

// ---- Part 4: Life evidence is node-specific --------------------
test("Life node history is filtered per node, not a global latest-three", () => {
  const events = [
    { id: 1, domain: "loan", action_type: "branch_created" },
    { id: 2, domain: "home", action_type: "commitment_created" },
    { id: 3, domain: "retirement", message_key: "retirement.saved" },
    { id: 4, domain: "wedding", action_type: "guests_changed" },
  ];
  assert.deepEqual(nodeEvents(events, "freedom").map((e) => e.id), [1], "freedom -> loan/investment only");
  assert.deepEqual(nodeEvents(events, "home").map((e) => e.id), [2]);
  assert.deepEqual(nodeEvents(events, "future").map((e) => e.id), [3]);
  assert.deepEqual(nodeEvents(events, "relationships").map((e) => e.id), [4]);
  assert.deepEqual(nodeEvents(events, "safety").map((e) => e.id), [], "no emergency events -> empty, not the global three");
  assert.equal(eventMatchesNode({ domain: "home" }, "home"), true);
  assert.equal(eventMatchesNode({ domain: "home" }, "freedom"), false);
});

test("the default Life screen dropped the permanent panels", () => {
  const page = read("app/page.jsx");
  const lifeGraph = page.slice(page.indexOf("function LifeGraph("), page.indexOf("function DebateBeat("));
  assert.ok(!/futureAnalystPanel/.test(lifeGraph), "no Future Analyst panel");
  assert.ok(!/screens\.ASSET_PROFILE/.test(lifeGraph), "no Asset Profile card");
  assert.ok(!/detectedNeeds/.test(lifeGraph), "no Detected Needs strip");
  assert.ok(!/screens\.STRATEGIC_BALANCE/.test(lifeGraph), "no Strategic Balance entry");
  assert.ok(!/goWithLoading\(screens\.MIRROR/.test(lifeGraph), "no permanent Open Mirror CTA");
  assert.ok(/lifeNodeMap/.test(lifeGraph), "the living Life Field remains");
});

// ---- Part 5: Guardian default is calm, not a dashboard -----------
test("Guardian's six-stat dashboard and ten-card grid are inside the secondary drawer", () => {
  const page = read("app/page.jsx");
  const guardian = page.slice(page.indexOf("function FutureSelfGuardian("), page.indexOf("function NeedDetailScreen("));
  const detailsAt = guardian.indexOf('className="guardianTrustControls"');
  const gridAt = guardian.indexOf('className="guardianFeatureGrid"');
  const statsAt = guardian.indexOf('className="guardianHubStatus"');
  assert.ok(detailsAt > -1, "a 'Trust, history & controls' <details> exists");
  assert.ok(gridAt > detailsAt, "the ten-card feature grid is inside it");
  assert.ok(statsAt > detailsAt, "the six-stat dashboard is inside it");
  assert.ok(/GuardianDecisions[\s\S]{0,120}FutureHandoffPanel/.test(guardian), "one-decision-or-calm state is the top of the page");
  assert.ok(!/<ShadowGuardianPanel[\s\S]{0,40}\/>\s*<FutureHandoffPanel/.test(guardian), "Shadow Guardian is not an unconditional default panel");
});
