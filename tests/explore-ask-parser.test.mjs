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
