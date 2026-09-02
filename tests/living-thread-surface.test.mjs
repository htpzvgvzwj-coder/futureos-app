import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildThreadGeometry, smoothPath, arcPath, NODE_ORDER } from "../app/components/living-thread/thread-geometry.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// A realistic-ish thread payload slice.
function thread({ aggregated = [], perStudio = [], resourceLedger = {}, nodeImpacts = {}, hasBaselineConflict = false, conflicts = [] } = {}) {
  return {
    lifeNodes: [
      { id: "income", state: "steady", known: true, moving: false, waiting: false },
      { id: "safety", state: "waiting", known: true, moving: false, waiting: true },
      { id: "home", state: "unknown", known: false, moving: false, waiting: false },
      { id: "relationships", state: "unknown", known: true, moving: false, waiting: false },
      { id: "freedom", state: "steady", known: true, moving: false, waiting: false },
      { id: "future", state: "unknown", known: false, moving: false, waiting: false },
    ],
    crossGoalEdges: [{ from: "home", to: "safety", direction: "down", basis: "x", magnitude: 120, unit: "sgd_per_month", impactState: "ghost" }],
    studioImpacts: { aggregated, perStudio, resourceLedger, nodeImpacts, hasBaselineConflict, conflicts, snapshotId: "snap-abc" },
    activeDrafts: [{ domain: "wedding", planId: "p", branchId: "b", isActive: true }],
    guardianDecision: { needsDecision: false, reason: null, nextCheckAt: null },
    latestChange: { id: "c1", headline: "Sealed a smaller wedding", occurredAt: "2026-08-01" },
  };
}

test("all four lenses run the SAME computation - only `lens` and `layers` differ", () => {
  const t = thread({
    perStudio: [{ domain: "wedding", resourceId: "p:b:released_resource", freedMonthly: 300, addedPressureMonthly: 0 }],
    aggregated: [
      { targetGoalId: "home", metric: "monthlyRoom", unit: "sgd_per_month", state: "ghost", placement: "possible", direction: "up", possibleDelta: 120, placedDelta: null, confirmedDelta: null, favourable: true },
    ],
    nodeImpacts: { home: [{ metric: "monthlyRoom", state: "ghost", placement: "possible" }] },
  });
  const geos = ["today", "life", "explore", "guardian"].map((lens) => buildThreadGeometry({ ...t, lens }));
  const strip = (g) => {
    const { lens, layers, ...rest } = g;
    void lens;
    void layers;
    return JSON.stringify(rest);
  };
  const base = strip(geos[0]);
  for (const g of geos.slice(1)) assert.equal(strip(g), base, "geometry is identical across lenses");
  // the layers DO differ
  assert.notDeepEqual(geos[0].layers, geos[1].layers);
  assert.ok(geos[0].layers.includes("bankNow"), "today lens shows Bank Now");
  assert.ok(geos[1].layers.includes("enterStudios"), "life lens makes studios enterable");
  assert.ok(geos[3].layers.includes("guardianWatch"), "guardian lens shows the watch rail");
  assert.ok(!geos[3].layers.includes("enterStudios"), "guardian lens is not a studio menu");
});

test("decision ripples come from the REAL aggregated impactSet - magnitude drives speed", () => {
  const mk = (delta) =>
    buildThreadGeometry(
      thread({
        perStudio: [{ domain: "wedding", resourceId: "p:b:direct_pressure", freedMonthly: 0, addedPressureMonthly: Math.abs(delta) }],
        aggregated: [
          { targetGoalId: "home", metric: "monthlyRoom", unit: "sgd_per_month", state: "ghost", placement: "possible", direction: "down", possibleDelta: delta, placedDelta: null, confirmedDelta: null },
        ],
      }),
    );
  const small = mk(-40);
  const big = mk(-400);
  const rS = small.ripples.find((r) => r.to === "home");
  const rB = big.ripples.find((r) => r.to === "home");
  assert.ok(rS && rB);
  assert.equal(rS.magnitude, 40);
  assert.equal(rB.magnitude, 400);
  assert.ok(rB.speedMs < rS.speedMs, "a bigger real movement travels faster - speed is not a constant");
  assert.equal(rS.unit, "sgd_per_month");
});

test("a confirmed group makes its node Solid; a placed group makes it Placed; conflict propagates", () => {
  const solid = buildThreadGeometry(
    thread({ nodeImpacts: { safety: [{ metric: "m", state: "solid", placement: "confirmed" }] } }),
  );
  assert.equal(solid.nodes.find((n) => n.id === "safety").state, "solid");

  const placed = buildThreadGeometry(
    thread({ nodeImpacts: { safety: [{ metric: "m", state: "ghost", placement: "placed" }] } }),
  );
  assert.equal(placed.nodes.find((n) => n.id === "safety").state, "placed");

  const conflict = buildThreadGeometry(
    thread({
      hasBaselineConflict: true,
      aggregated: [{ targetGoalId: "home", metric: "monthlyRoom", state: "conflict", invalidReason: "baseline_mismatch" }],
      nodeImpacts: { home: [{ metric: "monthlyRoom", state: "conflict" }] },
    }),
  );
  assert.equal(conflict.nodes.find((n) => n.id === "home").state, "conflict");
  assert.equal(conflict.hasBaselineConflict, true);
  assert.ok(conflict.conflicts.some((c) => c.reason === "baseline_mismatch"));
});

