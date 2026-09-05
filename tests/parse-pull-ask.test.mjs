// "Try a change" free-text box — a typed request should move the same
// slider a drag does, correctly, for every pullable node's unit.

import test from "node:test";
import assert from "node:assert/strict";
import { parsePullAsk } from "../lib/life/parse-pull-ask.js";

const shiftSpec = { unit: "months_shift", sliderMin: -36, sliderMax: 36 };
const cushionSpec = { unit: "months_cushion", sliderMin: 2, sliderMax: 12 };
const moneySpec = { unit: "sgd_per_month", sliderMin: 0, sliderMax: 3000 };
const ageSpec = { unit: "age", sliderMin: 55, sliderMax: 70 };

test("months_shift: sooner/later phrasing, months and years", () => {
  assert.equal(parsePullAsk("6 months sooner", shiftSpec), -6);
  assert.equal(parsePullAsk("Hold the day 3 months later", shiftSpec), 3);
  assert.equal(parsePullAsk("1 year sooner", shiftSpec), -12);
  assert.equal(parsePullAsk("2 years later", shiftSpec), 24);
});

test("months_shift: no-digit phrasing (\"a year sooner\", \"a month later\")", () => {
  assert.equal(parsePullAsk("a year sooner", shiftSpec), -12);
  assert.equal(parsePullAsk("a month later", shiftSpec), 1);
});

test("months_shift: a bare signed number is taken as months", () => {
  assert.equal(parsePullAsk("-9", shiftSpec), -9);
  assert.equal(parsePullAsk("+12", shiftSpec), 12);
});

test("months_shift: clamps to the slider's own range", () => {
  assert.equal(parsePullAsk("100 months later", shiftSpec), 36);
  assert.equal(parsePullAsk("100 months sooner", shiftSpec), -36);
});

test("months_cushion: a plain number of months", () => {
  assert.equal(parsePullAsk("aim for 8 months of cushion", cushionSpec), 8);
  assert.equal(parsePullAsk("15", cushionSpec), 12, "clamped to sliderMax");
});

test("sgd_per_month: a dollar amount, with k-suffix support", () => {
  assert.equal(parsePullAsk("invest SGD 500 a month", moneySpec), 500);
  assert.equal(parsePullAsk("2k", moneySpec), 2000);
  assert.equal(parsePullAsk("SGD 1,200", moneySpec), 1200);
});

test("age: a plain number", () => {
  assert.equal(parsePullAsk("retire at 60", ageSpec), 60);
  assert.equal(parsePullAsk("50", ageSpec), 55, "clamped to sliderMin");
});

test("unparseable or empty input returns null, never a guess", () => {
  assert.equal(parsePullAsk("", shiftSpec), null);
  assert.equal(parsePullAsk("   ", moneySpec), null);
  assert.equal(parsePullAsk("please help", ageSpec), null);
  assert.equal(parsePullAsk("6 months sooner", null), null, "no spec yet");
});
