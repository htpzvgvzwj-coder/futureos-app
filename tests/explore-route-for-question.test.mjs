// Explore's hero ("Try a future before you commit") promises to test ANY
// free-text question the user types. Regression: routeForQuestion used to
// divert spend/afford-shaped questions with no detected domain straight to
// the Financial Twin ("twin") instead of Future Field -- reported live:
// "Is it safe to spend $500 now?" opened the Twin, not a test. Every case
// here must resolve to a future_field:<domain>:ask:<...> route, never
// anything else.

import test from "node:test";
import assert from "node:assert/strict";
import { domainForQuestion, routeForQuestion } from "../lib/explore/route-for-question.js";

function assertOpensFutureField(question, expectedDomain) {
  const route = routeForQuestion(question);
  assert.match(route, /^future_field:/, `"${question}" must open Future Field, got: ${route}`);
  if (expectedDomain) {
    assert.equal(route.split(":")[1], expectedDomain, `"${question}" should target domain "${expectedDomain}"`);
  }
  assert.ok(route.includes(encodeURIComponent(question)), "the original text is carried through for the peel form");
}

test("regression: spend/afford-shaped questions with no detected domain no longer divert to the Financial Twin", () => {
  assertOpensFutureField("Is it safe to spend $500 now?", "home");
  assertOpensFutureField("Can I afford this?", "home");
  assertOpensFutureField("How much can I spend safely?", "home");
  assertOpensFutureField("Can I afford a vacation?", "travel"); // domain still wins when detectable
});

test("every domain keyword routes to its own Future Field", () => {
  assertOpensFutureField("Can we afford the wedding we want?", "wedding");
  assertOpensFutureField("What if I pay off my loan faster?", "loan");
  assertOpensFutureField("Can I buy a home sooner?", "home");
  assertOpensFutureField("What income gap am I creating in retirement?", "retirement");
  assertOpensFutureField("Can this trip fit without regret?", "travel");
  assertOpensFutureField("What money can safely leave cash to invest?", "investment");
  assertOpensFutureField("What would still be uncovered by insurance?", "insurance");
  assertOpensFutureField("How many months can I survive an emergency?", "emergency");
  assertOpensFutureField("What can we share with family without exposing everything?", "family");
});

test("regression: an unrecognised question defaults to the account's own active domain, not a hardcoded Home dead-end", () => {
  // Reported live: an account with no confirmed Home plan got dumped on
  // "You do not have a confirmed home plan yet" no matter what was typed,
  // because the fallback domain was hardcoded to "home".
  assert.equal(routeForQuestion("asdkjfh random text", "wedding").split(":")[1], "wedding");
  assert.equal(routeForQuestion("", "retirement").split(":")[1], "retirement");
  // still defaults to home when the caller has no active domain to suggest
  assert.equal(routeForQuestion("asdkjfh random text").split(":")[1], "home");
  assert.equal(routeForQuestion("asdkjfh random text", null).split(":")[1], "home");
});

test("an empty or unrecognisable question still opens Future Field, defaulting to Home", () => {
  assertOpensFutureField("asdkjfh random text", "home");
  assert.match(routeForQuestion(""), /^future_field:home:/);
});

test("domainForQuestion returns null (not a guess) when nothing matches", () => {
  assert.equal(domainForQuestion("asdkjfh random text"), null);
  assert.equal(domainForQuestion(""), null);
  assert.equal(domainForQuestion(null), null);
});

test("routeForQuestion never returns a bare 'twin' or any non-future_field route", () => {
  const probes = [
    "Is it safe to spend $500 now?", "Can I afford this?", "afford", "spend", "can i",
    "safe to spend a lot", "What can I safely spend", "", "random gibberish",
  ];
  for (const q of probes) {
    assert.match(routeForQuestion(q), /^future_field:/, `probe "${q}" leaked a non-future_field route`);
  }
});
