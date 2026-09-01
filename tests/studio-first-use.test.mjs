import test from "node:test";
import assert from "node:assert/strict";
import { parseMoneyInput, formatMoney, midpointOfRange } from "../lib/money-input.js";
import { STUDIO_ENTRY, ENTRY_DOMAINS, getEntryRequirements, buildSeedPatch } from "../lib/living-scene/studio-entry-requirements.js";

// ---- money input -------------------------------------------------

test("parseMoneyInput accepts what real people type; rejects garbage with an app error, not a browser bubble", () => {
  assert.deepEqual(parseMoneyInput("1000"), { ok: true, value: 1000 });
  assert.deepEqual(parseMoneyInput("1,000"), { ok: true, value: 1000 });
  assert.deepEqual(parseMoneyInput("SGD 1,000"), { ok: true, value: 1000 });
  assert.deepEqual(parseMoneyInput("$1,000.50"), { ok: true, value: 1000.5 });
  assert.deepEqual(parseMoneyInput("1.5k"), { ok: true, value: 1500 });
  const bad = parseMoneyInput("abc");
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Enter an amount such as 1,000/);
  assert.equal(parseMoneyInput("").ok, false);
  assert.equal(parseMoneyInput("-5").ok, false);
  assert.equal(parseMoneyInput("0", { allowZero: false }).ok, false);
  assert.equal(parseMoneyInput("50", { min: 100 }).ok, false);
});

test("formatMoney + midpointOfRange", () => {
  assert.equal(formatMoney(1000), "1,000");
  assert.equal(formatMoney(1234567), "1,234,567");
  assert.deepEqual(midpointOfRange("400k-600k"), { value: 500000, low: 400000, high: 600000 });
  assert.deepEqual(midpointOfRange("under-3k"), { value: 2100, low: 0, high: 3000 });
  assert.deepEqual(midpointOfRange("over-50k"), { value: 65000, low: 50000, high: null });
  assert.deepEqual(midpointOfRange("900k-1.4m"), { value: 1150000, low: 900000, high: 1400000 });
});

// ---- entry requirements registry ---------------------------

test("all nine Studios have entry requirements: title, why, 2-3 low-friction questions, a first result", () => {
  assert.deepEqual(ENTRY_DOMAINS.sort(), ["emergency", "family", "home", "insurance", "investment", "loan", "retirement", "travel", "wedding"]);
  for (const domain of ENTRY_DOMAINS) {
    const r = getEntryRequirements(domain);
    assert.ok(r.title && r.title.length > 8, `${domain} has a title`);
    assert.ok(r.why && r.why.length > 15, `${domain} explains why the bank needs it`);
    assert.ok(r.firstResult, `${domain} states its first visible result`);
    assert.ok(r.questions.length >= 2 && r.questions.length <= 3, `${domain} asks 2-3 questions (${r.questions.length})`);
    for (const q of r.questions) {
      assert.ok(["range_chips", "cards", "month", "slider", "count"].includes(q.kind), `${domain}.${q.id} uses a low-friction control (${q.kind})`);
      assert.ok(q.field, `${domain}.${q.id} maps to a plan field`);
      if (q.kind === "range_chips" || q.kind === "cards") assert.ok(q.options.length >= 2);
    }
  }
});

test("investment / insurance carry an honest 'not advice / not a quote' disclaimer", () => {
  assert.match(STUDIO_ENTRY.investment.disclaimer, /not investment advice|education/i);
  assert.match(STUDIO_ENTRY.insurance.disclaimer, /not a quote|licensed provider/i);
});

// ---- buildSeedPatch: answers -> plan patch + provenance ----

test("confirmed mode: a range chip becomes a midpoint value tagged user_range; a missing answer is reported", () => {
  const { patch, provenance, missing } = buildSeedPatch("home", { price_band: "400k-600k" }, { mode: "confirmed" });
  assert.equal(patch.estimated_price, 500000);
  assert.equal(provenance.estimated_price, "user_range");
  assert.deepEqual(patch["estimated_price__range"], { low: 400000, high: 600000 });
  assert.ok(missing.includes("property_type"));
  assert.ok(missing.includes("target_month"));
});

test("estimate mode: missing answers get neutral defaults tagged system_estimate; nothing is left blank", () => {
  const { patch, provenance, missing } = buildSeedPatch("emergency", {}, { mode: "estimate" });
  assert.equal(missing.length, 0, "estimate mode never blocks on missing answers");
  assert.ok(Object.keys(patch).length > 0);
  for (const p of Object.values(provenance)) assert.equal(p, "system_estimate");
});

test("exact amounts always override with user_confirmed provenance", () => {
  const { patch, provenance } = buildSeedPatch(
    "home",
    { price_band: "400k-600k", property_type: "hdb_resale", target_month: "2029-01" },
    { exactAmounts: { current_savings: 90000 }, mode: "confirmed" },
  );
  assert.equal(patch.current_savings, 90000);
  assert.equal(provenance.current_savings, "user_confirmed");
  assert.equal(patch.property_type, "hdb_resale");
  assert.equal(patch.target_complete_month, "2029-01");
});

// ---- the API route + component wiring exist (no browser) ---

import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");

test("GET /api/future-field returns entry requirements (not just no_confirmed_plan) when there's no path", () => {
  const src = read("app/api/future-field/route.js");
  assert.match(src, /loadSeededPath/);
  assert.match(src, /entryRequirements: getEntryRequirements\(domain\)/);
  assert.match(src, /reason: "needs_first_path"/);
  assert.doesNotMatch(src, /reason: "no_confirmed_plan"/);
});

test("the StudioEntryBridge is a real form, never a static dead end", () => {
  const src = read("app/components/living-scene/StudioEntryBridge.jsx");
  assert.match(src, /future-field\/seed/);
  assert.match(src, /parseMoneyInput/);
  assert.match(src, /Not sure yet/);
  assert.match(src, /Show my first path/);
  assert.doesNotMatch(src, /type="number"/, "no raw number input -> no browser 'enter a real number' bubble");
});

test("the Future Bank slice drives real APIs, has the Money Current + Change Receipt, no fake data", () => {
  const src = read("app/showcase/FutureBankSlice.jsx");
  assert.match(src, /Your money has a present\. It also has a direction\./, "branded welcome");
  assert.match(src, /Available to spend/);
  assert.match(src, /\/api\/financial-twin/);
  assert.match(src, /\/api\/future-field\/seed/);
  assert.match(src, /\/api\/bank\/accounts/, "Money Snapshot creates a real account");
  assert.match(src, /MoneyCurrentRipple/, "the change receipt is a Money Current ripple");
  assert.doesNotMatch(src, /defaultProfile|karina|restoreMockData/i, "no fake data source");

  const mc = read("app/showcase/MoneyCurrent.jsx");
  assert.match(mc, /Now\s+→\s+next bill\s+→\s+next income/i, "the signature current shape");
  assert.match(mc, /buildCurrentNodes/);

  // legacy `exceeds_regulatory_ceiling` must not reach the user
  assert.doesNotMatch(src, /exceeds_regulatory_ceiling["'`]/, "raw internal reason is not shown");
  assert.match(src, /needs a later target, a lower price, or more monthly room/, "human copy for the seal block");

  const page = read("app/showcase/page.jsx");
  assert.match(page, /FutureBankSlice/);
});
