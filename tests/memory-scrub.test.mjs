import test from "node:test";
import assert from "node:assert/strict";
import { buildMemoryScrub, MEMORY_SCRUB_KEYS } from "../lib/living-plan/memory-scrub.js";

const versions = [
  { version: "1", supersedes_version: null, actor: "system", created_at: "2026-01-01T00:00:00Z", cause: { trigger: "confirm" }, data: { guest_count: 150, venue_tier: "mid_range", monthly_contribution: 600 } },
  { version: "2", supersedes_version: "1", actor: "user", created_at: "2026-02-01T00:00:00Z", cause: { trigger: "peel" }, data: { guest_count: 110, venue_tier: "mid_range", monthly_contribution: 600 } },
  { version: "3", supersedes_version: "2", actor: "user", created_at: "2026-03-01T00:00:00Z", cause: { trigger: "bend" }, data: { guest_count: 110, venue_tier: "budget", monthly_contribution: 800 } },
];
const events = [
  { action_type: "guests_changed", actor: "user", message_key: "wedding.guests", occurred_at: "2026-01-20T00:00:00Z" },
];

test("buildMemoryScrub returns a frame per plan version, in order, with the changed keys at each step", () => {
  const scrub = buildMemoryScrub({ domain: "wedding", planVersions: versions, events });
  assert.equal(scrub.count, 3);
  assert.deepEqual(scrub.frames.map((f) => f.version), ["1", "2", "3"]);
  assert.deepEqual(scrub.frames[0].changedKeys, [], "first frame has nothing before it");
  assert.deepEqual(scrub.frames[1].changedKeys, ["guest_count"]);
  assert.deepEqual(scrub.frames[2].changedKeys.sort(), ["monthly_contribution", "venue_tier"]);
});

test("beforeAfter(index) returns real Before / After state + deltas; an absent field reads as unknown", () => {
  const scrub = buildMemoryScrub({ domain: "wedding", planVersions: versions });
  const ba = scrub.beforeAfter(2);
  assert.equal(ba.before.venue_tier, "mid_range");
  assert.equal(ba.after.venue_tier, "budget");
  assert.equal(ba.deltas.monthly_contribution.before, 600);
  assert.equal(ba.deltas.monthly_contribution.after, 800);

  // a field only some versions carry
  const sparse = buildMemoryScrub({
    domain: "wedding",
    planVersions: [
      { version: "1", actor: "user", created_at: "2026-01-01T00:00:00Z", data: { guest_count: 100 } },
      { version: "2", actor: "user", created_at: "2026-02-01T00:00:00Z", data: { guest_count: 100, total_budget: 20000 } },
    ],
  });
  assert.equal(sparse.beforeAfter(1).deltas.total_budget.before, "unknown");
});

test("latest is the most recent Before/After; the scrub only diffs the domain's tracked keys", () => {
  const scrub = buildMemoryScrub({ domain: "wedding", planVersions: versions });
  assert.equal(scrub.latest.index, 2);
  assert.ok(scrub.keys.every((k) => MEMORY_SCRUB_KEYS.wedding.includes(k)));
  // a non-tracked field never shows up as a change
  const withNoise = buildMemoryScrub({
    domain: "wedding",
    planVersions: [
      { version: "1", actor: "user", created_at: "2026-01-01T00:00:00Z", data: { guest_count: 100, __internal: 1 } },
      { version: "2", actor: "user", created_at: "2026-02-01T00:00:00Z", data: { guest_count: 100, __internal: 999 } },
    ],
  });
  assert.deepEqual(withNoise.frames[1].changedKeys, []);
});
