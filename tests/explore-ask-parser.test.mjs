import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAsk } from "../lib/explore/ask-parser.js";

test("'buy home 6 months sooner' shifts the ready month field negative", () => {
  const r = parseAsk("buy home 6 months sooner", "home");
  assert.equal(r.field, "target_complete_month");
  assert.equal(r.shiftMonths, -6);
});

test("'push the wedding back a year' shifts the wedding date field positive by 12", () => {
  const r = parseAsk("push the wedding back a year", "wedding");
  assert.equal(r.field, "wedding_date");
  assert.equal(r.shiftMonths, 12);
});

test("a bare number with no timing word maps to the domain's money field", () => {
  const r = parseAsk("what if the price was 550000", "home");
  assert.equal(r.field, "estimated_price");
  assert.equal(r.value, 550000);
});

test("'invest 2k a month' resolves the investment's monthly field with k-suffix parsing", () => {
  const r = parseAsk("invest 2k a month", "investment");
  assert.equal(r.field, "monthly_commitment");
  assert.equal(r.value, 2000);
});

test("'100 guests' maps to guest_count for wedding", () => {
  const r = parseAsk("what about 100 guests", "wedding");
  assert.equal(r.field, "guest_count");
  assert.equal(r.value, 100);
});

test("no timing word defaults sooner/later shift to 6 months", () => {
  const r = parseAsk("sooner", "home");
  assert.equal(r.shiftMonths, -6);
});

test("empty or too-short text returns null", () => {
  assert.equal(parseAsk("", "home"), null);
  assert.equal(parseAsk("hi", "home"), null);
});

test("unknown domain falls back to home's fields", () => {
  const r = parseAsk("buy it sooner", "not_a_real_domain");
  assert.equal(r.field, "target_complete_month");
});

// Reported live: "buy a condo in Bugis" did nothing at all -- no field,
// no value, no acknowledgement of "condo" or "Bugis". property_type is
// now a real "select" field so this resolves to a genuine plan value
// (registry.js's real enum), with the area name preserved in the label
// for display even though there's no schema field for it.
test("'buy a condo in Bugis' resolves property_type to the real enum value 'private'", () => {
  const r = parseAsk("buy a condo in Bugis", "home");
  assert.equal(r.field, "property_type");
  assert.equal(r.kind, "select");
  assert.equal(r.value, "private");
  assert.match(r.label, /Bugis/, "the area name is preserved for display even with no schema field for it");
});

test("property_type recognises HDB, BTO, EC and landed too", () => {
  assert.equal(parseAsk("looking at an HDB resale flat", "home").value, "hdb_resale");
  assert.equal(parseAsk("apply for a BTO", "home").value, "hdb_new");
  assert.equal(parseAsk("thinking about an executive condo", "home").value, "ec_new");
  assert.equal(parseAsk("maybe a landed house in Bukit Timah", "home").value, "private");
});

test("property_type doesn't hijack an unrelated numeric ask", () => {
  const r = parseAsk("put aside 500 a month", "home");
  assert.equal(r.field, "monthly_contribution");
  assert.equal(r.value, 500);
});

// Regression: a real, serious incident. "can i Buy $150000 car" has no
// wedding keyword anywhere, but the domain fallback silently set
// guest_count to 150,000, and peel-always-auto-activates (by design) made
// that the wedding plan's LIVE, real, active state -- no confirmation
// step ever shown a value that could be sanity-checked. A number must
// never target a field whose own keyword isn't actually in the text.
test("regression: a bare unrelated number targets NO field at all, never a guessed one", () => {
  assert.equal(parseAsk("can i Buy $150000 car", "wedding"), null);
  assert.equal(parseAsk("can i Buy $150000 car", "home"), null);
  assert.equal(parseAsk("random thing costing 5000 dollars", "retirement"), null);
});