test("the fragment layer reflects the resource ledger (placed vs unplaced), never auto-routed", () => {
  const g = buildThreadGeometry(
    thread({
      resourceLedger: {
        "p:b:released_resource": { resourceId: "p:b:released_resource", domain: "wedding", kind: "released_resource", state: "placed", totalMonthly: 300, placedMonthly: 200, unplacedMonthly: 100 },
      },
    }),
  );
  const f = g.fragments[0];
  assert.equal(f.totalMonthly, 300);
  assert.equal(f.placedMonthly, 200);
  assert.equal(f.unplacedMonthly, 100);
  assert.equal(f.state, "placed");
});

test("geometry helpers are deterministic and NaN-free", () => {
  const d1 = smoothPath([[0, 0], [10, 5], [20, 0], [30, 8]]);
  const d2 = smoothPath([[0, 0], [10, 5], [20, 0], [30, 8]]);
  assert.equal(d1, d2);
  assert.ok(!/NaN/.test(d1));
  assert.ok(!/NaN/.test(arcPath({ x: 10, y: 20 }, { x: 90, y: 20 }, 300)));
  assert.equal(NODE_ORDER.length, 6);
});

// ---- source contract: one surface, four lenses, no second engine -----

test("LivingThreadSurface: one buildThreadGeometry call, reduced-motion honoured, accessible view present", () => {
  const src = read("app/components/living-thread/LivingThreadSurface.jsx");
  assert.equal((src.match(/buildThreadGeometry\(/g) ?? []).length, 1, "the surface computes geometry exactly once");
  assert.match(src, /prefers-reduced-motion: reduce/, "matchMedia reduced-motion");
  assert.match(src, /<ThreadAccessibleView geometry=\{geometry\} lens=\{lens\}/, "the a11y view gets the SAME geometry object");
  assert.match(src, /role="tablist"/, "the four lenses are a tablist, not four screens");
  const a11y = read("app/components/living-thread/ThreadAccessibleView.jsx");
  assert.doesNotMatch(a11y, /buildThreadGeometry|\.reduce\(|Math\.(sin|cos)/, "the a11y view runs NO calculation of its own");
  const css = read("app/components/living-thread/living-thread.module.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.reducedMotion .rippleFlow/, "an explicit reduced-motion class also kills the pulse");
});

test("DecisionRipple animation duration is set from the real speedMs, not a literal", () => {
  const src = read("app/components/living-thread/DecisionRipple.jsx");
  assert.match(src, /animationDuration: `\$\{r\.speedMs\}ms`/);
  assert.doesNotMatch(src, /animationDuration: ["'`]\d/, "no hardcoded duration");
});

test("Part D2: Life / Explore / Guardian render the ONE surface as a lens; Today is the bank home", () => {
  const page = read("app/page.jsx");
  for (const lens of ["life", "explore", "guardian"]) {
    assert.match(page, new RegExp(`livingThreadEntrance\\("${lens}"\\)`), `${lens} entrance renders the shared surface`);
  }
  // Today is now the OCBC Future Bank home (BankHome), not the living-thread surface.
  assert.match(page, /\[screens\.HOME\]:[\s\S]{0,200}<BankHome/, "the Today tab renders BankHome");
  // the lens tabs navigate between the four entrances
  assert.match(page, /onNavigateLens=\{\(next\) => setActiveScreen\(SCREEN_FOR_LENS\[next\]/);
  // studio nodes deep-link into the matching Studio scene
  assert.match(page, /onEnterStudio=\{\(domain\) => \{/);
  const entrance = read("app/components/living-thread/LivingThreadEntrance.jsx");
  assert.match(entrance, /useLifeThread\(\)/, "the entrance reads the ONE canonical thread");
  assert.doesNotMatch(entrance, /\bfetch\(|buildThreadGeometry\(|useState\(/, "the entrance does no fetching or computing of its own");
});

test("GuardianRail states the fixed 'can never' policy and is not a chatbot", () => {
  const src = read("app/components/living-thread/GuardianRail.jsx");
  for (const forbidden of ["move money", "cancel", "block or delay a payment", "change a goal", "shaming"]) {
    assert.ok(src.includes(forbidden), `cannot-list includes "${forbidden}"`);
  }
  assert.doesNotMatch(src, /<textarea|<input[^>]*type=["']text|useChat|sendMessage/i, "no free-text / chat control");
});
