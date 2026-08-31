// The nine-Studio flagship completion matrix - SCORED ONLY FROM EXECUTED
// RESULTS (causal-spine round, blocker 6).
//
// A criterion is `met` only when it is backed by one of:
//   - a NAMED unit test that actually PASSED in this run
//   - a Playwright JSON report line for the relevant spec that PASSED
//   - a screenshot file physically present under e2e/
//   - an integration test that PASSED (only when run with --with-integration)
//
// There is NO "the file exists" / "a regex matched the source" evidence.
// Scene-structure, route-shape, Seal-flow, Guardian-rail, reload and
// mobile criteria therefore stay UNMET until the Playwright run + its
// artifacts are committed. This script will not report 9x 19/20.
//
// Run:  node scripts/studio-matrix.mjs [--with-integration] [--json]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLAGSHIP_CRITERIA } from "../lib/living-plan/studio-contract.js";
import { livingPlanDomains, getStudioContract } from "../lib/living-plan/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (...s) => path.join(ROOT, ...s);
const has = (rel) => existsSync(P(rel));
const withIntegration = process.argv.includes("--with-integration");

// ---- run tests, capture EVERY test name -> pass/fail ------------------
function runTests(cmd, args) {
  let out = "";
  try {
    out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    out = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
  }
  const byName = new Map();
  const record = (name, passed) => {
    const n = name.trim();
    if (!n) return;
    byName.set(n, (byName.get(n) ?? true) && passed);
  };
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    // TAP: "ok 12 - name" / "not ok 12 - name"
    let m = /^(ok|not ok) \d+ - (.+?)(?: # .*)?$/.exec(line);
    if (m) {
      record(m[2], m[1] === "ok");
      continue;
    }
    // node:test spec reporter: "✔ name (1.23ms)" / "✖ name (1.23ms)"
    m = /^([✔✖✓✗xX>]|not ok|✔|✖)\s+(.+?)\s+\(\d[\d.]*ms\)$/.exec(line);
    if (m) {
      record(m[2], /[✔✓✔]/.test(m[1]));
      continue;
    }
  }
  const tot = /# pass (\d+)[\s\S]*?# fail (\d+)/.exec(out) || /ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/.exec(out) || /(\d+) passing[\s\S]*?(\d+) failing/.exec(out);
  return { byName, pass: tot ? Number(tot[1]) : 0, fail: tot ? Number(tot[2]) : 0, ran: Boolean(tot) || byName.size > 0 };
}

const unitFiles = readdirSync(P("tests"))
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => path.join("tests", f));
const UNIT = runTests(process.execPath, ["--test", ...unitFiles.map((f) => P(f))]);

const integrationFiles = has("tests/integration")
  ? readdirSync(P("tests/integration"))
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => path.join("tests/integration", f))
  : [];
const INTEGRATION = withIntegration
  ? runTests(process.execPath, ["--test", "--env-file=.env", ...integrationFiles.map((f) => P(f))])
  : { byName: new Map(), pass: 0, fail: 0, ran: false };

const testPassed = (re, results = UNIT) => {
  for (const [name, ok] of results.byName) if (ok && re.test(name)) return true;
  return false;
};
const testExists = (re, results = UNIT) => {
  for (const [name] of results.byName) if (re.test(name)) return true;
  return false;
};

// ---- Playwright / screenshot artifacts --------------------------------
function e2e() {
  let report = null;
  for (const f of ["e2e/report/results.json", "e2e/results.json", "e2e/report/report.json"]) {
    if (has(f)) {
      try {
        report = JSON.parse(readFileSync(P(f), "utf8"));
      } catch {
        /* keep null */
      }
    }
  }
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
  return { report, screenshots, hasReport: report != null || has("e2e/report/index.html") };
}
const E2E = e2e();
const e2eSpecPassed = (specNameRe) => {
  if (!E2E.report || !Array.isArray(E2E.report.suites)) return false;
  const flat = [];
  const collect = (s) => {
    for (const sp of s.specs ?? []) flat.push(sp);
    for (const c of s.suites ?? []) collect(c);
  };
  for (const s of E2E.report.suites) collect(s);
  return flat.some((sp) => specNameRe.test(sp.title ?? "") && (sp.ok === true || (sp.tests ?? []).every((t) => t.results?.every((r) => r.status === "passed"))));
};

