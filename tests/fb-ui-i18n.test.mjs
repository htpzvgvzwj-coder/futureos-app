// The Future Bank UI translator — gettext-style, English string is the key,
// missing key or unknown language falls back to the English literal.

import test from "node:test";
import assert from "node:assert/strict";
import { makeTx, FB_LANGUAGES } from "../lib/i18n/fb-ui.js";

test("en (and unknown languages) return the string unchanged", () => {
  const en = makeTx("en");
  assert.equal(en("Guardian"), "Guardian");
  assert.equal(en("A string with no translation anywhere"), "A string with no translation anywhere");
  const xx = makeTx("xx");
  assert.equal(xx("Guardian"), "Guardian");
});

test("zh translates a known key and falls back for an unknown one", () => {
  const zh = makeTx("zh");
  assert.equal(zh("Guardian"), "守护");
  assert.equal(zh("Life"), "人生");
  assert.equal(zh("this key is definitely not in the dictionary"), "this key is definitely not in the dictionary");
});

test("null / undefined pass through", () => {
  const zh = makeTx("zh");
  assert.equal(zh(null), null);
  assert.equal(zh(undefined), undefined);
});

test("params fill {placeholders} — en uses the key as the template", () => {
  const en = makeTx("en");
  assert.equal(
    en("You're reshaping {node} — nothing is committed until you seal it.", { node: "home" }),
    "You're reshaping home — nothing is committed until you seal it.",
  );
  const zh = makeTx("zh");
  assert.equal(
    zh("You're reshaping {node} — nothing is committed until you seal it.", { node: "home" }),
    "你正在重塑「home」 — 在你确认之前，一切都未落定。",
  );
});

test("a missing param renders empty, not the literal {name}", () => {
  const en = makeTx("en");
  assert.equal(en("About {amount}/month is free to put to work.", {}), "About /month is free to put to work.");
});

test("the four offered languages all build a translator", () => {
  for (const lang of FB_LANGUAGES) {
    const tx = makeTx(lang);
    assert.equal(typeof tx("Today"), "string");
  }
});

test("every dictionary is flat string -> string, no empty values", async () => {
  for (const lang of ["zh", "ms", "ta"]) {
    const dict = (await import(`../lib/i18n/fb-ui.${lang}.json`, { with: { type: "json" } })).default;
    for (const [k, v] of Object.entries(dict)) {
      assert.equal(typeof v, "string", `${lang}: ${k} is not a string`);
      assert.notEqual(v.trim(), "", `${lang}: ${k} is empty`);
    }
  }
});
