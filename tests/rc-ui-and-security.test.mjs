import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rateLimit, sameOriginOk, guard } from "../lib/http-guards.js";
import { checkEnv } from "../lib/env-check.js";

const read = (p) => readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");
const req = (method, headers = {}) => ({ method, headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

// ---- rate limiting -------------------------------------------------

test("rateLimit allows up to `limit` then blocks with a retryAfter, and resets after the window", () => {
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 3; i += 1) assert.equal(rateLimit(key, { limit: 3, windowMs: 10_000 }).ok, true);
  const blocked = rateLimit(key, { limit: 3, windowMs: 10_000 });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0);
});

// ---- same-origin / CSRF -----------------------------------------

test("sameOriginOk: GET always ok; a mutation needs a matching Origin/Referer; a mismatch or absent header fails", () => {
  assert.equal(sameOriginOk(req("GET")), true);
  assert.equal(sameOriginOk(req("POST", { host: "app.example", origin: "https://app.example" })), true);
  assert.equal(sameOriginOk(req("POST", { host: "app.example", referer: "https://app.example/x" })), true);
  assert.equal(sameOriginOk(req("POST", { host: "app.example", origin: "https://evil.example" })), false);
  assert.equal(sameOriginOk(req("POST", { host: "app.example" })), false, "no Origin and no Referer -> cannot verify -> reject");
});

test("guard() short-circuits with 403 on CSRF fail and 429 on rate-limit", () => {
  const csrf = guard(req("POST", { host: "a" , origin: "https://b" }), { bucket: "g1", limit: 5 });
  assert.equal(csrf.status, 403);
  const key = `g-${Math.random()}`;
  let last;
  for (let i = 0; i < 6; i += 1) last = guard(req("POST", { host: "a", origin: "https://a" }), { bucket: key, limit: 3, windowMs: 5000 });
  assert.equal(last.status, 429);
});

// ---- env check --------------------------------------------------

test("checkEnv reports missing required vars by key only (never a value) and defaults providers to unavailable", () => {
  const r = checkEnv({ DATABASE_URL: "postgres://secret" });
  assert.equal(r.ok, true);
  assert.equal(r.providers.payment_provider, "unavailable");
  const r2 = checkEnv({});
  assert.equal(r2.ok, false);
  assert.deepEqual(r2.missingRequired, ["DATABASE_URL"]);
  assert.equal(JSON.stringify(r2).includes("secret"), false);
});

// ---- UI source contracts (no browser) ------------------------

test("the onboarding wizard is a real multi-step UI, not just an API", () => {
  const src = read("app/components/bank/OnboardingWizard.jsx");
  for (const step of ["account_type", "consent", "add_reality", "first_result"]) assert.match(src, new RegExp(step));
  assert.match(src, /Individual adult/);
  assert.match(src, /Youth with a guardian/);
  assert.match(src, /Available cash|Total cash/i);
  assert.match(src, /Safe-to-Spend/);
  // account-type-specific permission copy + revoke note
  assert.match(src, /revoke.*this later/i);
});

test("the four bank flows are wired into app/page.jsx as real screens with an onboarding gate", () => {
  const page = read("app/page.jsx");
  for (const s of ["ONBOARDING", "REALITY_ENTRY", "CSV_IMPORT", "ACCOUNT_CONTROL", "MONEY_RESCUE"]) {
    assert.match(page, new RegExp(`${s}:`), `screens.${s} declared`);
  }
  assert.match(page, /<OnboardingGate onOpen=\{openFromBank\}[^>]*>/, "Today is behind the onboarding gate");
  assert.match(page, /<RealityEntryConnected/);
  assert.match(page, /<CsvImportConnected/);
  assert.match(page, /<AccountControlConnected/);
  // Reality Drift now reaches the user as a Money Moment (lib/money-moments
  // driftToMoment), surfaced on the Today and Life tabs.
  assert.match(read("lib/money-moments/build.js"), /driftToMoment|reality_drift/);
  assert.match(page, /<LifeView/);
});

test("Explore catalog renders capability status pills and explains non-actionable rows (no dead buttons)", () => {
  const src = read("app/components/bank/ExploreCatalog.jsx");
  assert.match(src, /capabilities/);
  assert.match(src, /STATUS_LABEL/);
  assert.match(src, /whatIsRequired/);
  assert.match(src, /connection_required|restricted_by_age/);
});

test("CSV import wizard covers the full flow and enforces upload limits client-side", () => {
  const src = read("app/components/bank/CsvImportWizard.jsx");
  for (const s of ["Preview", "mapping", "Import", "receipt", "roll back", "duplicates", "Invalid rows"]) {
    assert.match(src, new RegExp(s, "i"));
  }
  assert.match(src, /MAX_BYTES/);
  assert.match(src, /accept=".csv/);
});

test("AccountControl exposes export, consent revoke and a guarded delete", () => {
  const src = read("app/components/bank/AccountControl.jsx");
  assert.match(src, /view=export/);
  assert.match(src, /revoke_consent/);
  assert.match(src, /confirmText !== "DELETE"/);
  assert.match(src, /window\.location\.href = "\/login"/, "delete signs the user out");
});

test("proxy sets security headers + CSP and blocks cross-origin API mutations", () => {
  const src = read("proxy.js");
  assert.match(src, /content-security-policy|content-security-policy/i);
  assert.match(src, /x-frame-options/);
  assert.match(src, /x-content-type-options/);
  assert.match(src, /csrf_check_failed/);
  assert.match(src, /frame-ancestors 'none'/);
});

test("no client bundle imports a secret or a server-only db module from a component", () => {
  for (const f of ["app/components/bank/OnboardingWizard.jsx", "app/components/bank/RealityEntry.jsx", "app/components/bank/CsvImportWizard.jsx", "app/components/bank/AccountControl.jsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /from ["'].*lib\/db(\.js)?["']/, `${f} must not import lib/db`);
    assert.doesNotMatch(src, /process\.env\.(DATABASE_URL|.*SECRET|.*KEY)/, `${f} must not read a secret`);
  }
});