// ---- per-Studio unit-test name fragments ------------------------------
const T = {
  home: { sectionM: /SECTION M causal test: raising the price/, impactSet: /projectHomeImpact returns a valid server impactSet/, unknown: /CPF and partner money stay UNKNOWN/, pins: /homeAdapter exposes the six Home domain pins/ },
  emergency: { sectionM: /SECTION M causal test: a bigger target raises the rebuild/, impactSet: /emergencyAdapter exposes the runway .* a cross-goal impactSet/, unknown: /Unknown (liquid assets stay FOG|monthly expenses)/, pins: /emergencyAdapter exposes the runway \+ three domain pins/ },
  loan: { sectionM: /SECTION M causal test: extra repayment/, impactSet: /loanAdapter carries the Gravity view, five domain pins, and a valid cross-goal impactSet/, unknown: /unknown APR \/ fee stay unknown/, pins: /loanAdapter carries the Gravity view, five domain pins/ },
  retirement: { sectionM: /SECTION M causal test: a richer Future Day/, impactSet: /retirementAdapter carries the Loom, the six domain pins, and a valid cross-goal impactSet/, unknown: /CPF LIFE \/ assets \/ inheritance: unknown unless confirmed/, pins: /retirementAdapter carries the Loom, the six domain pins/ },
  travel: { sectionM: /SECTION M causal test: a bigger trip raises the required monthly pace/, impactSet: /travelAdapter carries the Orbit, the domain pins, and a valid cross-goal impactSet/, unknown: /unknown earmarked savings stay FOG/, pins: /travelAdapter carries the Orbit, the domain pins/ },
  investment: { sectionM: /SECTION M causal test: more into the locked bands/, impactSet: /investmentAdapter carries the Prism, the domain pins, and a valid cross-goal impactSet/, unknown: /unknown capital pool stays FOG/, pins: /investmentAdapter carries the Prism, the domain pins/ },
  insurance: { sectionM: /SECTION M causal test: stretching the membrane/, impactSet: /insuranceAdapter carries the Envelope, the domain pins, and a valid cross-goal impactSet/, unknown: /an Unknown node is never counted as a gap/, pins: /insuranceAdapter carries the Envelope, the domain pins/ },
  family: { sectionM: /SECTION M causal test: a higher shared contribution/, impactSet: /familyAdapter carries the Constellation, the domain pins, and a valid cross-goal impactSet/, unknown: /redacted silhouette of the partner/, pins: /familyAdapter carries the Constellation, the domain pins/ },
  wedding: { sectionM: /SECTION M causal test: fewer guests frees/, impactSet: /Wedding adapter now emits the shared Studio-Contract impactSet/, unknown: /an unknown guest count \/ date is surfaced/, pins: /two domain-specific pins are declared as real registry constraints/ },
};

// core cross-cutting tests that must be green for any impact/ghost claim
const CORE_GREEN =
  testPassed(/confirmed aggregation is DELTA-based/) &&
  testPassed(/a SEALED plan keeps influencing the Life Thread as SOLID reality/) &&
  testPassed(/two active branches on one plan -> conflict/) &&
  testPassed(/NO metric->unit guessing/);

