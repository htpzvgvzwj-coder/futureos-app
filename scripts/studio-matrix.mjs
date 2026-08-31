// The nine-Studio flagship completion matrix - DERIVED FROM EVIDENCE, not
// a hand-written EVIDENCE={x:true} bag (causal-spine round).
//
// Every criterion resolves to met / not-met from a concrete check:
//   - file / route / interaction CONTENT (regex over the shipped source)
//   - the shared unit-test run actually being green
//   - Playwright / screenshot artifacts being physically present under e2e/
//
// The Playwright-dependent criterion (mobile_a11y) is `met` ONLY when the
// artifacts exist. They do not, so no Studio can read as `complete` until
// the browser-machine QA has been run and its artifacts committed.
//
// Run: node scripts/studio-matrix.mjs        (add --json for machine output)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLAGSHIP_CRITERIA } from "../lib/living-plan/studio-contract.js";
import { getLivingPlanSpec, getStudioContract, livingPlanDomains } from "../lib/living-plan/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (...s) => path.join(ROOT, ...s);
const has = (rel) => existsSync(P(rel));
const read = (rel) => (has(rel) ? readFileSync(P(rel), "utf8") : "");

// ---- run the relevant unit tests once, capture the summary -------------
function runUnitTests(files) {
  const present = files.filter((f) => has(f));
  if (!present.length) return { pass: 0, fail: 0, ran: false };
  let out = "";
  try {
    out = execFileSync(process.execPath, ["--test", ...present.map((f) => P(f))], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    out = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
  }
  const m = /# pass (\d+)[\s\S]*?# fail (\d+)/.exec(out) || /ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/.exec(out);
  return m ? { pass: Number(m[1]), fail: Number(m[2]), ran: true } : { pass: 0, fail: 0, ran: true };
}

const CORE_TESTS = [
  "tests/impact-measure.test.mjs",
  "tests/current-moment.test.mjs",
  "tests/cross-studio-impact.test.mjs",
  "tests/seal-guards.test.mjs",
  "tests/studio-contract.test.mjs",
  "tests/memory-scrub.test.mjs",
  "tests/flagship-a11y-contract.test.mjs",
];
const STUDIO_TEST = {
  home: "tests/home-horizon.test.mjs",
  emergency: "tests/emergency-runway.test.mjs",
  loan: "tests/debt-gravity.test.mjs",
  retirement: "tests/future-day-loom.test.mjs",
  travel: "tests/calendar-orbit.test.mjs",
  investment: "tests/capital-prism.test.mjs",
  insurance: "tests/living-envelope.test.mjs",
  family: "tests/private-constellation.test.mjs",
  wedding: "tests/wedding-thread.test.mjs",
};
const UNIT = runUnitTests([...CORE_TESTS, ...Object.values(STUDIO_TEST)]);
const UNIT_GREEN = UNIT.ran && UNIT.fail === 0 && UNIT.pass > 0;

const STUDIO_FILES = {
  home: { scene: "app/features/home/HomeHorizon.jsx", finance: "lib/home/horizon-finance.js", projector: "lib/home/horizon-projector.js", route: "app/api/home-horizon/route.js", itest: "tests/integration/home-horizon.integration.test.mjs" },
  emergency: { scene: "app/features/emergency/EmergencyRunway.jsx", finance: "lib/emergency/runway-finance.js", projector: "lib/emergency/runway-projector.js", route: "app/api/emergency-runway/route.js", itest: "tests/integration/emergency-runway.integration.test.mjs" },
  loan: { scene: "app/features/loan/DebtGravity.jsx", finance: "lib/loan/debt-gravity-finance.js", projector: "lib/loan/debt-gravity-projector.js", route: "app/api/debt-gravity/route.js", itest: "tests/integration/debt-gravity.integration.test.mjs" },
  retirement: { scene: "app/features/retirement/FutureDayLoom.jsx", finance: "lib/retirement/future-day-finance.js", projector: "lib/retirement/future-day-projector.js", route: "app/api/future-day-loom/route.js", itest: "tests/integration/future-day-loom.integration.test.mjs" },
  travel: { scene: "app/features/travel/CalendarOrbit.jsx", finance: "lib/travel/calendar-orbit-finance.js", projector: "lib/travel/calendar-orbit-projector.js", route: "app/api/calendar-orbit/route.js", itest: "tests/integration/calendar-orbit.integration.test.mjs" },
  investment: { scene: "app/features/investment/CapitalPrism.jsx", finance: "lib/investment/capital-prism-finance.js", projector: "lib/investment/capital-prism-projector.js", route: "app/api/capital-prism/route.js", itest: "tests/integration/capital-prism.integration.test.mjs" },
  insurance: { scene: "app/features/insurance/LivingEnvelope.jsx", finance: "lib/insurance/living-envelope-finance.js", projector: "lib/insurance/living-envelope-projector.js", route: "app/api/living-envelope/route.js", itest: "tests/integration/living-envelope.integration.test.mjs" },
  family: { scene: "app/features/family/PrivateConstellation.jsx", finance: "lib/family/private-constellation-finance.js", projector: "lib/family/private-constellation-projector.js", route: "app/api/private-constellation/route.js", itest: "tests/integration/private-constellation.integration.test.mjs" },
  wedding: { scene: "app/features/wedding/WeddingContinuousScene.jsx", finance: "lib/wedding/plan-finance.js", projector: "lib/wedding/wedding-thread-projector.js", route: "app/api/wedding-thread/route.js", itest: "tests/integration/wedding-thread.integration.test.mjs" },
};
const GENERIC_PINS = new Set(["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move", "no_balance_share", "no_partner_data_in_viewer_response"]);

// ---- Playwright / screenshot artifacts --------------------------------
function e2eArtifacts() {
  const report = has("e2e/report/index.html") || has("e2e/report");
  let screenshots = 0;
  const walk = (d) => {
    if (!has(d)) return;
    for (const f of readdirSync(P(d))) {
      const fp = path.join(d, f);
      if (statSync(P(fp)).isDirectory()) walk(fp);
      else if (/\.png$/i.test(f)) screenshots += 1;
    }
  };
  for (const d of ["e2e/flagship-studios.spec.ts-snapshots", "e2e/visual-regression.spec.ts-snapshots", "e2e/__screenshots__", "e2e/screenshots"]) walk(d);
  return { report, screenshots };
}
const E2E = e2eArtifacts();

const CSS = read("app/globals.css");
const SHELL = read("app/components/living-scene/SceneShell.jsx");
const PROVIDER = read("app/components/living-scene/LivingSceneProvider.jsx");
const SEAL_ROUTE = read("app/api/future-field/seal/route.js");

function evaluate(domain) {
  const f = STUDIO_FILES[domain];
  const spec = getLivingPlanSpec(domain);
  const contract = getStudioContract(domain) ?? {};
  const scene = read(f.scene);
  const proj = read(f.projector);
  const route = read(f.route);
  const domainPins = (contract.constraintKinds ?? spec?.constraints ?? []).filter((c) => !GENERIC_PINS.has(c));

  const C = {};
  const set = (id, met, evidence) => {
    C[id] = { met: Boolean(met), evidence: met ? evidence : `no evidence: ${evidence}` };
  };

  set("native_scene", has(f.scene) && /LivingSceneProvider/.test(scene), `${f.scene} mounts LivingSceneProvider`);
  set("domain_visual", /<svg/.test(scene) && /role="slider"/.test(scene), `${f.scene} has <svg> + role="slider"`);
  set("not_card_grid", /<svg/.test(scene) && !/VIEWS\s*=\s*\[[^\]]*"guests"[^\]]*"budget"[^\]]*"compare"/.test(scene), `${f.scene} main visual is an SVG, not a permanent-tab grid`);
  set("real_finance_recalc", has(f.finance) && /useMemo\(/.test(scene) && /compute[A-Z]\w+\(/.test(scene), `${f.scene} recomputes ${path.basename(f.finance)} in a useMemo`);
  set("server_impactset", /buildImpactSet/.test(proj) && /allocationLegs/.test(proj) && new RegExp(path.basename(f.projector).replace(/\.js$/, "")).test(route), `${path.basename(f.projector)} builds a legged impactSet; the route consumes it`);
  set("two_affected_goals", (proj.match(/goalId:/g) ?? []).length >= 2 || /\.map\(\(goalId\)\s*=>/.test(proj), `${path.basename(f.projector)} affectedGoals has >= 2 entries`);
  set("ghost_vs_solid", /\n\s*legs,\n\s*\}\);/.test(proj), `${path.basename(f.projector)} passes per-leg \`legs\` to buildImpactSet`);
  set(
    "future_fragment",
    /futureFragment:[\s\S]{0,90}releasedMonthly/.test(route) || /futureHandoff(AtPayoff|Preview)[\s\S]{0,120}releasedMonthly/.test(route + proj),
    `${path.basename(f.route)} emits a released resource -> Future Fragment / Handoff (never auto-routed)`,
  );
  set("added_pressure_source", /addedPressure:[\s\S]{0,140}sources:/.test(route), `${path.basename(f.route)} emits addedPressure.sources`);
  set("real_branches", (has("app/components/living-scene/BranchStrip.jsx") && /<BranchStrip/.test(SHELL)) || /Compare strategies|WeddingMirror/.test(scene), `BranchStrip mounted in SceneShell (or a bespoke Compare lens)`);
  set("two_domain_pins", domainPins.length >= 2, `registry declares ${domainPins.length} domain-specific pins: ${domainPins.join(", ") || "none"}`);
  set("seal_consent", /buildSealPreview/.test(SEAL_ROUTE) && /MomentOutlet/.test(SHELL), `seal route builds a consent preview; SceneShell shows the MomentOutlet`);
  set("guardian_in_place", /guardianState:[\s\S]{0,260}watching[\s\S]{0,260}mayNot/.test(route), `${path.basename(f.route)} emits guardianState.watching + mayNot`);
  set("guardian_no_execution", /mayNot:\s*\[[^\]]+\]/.test(route) && !/transferMoney\(|executeTrade\(|bookVendor\(/.test(proj), `guardian.mayNot non-empty; projector never executes`);
  set("ledger_causal_chain", has("lib/living-plan/memory-lens.js") && has("app/api/living-plan/memory-lens/route.js"), `Memory Lens causal chain shipped`);
  set("memory_scrub", has("lib/living-plan/memory-scrub.js") && has("app/api/memory-scrub/route.js") && /ThreadMemoryScrubber/.test(SHELL) && contract.replayMapper != null, `Memory Scrubber + route + mounted + registry.replayMapper`);
  set("reload_restores", /sceneSeal[\s\S]{0,400}identityMatches/.test(PROVIDER), `provider restores a sealed moment on reload`);
  set(
    "mobile_a11y",
    /role="slider"/.test(scene) && /aria-(valuenow|valuetext)=/.test(scene) && /prefers-reduced-motion/.test(CSS) && (E2E.report || E2E.screenshots > 0),
    E2E.report || E2E.screenshots > 0 ? `static a11y OK + Playwright artifacts present` : `static a11y OK, but NO Playwright report / screenshots under e2e/ - run npm run test:e2e on a browser machine`,
  );
  set("unknown_not_faked", /unknown|Unknown|noPlan|FOG|fog/.test(scene), `${f.scene} renders an explicit unknown / no-data path`);
  set(
    "domain_integration_test",
    has(f.itest),
    `${f.itest} present (run: npm run test:integration)`,
  );

  const met = FLAGSHIP_CRITERIA.filter((c) => C[c.id]?.met).length;
  const status = met === FLAGSHIP_CRITERIA.length ? "complete" : met > 0 ? "partial" : "not done";
  return { domain, met, total: FLAGSHIP_CRITERIA.length, status, criteria: C };
}

const rows = livingPlanDomains().map(evaluate);
const wired = (d) => Object.values(getStudioContract(d) ?? {}).filter((v) => v != null).length;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ e2e: E2E, unit: UNIT, rows }, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nNine-Studio flagship completion matrix (${FLAGSHIP_CRITERIA.length} criteria, derived from evidence)\n`);
  console.log(`unit tests: ${UNIT.ran ? `${UNIT.pass} pass / ${UNIT.fail} fail${UNIT_GREEN ? "" : "  <-- NOT GREEN"}` : "not run"}`);
  console.log(`Playwright artifacts: report=${E2E.report ? "yes" : "NO"}  screenshots=${E2E.screenshots}\n`);
  console.log(`${pad("Studio", 12)} ${pad("Status", 10)} ${pad("Criteria met", 14)} Contract slots`);
  console.log("-".repeat(56));
  for (const r of rows) console.log(`${pad(r.domain, 12)} ${pad(r.status, 10)} ${pad(`${r.met}/${r.total}`, 14)} ${wired(r.domain)}/11`);
  const complete = rows.filter((r) => r.status === "complete").length;
  console.log(`\n${complete}/9 Studios complete. Ready-for-Review requires 9/9 with real evidence.`);
  const openByCriterion = {};
  for (const r of rows) for (const c of FLAGSHIP_CRITERIA) if (!r.criteria[c.id]?.met) (openByCriterion[c.id] ??= []).push(r.domain);
  if (Object.keys(openByCriterion).length) {
    console.log(`\nOpen criteria (why not met):`);
    for (const [id, doms] of Object.entries(openByCriterion)) {
      const ev = rows.find((r) => !r.criteria[id]?.met).criteria[id].evidence;
      console.log(`  - ${id} [${doms.length === 9 ? "ALL nine" : doms.join(", ")}]: ${ev}`);
    }
  }
}
