// End-to-end Change Ledger smoke test against the real Neon DB.
// Run: node --env-file=.env _smoke_change_ledger.mjs
// Uses a throwaway profile_key (not a real user) and deletes everything at the end.
import crypto from "node:crypto";
import { recordEvent, recordEventSafe, listEvents, getEvent } from "./lib/change-ledger/store.js";
import { buildHomeCommitmentCreatedEvent, buildHomeCommitmentRevokedEvent } from "./lib/change-ledger/producers/home.js";
import { formatEvent } from "./lib/change-ledger/format.js";
import en from "./locales/en.json" with { type: "json" };
import zh from "./locales/zh.json" with { type: "json" };
import { pool } from "./lib/db.js";

const t = (dict) => (key, params = {}) => {
  const v = key.split(".").reduce((a, s) => (a == null ? a : a[s]), dict);
  return String(v == null ? key : v).replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : params[k]));
};
const tEN = t(en);
const tZH = t(zh);

const COMMIT_ID = crypto.randomUUID();
const PK = `smoke-cl-${Date.now()}`;
let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${extra}`); }
}

try {
  console.log(`profile_key = ${PK}\n`);

  const createDraft = buildHomeCommitmentCreatedEvent({
    profileKey: PK, commitmentId: COMMIT_ID,
    priorMonthlyContribution: 900, newMonthlyContribution: 1300,
    effectiveMonth: "2026-10", readyMonthBefore: "2031-02", readyMonthAfter: "2030-08",
    monthsDelta: -6, reasonCode: "behind_pace", reasonParams: {}, emergencyFloorMonths: 6,
  });
  const r1 = await recordEvent(createDraft);
  check("create returns a row", !!r1.event?.id);
  check("create is not a duplicate", r1.duplicate === false);
  check("create status = scheduled", r1.event.status === "scheduled");
  check("create impact_set has the monthly + date deltas", Array.isArray(r1.event.impact_set) && r1.event.impact_set.length === 2);

  const r1b = await recordEvent(createDraft);
  check("re-record same dedupe_key -> duplicate:true", r1b.duplicate === true);
  check("duplicate returns the same row id", r1b.event.id === r1.event.id);

  const revokeDraft = buildHomeCommitmentRevokedEvent({
    profileKey: PK, commitmentId: COMMIT_ID,
    supersedesEventId: r1.event.id, restoredMonthlyContribution: 900, adjustedMonthlyContribution: 1300,
  });
  const r2 = await recordEvent(revokeDraft);
  check("revoke row created", !!r2.event?.id);
  check("revoke.supersedes_event_id points at create", r2.event.supersedes_event_id === r1.event.id);
  check("revoke status = revoked", r2.event.status === "revoked");

  let threw = null;
  try { await recordEvent({ ...createDraft, actor: "nobody", dedupeKey: `${PK}:bad` }); } catch (e) { threw = e; }
  check("invalid draft throws INVALID_LEDGER_EVENT", threw?.code === "INVALID_LEDGER_EVENT", threw?.message ?? "");
  check("recordEventSafe swallows the invalid draft", (await recordEventSafe({ ...createDraft, actor: "nobody", dedupeKey: `${PK}:bad2` })) === null);

  const r3 = await recordEvent({
    profileKey: PK, actor: "user", sourceFeature: "wedding", actionType: "joint_confirmed", status: "scheduled",
    visibility: "shared", relatedGoalIds: ["wedding"],
    cause: { trigger: "smoke" },
    beforeSnapshot: { monthlyIncome: 8200, currentSavings: 40000, jointMonthlyContribution: 900 },
    afterSnapshot: { jointMonthlyContribution: 1050 },
    impactSet: [{ goalId: "wedding", metric: "monthlyContribution", before: 900, after: 1050, delta: 150, unit: "sgd_per_month", direction: "up" }],
    confidence: "high", messageKey: "changeLedger.event.savings_plan_confirmed.headline", messageParams: { domain: "wedding", amount: 1050 },
    dedupeKey: `${PK}:shared`,
  });
  const storedShared = await getEvent(r3.event.id, PK);
  check("shared: monthlyIncome redacted", storedShared.before_snapshot.monthlyIncome === "[redacted]");
  check("shared: currentSavings redacted", storedShared.before_snapshot.currentSavings === "[redacted]");
  check("shared: agreed joint contribution preserved", storedShared.before_snapshot.jointMonthlyContribution === 900);

  const all = await listEvents(PK, { filter: "all" });
  check("listEvents(all) returns 3 events", all.length === 3, `got ${all.length}`);
  check("listEvents newest-first", new Date(all[0].occurred_at) >= new Date(all[all.length - 1].occurred_at));
  check("filter=mine keeps only actor=user", (await listEvents(PK, { filter: "mine" })).every((e) => e.actor === "user"));
  check("filter=guardian is empty here", (await listEvents(PK, { filter: "guardian" })).length === 0);
  check("filter=shared returns the 1 shared event", (await listEvents(PK, { filter: "shared" })).length === 1);

  const recent = await listEvents(PK, { filter: "all", limit: 250 });
  const supersededBy = recent.find((e) => e.supersedes_event_id === r1.event.id) ?? null;
  check("create event is superseded by the revoke", supersededBy?.id === r2.event.id);
  check("create event no longer in effect", (!supersededBy && r1.event.status !== "revoked") === false);

  const createRow = await getEvent(r1.event.id, PK);
  const fEN = formatEvent(createRow, tEN);
  const fZH = formatEvent(createRow, tZH);
  check("EN headline rendered (not a raw key)", fEN.headline.includes("1300") && !fEN.headline.startsWith("changeLedger."));
  check("ZH headline rendered", fZH.headline.includes("1300") && fZH.headline !== fEN.headline);
  check("EN truthfulness label present", /Scheduled/.test(fEN.statusLabel));
  check("isActual = false for scheduled", fEN.isActual === false);
  check("impact lines rendered <=3", fEN.impactLines.length >= 1 && fEN.impactLines.length <= 3);
  check("revoke formats with 'revoked' truthfulness", formatEvent(await getEvent(r2.event.id, PK), tEN).truthfulnessKey === "revoked");

  console.log("\n--- sample rendered entry (EN) ---");
  console.log(fEN.headline);
  fEN.impactLines.forEach((l) => console.log("  •", l.text));
  console.log("  [" + fEN.statusLabel + "]");
} finally {
  const del = await pool.query(`delete from change_ledger_events where profile_key = $1`, [PK]);
  console.log(`\ncleanup: deleted ${del.rowCount} rows for ${PK}`);
  await pool.end();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