function evaluate(domain) {
  const t = T[domain] ?? {};
  const C = {};
  const set = (id, met, ifMet, ifNot) => (C[id] = { met: Boolean(met), evidence: met ? ifMet : ifNot ?? ifMet });

  // -- unit-test-backed logic criteria --
  set("real_finance_recalc", t.sectionM && testPassed(t.sectionM), `unit: the Section-M causal test passed`, t.sectionM ? "the Section-M causal test is failing" : "no mapped Section-M test");
  set("server_impactset", t.impactSet && testPassed(t.impactSet) && CORE_GREEN, "unit: the adapter impactSet test + core impact-measure/current-moment green", "the adapter impactSet test or a core impact-measure test is failing");
  set("two_affected_goals", t.sectionM && testPassed(t.sectionM), "unit: the Section-M test asserts >= 2 affected goals move", "the Section-M test is failing");
  set("ghost_vs_solid", CORE_GREEN && (t.sectionM ? testPassed(t.sectionM) : false), "unit: DELTA-based confirmed aggregation + sealed-solid + ghost-until-allocated all green", "a core ghost/solid test is failing");
  set("unknown_not_faked", t.unknown ? testPassed(t.unknown) : false, "unit: the studio's unknown / FOG test passed", t.unknown ? "the unknown / FOG test is failing" : "no unknown-path unit test for this studio");
  set("two_domain_pins", t.pins ? testPassed(t.pins) : false, "unit: the adapter test asserts the domain pins are real metrics", t.pins ? "the domain-pins adapter test is failing" : "no domain-pin unit test");
  set("memory_scrub", testPassed(/beforeAfter\(index\) returns real Before \/ After state/), "unit: memory-scrub Before/After test passed", "no passing memory-scrub Before/After unit test");
  const guardianRe = /Shadow Guardian previews|Guardian never moves money|guardian.*shadow.*never actual/i;
  set(
    "guardian_no_execution",
    testPassed(guardianRe) || testPassed(guardianRe, INTEGRATION),
    "test: a guardian-no-execution assertion passed",
    "no passing guardian-no-execution assertion (it lives in an integration test - pass --with-integration)",
  );
  const ledgerRe = /Memory Lens builds a real causal chain|Memory Lens.*causal chain/i;
  set(
    "ledger_causal_chain",
    testPassed(ledgerRe) || testPassed(ledgerRe, INTEGRATION),
    "test: the memory-lens causal-chain assertion passed",
    "no passing memory-lens causal-chain assertion (integration - pass --with-integration)",
  );

  // -- integration-run-backed --
  const itestName = new RegExp(`${domain}|${{ home: "Home Horizon", emergency: "Safety Runway", loan: "Debt Gravity", retirement: "Future-Day Loom", travel: "Calendar Orbit", investment: "Capital Prism", insurance: "Living Envelope", family: "Private Constellation", wedding: "Wedding" }[domain]}`, "i");
  set(
    "domain_integration_test",
    withIntegration && INTEGRATION.ran && testPassed(itestName, INTEGRATION),
    `integration run: a ${domain} test passed`,
    withIntegration ? `no passing ${domain} integration test in this run` : "not run - pass --with-integration",
  );

  // -- Playwright / screenshot-backed (NOT provable without the browser run) --
  const pw = e2eSpecPassed(new RegExp("12-point causal-spine walk", "i"));
  set("native_scene", pw, "e2e: the causal-spine walk mounted the scene", "needs the Playwright run (e2e/report absent)");
  set("domain_visual", pw, "e2e: a role=slider handle was visible + moved", "needs the Playwright run");
  set("not_card_grid", pw, "e2e: the SVG main visual passed", "needs the Playwright run");
  set("real_branches", pw, "e2e: Fork + Compare of two branches passed", "needs the Playwright run");
  set("seal_consent", pw, "e2e: Seal preview showed the Guardian summary", "needs the Playwright run");
  set("guardian_in_place", pw, "e2e: .lsGuardianRail appeared after confirm", "needs the Playwright run");
  set("future_fragment", pw, "e2e/api: futureFragment.releasedMonthly asserted", "needs the Playwright run");
  set("added_pressure_source", pw, "e2e/api: addedPressure.sources asserted", "needs the Playwright run");
  set("reload_restores", pw, "e2e: reload kept the sealed moment + Guardian", "needs the Playwright run");
  const shots = E2E.screenshots >= 18; // 9 studios x 2 widths, minimum
  set("mobile_a11y", pw && shots, `e2e: no h-scroll at 320/390 + ${E2E.screenshots} screenshots`, `needs the Playwright run + 320/390 screenshots (have ${E2E.screenshots})`);

  const met = FLAGSHIP_CRITERIA.filter((c) => C[c.id]?.met).length;
  const status = met === FLAGSHIP_CRITERIA.length ? "complete" : met > 0 ? "partial" : "not done";
  return { domain, met, total: FLAGSHIP_CRITERIA.length, status, criteria: C };
}

function matchName(re) {
  for (const [name] of UNIT.byName) if (re.test(name)) return name;
  return re.source;
}

const rows = livingPlanDomains().map(evaluate);
const wired = (d) => Object.values(getStudioContract(d) ?? {}).filter((v) => v != null).length;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ unit: { pass: UNIT.pass, fail: UNIT.fail }, integration: withIntegration ? { pass: INTEGRATION.pass, fail: INTEGRATION.fail } : "not run", e2e: { hasReport: E2E.hasReport, screenshots: E2E.screenshots }, rows }, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nNine-Studio flagship completion matrix (${FLAGSHIP_CRITERIA.length} criteria, scored from EXECUTED results)\n`);
  console.log(`unit tests:        ${UNIT.ran ? `${UNIT.pass} pass / ${UNIT.fail} fail` : "NOT RUN"}${UNIT.fail ? "   <-- NOT GREEN" : ""}`);
  console.log(`integration tests: ${withIntegration ? `${INTEGRATION.pass} pass / ${INTEGRATION.fail} fail` : "not run (pass --with-integration)"}`);
  console.log(`playwright report: ${E2E.hasReport ? "present" : "ABSENT"}   screenshots: ${E2E.screenshots}\n`);
  console.log(`${pad("Studio", 12)} ${pad("Status", 10)} ${pad("Criteria met", 14)} Contract slots`);
  console.log("-".repeat(56));
  for (const r of rows) console.log(`${pad(r.domain, 12)} ${pad(r.status, 10)} ${pad(`${r.met}/${r.total}`, 14)} ${wired(r.domain)}/11`);
  const complete = rows.filter((r) => r.status === "complete").length;
  console.log(`\n${complete}/9 Studios complete. Ready-for-Review requires 9/9 - and that requires the Playwright run + screenshots + a green integration run.`);
  const openByCriterion = {};
  for (const r of rows) for (const c of FLAGSHIP_CRITERIA) if (!r.criteria[c.id]?.met) (openByCriterion[c.id] ??= []).push(r.domain);
  console.log(`\nOpen criteria (why not met):`);
  for (const [id, doms] of Object.entries(openByCriterion)) {
    const ev = rows.find((r) => !r.criteria[id]?.met).criteria[id].evidence;
    console.log(`  - ${id} [${doms.length === 9 ? "ALL nine" : doms.join(", ")}]: ${ev}`);
  }
}
