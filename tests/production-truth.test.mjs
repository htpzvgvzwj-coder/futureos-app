import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const rootDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

// ---- 1. no fabricated persona anywhere user-visible --------------------

const LOCALES = ["en", "zh", "ms", "ta"];

test("no 'Karina' (or any fabricated-persona marker) survives in any shipped locale", () => {
  const banned = [/karina/i, /karina-demo/i, /\bsample user\b/i, /placeholder persona/i];
  for (const loc of LOCALES) {
    const src = read(`locales/${loc}.json`);
    for (const re of banned) {
      assert.doesNotMatch(src, re, `locales/${loc}.json still contains ${re}`);
    }
  }
});

test("app/page.jsx ships NO default persona - the empty profile is genuinely empty", () => {
  const src = read("app/page.jsx");
  const block = src.slice(src.indexOf("const defaultProfile = {"), src.indexOf("const defaultProfile = {") + 900);
  // no fabricated identity / finances baked into the default
  for (const marker of ['"27"', '"Married"', "Mid-Level Marketing", '"85000"', '"7500"', '"18000"']) {
    assert.ok(!block.includes(marker), `defaultProfile still hard-codes ${marker}`);
  }
  assert.match(src, /displayName: "",/, "defaultPreferences.displayName is empty (no name)");
  assert.doesNotMatch(src, /displayName: "Karina"/, "no Karina displayName default");
  assert.doesNotMatch(src, /\?\? "Karina"|: "Karina"/, "no Karina fallback in getDisplayName");
  assert.doesNotMatch(src, /karina-demo/, "no karina-demo profile version string");
});

test("the fake profile photo asset and its CSS rule are gone", () => {
  assert.equal(existsSync(new URL("public/karina-profile.png", root)), false, "public/karina-profile.png deleted");
  assert.doesNotMatch(read("app/globals.css"), /karina-profile|\.photoAvatar/, "no karina photo CSS");
});

// ---- 2. the dev-only walkthrough fixture is prod-gated to 404 ----------

test("/api/demo-scenario is gated OFF in production and has no UI entry point", () => {
  const route = read("app/api/demo-scenario/route.js");
  assert.match(route, /process\.env\.NODE_ENV !== "production"/, "route is disabled in production");
  assert.match(route, /FUTUREOS_DEV_FIXTURES === "1"/, "route also needs an explicit dev flag");
  assert.match(route, /status: 404/, "returns 404 when not enabled");
  // no client imports it
  const page = read("app/page.jsx");
  assert.doesNotMatch(page, /\/api\/demo-scenario/, "app/page.jsx has no call to /api/demo-scenario");
});

// ---- 3. test fixtures stay out of the user-visible client bundle ------

test("no test-fixture module is imported from a client component", () => {
  const clientDirs = ["app/components", "app/features"];
  const offenders = [];
  const walk = (dir) => {
    const abs = path.join(rootDir, "..", dir);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        const src = readFileSync(path.join(rootDir, "..", rel), "utf8");
        if (/from\s+["'][^"']*(seed-e2e|demo-scenario|fixtures?\/|synthetic-fixture)/.test(src)) offenders.push(rel);
      }
    }
  };
  clientDirs.forEach(walk);
  assert.deepEqual(offenders, [], `client components importing fixtures: ${offenders.join(", ")}`);
});
