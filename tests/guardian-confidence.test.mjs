import { test } from "node:test";
import assert from "node:assert/strict";
import { guardianBlindSpots } from "../lib/guardian/confidence.js";

test("guardianBlindSpots: every disconnected provider surfaces a concrete consequence", () => {
  const r = guardianBlindSpots({
    connections: [
      { id: "sgfindex", name: "SGFinDex (government)", connected: false },
      { id: "insurer", name: "Insurer link", connected: true },
      { id: "payment_provider", name: "Payment rail", connected: false },
    ],
  });
  assert.equal(r.gaps.length, 2);
  assert.equal(r.gaps[0].provider, "sgfindex");
  assert.match(r.gaps[0].textKey, /CPF/);
  assert.equal(r.gaps[1].provider, "payment_provider");
  assert.match(r.gaps[1].textKey, /leaves your own accounts/);
});

test("guardianBlindSpots: nothing to report once everything is connected", () => {
  const r = guardianBlindSpots({
    connections: [
      { id: "sgfindex", connected: true },
      { id: "insurer", connected: true },
      { id: "payment_provider", connected: true },
    ],
  });
  assert.equal(r.gaps.length, 0);
});

test("guardianBlindSpots: tolerates missing/empty input", () => {
  assert.equal(guardianBlindSpots({}).gaps.length, 0);
  assert.equal(guardianBlindSpots().gaps.length, 0);
});
