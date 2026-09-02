import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("onboarding owns a navigation-free shell and keeps its next action visible", () => {
  const wizard = read("app/components/bank/OnboardingWizard.jsx");
  const bankCss = read("app/components/bank/bank.module.css");
  const connected = read("app/components/bank/connected.jsx");
  const page = read("app/page.jsx");
  const globalCss = read("app/globals.css");

  assert.match(wizard, /data-onboarding-shell/);
  assert.match(wizard, /Continue to add your reality/);
  assert.match(wizard, /Essential for your bank/);
  assert.match(wizard, /Intelligence you can enable/);
  assert.match(wizard, /People and Guardian/);
  assert.match(bankCss, /\.wizardActionBar\s*\{[^}]*position:\s*sticky/s);
  assert.match(connected, /onGateChange\?\.\(gated\)/);
  assert.match(page, /hideNav=\{onboardingActive\}/);
  assert.match(page, /onGateChange=\{setOnboardingActive\}/);
  assert.match(globalCss, /\.phone\.nav-hidden \.screenArea/);
  assert.match(globalCss, /grid-template-columns:\s*repeat\(4,/);
});

test("the controlled Life entrance has one navigation, no visible debug transcript, and no one-frame scrubber", () => {
  const surface = read("app/components/living-thread/LivingThreadSurface.jsx");
  const accessible = read("app/components/living-thread/ThreadAccessibleView.jsx");
  const scrubber = read("app/components/living-thread/ThreadMemoryScrubber.jsx");

  assert.match(surface, /lensProp == null \?/,
    "the internal lens tabs render only for a standalone, uncontrolled surface");
  assert.match(surface, /What is moving/);
  assert.match(surface, /What you can do next/);
  assert.match(accessible, /styles\.visuallyHidden/,
    "the structured accessibility transcript must not become customer-facing debug copy");
  assert.match(scrubber, /frames\.length < 2/,
    "one event is not enough to render a meaningful history scrubber");
});

test("a Home preview never calls proposed money committed and Guardian does not duplicate its decision", () => {
  const receipt = read("app/components/future-bank/ChangeReceipt.jsx");
  const slice = read("app/showcase/FutureBankSlice.jsx");

  assert.match(receipt, /committed \? `\$\{monthly\(monthlyAdded\)\} more committed` : `\$\{monthly\(monthlyAdded\)\} proposed monthly pressure`/);
  assert.match(slice, /committed=\{false\}/);
  assert.match(slice, /possible monthly plan load/);
  assert.match(slice, /watch\.filter\(\(m\) => m\.id !== decision\.id\)/);
  assert.match(slice, /decision=\{currentDecision\}/);
});
