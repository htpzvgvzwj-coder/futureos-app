// Living Thread commit 13 - static acceptance checks that CAN run without
// a browser. The full Playwright E2E + real 320/390 screenshots (light /
// dark, EN / ZH, reduced-motion) live in e2e/*.spec.ts and must be run on
// a browser-capable machine (npm run test:e2e). These assertions guard
// the a11y / responsive contract at the source level so a regression is
// caught here even before that run.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

const SCENES = {
  home: { file: "app/features/home/HomeHorizon.jsx", css: "hh" },
  emergency: { file: "app/features/emergency/EmergencyRunway.jsx", css: "rw" },
  loan: { file: "app/features/loan/DebtGravity.jsx", css: "dg" },
  retirement: { file: "app/features/retirement/FutureDayLoom.jsx", css: "lm" },
  travel: { file: "app/features/travel/CalendarOrbit.jsx", css: "co" },
  investment: { file: "app/features/investment/CapitalPrism.jsx", css: "cp" },
  insurance: { file: "app/features/insurance/LivingEnvelope.jsx", css: "le" },
  family: { file: "app/features/family/PrivateConstellation.jsx", css: "pc" },
  wedding: { file: "app/features/wedding/WeddingContinuousScene.jsx", css: "wc" },
};

const globals = read("app/globals.css");

// The concatenated body of every @media (prefers-reduced-motion: reduce)
// block in globals.css (brace-matched, so inner rule `}` don't truncate).
function reducedMotionBodies(css) {
  const bodies = [];
  const marker = "@media (prefers-reduced-motion: reduce)";
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start === -1) break;
    let i = css.indexOf("{", start);
    let depth = 0;
    let j = i;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.push(css.slice(i + 1, j));
    from = j + 1;
  }
  return bodies.join("\n");
}
const REDUCED_MOTION = reducedMotionBodies(globals);

for (const [domain, { file, css }] of Object.entries(SCENES)) {
  test(`${domain} scene: a direct-manipulation handle is a keyboard-operable slider`, () => {
    const src = read(file);
    assert.match(src, /role="slider"/, `${domain}: has a role="slider" handle`);
    // aria-valuenow OR aria-valuetext (a 2-axis knob uses valuetext)
    assert.ok(/aria-valuenow=/.test(src) || /aria-valuetext=/.test(src), `${domain}: slider exposes a current value to AT`);
    assert.match(src, /aria-label=/, `${domain}: slider is labelled`);
    assert.match(src, /onKeyDown=/, `${domain}: slider handles keyboard`);
    assert.match(src, /Arrow(Left|Right|Up|Down)/, `${domain}: Arrow keys move the handle`);
    assert.match(src, /e\.preventDefault\(\)/, `${domain}: keyboard handler prevents page scroll`);
  });

  test(`${domain} scene: reduced-motion is honoured for its class prefix`, () => {
    assert.match(REDUCED_MOTION, new RegExp(`\\.${css}[A-Za-z]`), `${domain}: a prefers-reduced-motion rule targets .${css}* classes`);
  });

  test(`${domain} scene: no fabricated data - an Unknown path is rendered`, () => {
    const src = read(file);
    assert.match(src, /unknown|Unknown|noPlan|FOG|fog/, `${domain}: renders an explicit unknown / no-data state`);
  });
}

test("globals.css keeps wide content inside its own horizontal-scroll container (no body scroll)", () => {
  assert.match(globals, /overflow-x: auto/, "at least one overflow-x: auto scroll container exists");
});

test("the Playwright config + specs exist and DO NOT conditionally skip", () => {
  const cfg = read("playwright.config.ts");
  assert.match(cfg, /mobile-320/);
  assert.match(cfg, /mobile-390/);
  assert.match(cfg, /globalSetup/, "auth is seeded by a globalSetup, not an env var");
  const spec = read("e2e/flagship-studios.spec.ts");
  assert.match(spec, /getByRole\("slider"\)/);
  assert.match(spec, /ArrowRight/);
  assert.doesNotMatch(spec, /test\.skip\(/, "no conditional test.skip in the flagship spec");
  assert.doesNotMatch(spec, /if \(await .*\.(isEnabled|isVisible)\(\)/, "no if-guarded steps - every step expects visible + enabled");
  assert.match(spec, /toHaveScreenshot/, "each Studio produces a screenshot");
  const vr = read("e2e/visual-regression.spec.ts");
  assert.doesNotMatch(vr, /test\.skip\(/, "no conditional skip in the visual spec");
  read("e2e/global-setup.ts"); // present
});

test("Part C: each flagship walk runs as its OWN (domain x project) identity - no shared account", () => {
  const spec = read("e2e/flagship-studios.spec.ts");
  // no global storageState, and each test loads its identity's cookies
  assert.match(spec, /storageState:\s*\{\s*cookies:\s*\[\]/, "the spec explicitly drops any inherited auth");
  assert.match(spec, /loadIdentity\(context, s\.domain, project\)/, "each test loads its (domain x project) cookies");
  assert.match(spec, /authFileFor\(/, "identity file is resolved per (domain, project)");
  const cfg = read("playwright.config.ts");
  assert.doesNotMatch(cfg, /storageState:\s*["']e2e\/\.auth\/user\.json["']/, "no single shared storageState in the config");
  const seed = read("scripts/seed-e2e-user.mjs");
  assert.match(seed, /for \(const project of PROJECTS\)/, "the seed creates one identity per (domain x project)");
  assert.match(seed, /identityEmail\(domain, project\)/);
});

test("Part C: the flagship walk has exactly 20 numbered checks", () => {
  const spec = read("e2e/flagship-studios.spec.ts");
  assert.match(spec, /20-check causal-spine walk/);
  const nums = [...spec.matchAll(/^\s*\/\/ (\d{1,2}) - /gm)].map((m) => Number(m[1]));
  assert.deepEqual(nums, Array.from({ length: 20 }, (_, i) => i + 1), "checks 1..20 are present and in order");
});

test("Part C: the matrix scores the walk PER viewport and needs a screenshot file per (studio, viewport)", () => {
  const m = read("scripts/studio-matrix.mjs");
  assert.match(m, /PROJECTS\.every\(\(p\) => perProject\[p\]\)/, "Playwright criteria require a pass in every viewport");
  assert.match(m, /function shotPresent\(hash, project\)/, "screenshots are checked as a (hash x project) file matrix");
  assert.doesNotMatch(m, /E2E\.screenshots >= 18/, "no 'count >= 18' shortcut any more");
  assert.match(m, /t\.itest && testPassed\(t\.itest, INTEGRATION\)/, "integration evidence is matched by an exact title prefix");
});
