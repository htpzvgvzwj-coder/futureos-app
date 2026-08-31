import test from "node:test";
import assert from "node:assert/strict";
import { resolveCapability, resolveAllCapabilities, capabilityIds, CAPABILITY_STATUSES } from "../lib/capability-registry.js";
import { obj, str, num, enumOf, opt, isoDate, arrayOf, parseOr400 } from "../lib/validate.js";
import { parseCsv, guessMapping, normaliseRows, splitDuplicates } from "../lib/csv-import/parse.js";

// ---- Capability Registry -----------------------------------------

test("every capability resolves to one of the allowed statuses; nothing is 'clickable but dead'", () => {
  const all = resolveAllCapabilities({ providers: {}, accountType: "individual" });
  for (const [id, c] of Object.entries(all)) {
    assert.ok(CAPABILITY_STATUSES.includes(c.status), `${id} -> ${c.status}`);
    if (!c.actionable) assert.ok(c.whatIsRequired || c.note, `${id} explains why it is not actionable`);
  }
});

test("Pay is connection_required with no payment provider, live in sandbox; youth accounts are age-restricted", () => {
  assert.equal(resolveCapability("pay", { providers: {} }).status, "connection_required");
  assert.equal(resolveCapability("pay", { providers: { payment_provider: "sandbox" } }).status, "live");
  assert.equal(resolveCapability("transfer", { providers: {} }).status, "live", "internal transfers need no external rail");
  assert.equal(resolveCapability("pay", { accountType: "youth", providers: { payment_provider: "connected" } }).status, "restricted_by_age");
  assert.equal(resolveCapability("investment", { accountType: "guardian_managed_child" }).status, "restricted_by_age");
});

test("investment / insurance / retirement are 'limited' and say they are estimates only", () => {
  for (const id of ["investment", "insurance", "retirement"]) {
    const c = resolveCapability(id, {});
    assert.equal(c.status, "limited");
    assert.match(c.note, /estimate|not (investment advice|guaranteed)|planning information|licensed/i);
  }
});

test("the registry covers all nine Studios + the core bank + account-control capabilities", () => {
  const ids = new Set(capabilityIds());
  for (const need of ["wedding", "home", "emergency", "travel", "investment", "retirement", "loan", "insurance", "family", "accounts", "transactions", "safe_to_spend", "export_data", "delete_account"]) {
    assert.ok(ids.has(need), `registry has ${need}`);
  }
});

// ---- validate.js ------------------------------------------------

test("the schema validator rejects bad bodies with a clear 400 and accepts good ones", () => {
  const S = obj({ amount: num({ min: 0 }), kind: enumOf(["a", "b"]), note: opt(str({ max: 20 })), when: isoDate() });
  const bad = parseOr400(S, { amount: -1, kind: "c", when: "nope" });
  assert.ok(bad.response, "returns a Response");
  assert.equal(bad.response.status, 400);
  const good = parseOr400(S, { amount: 10, kind: "a", note: "", when: "2026-09-01T12:00:00Z" });
  assert.equal(good.response, undefined);
  assert.deepEqual(good.value, { amount: 10, kind: "a", note: null, when: "2026-09-01" });
});

test("unknown fields are rejected unless allowUnknown", () => {
  const S = obj({ a: num() });
  assert.equal(S({ a: 1, b: 2 }).ok, false);
  assert.equal(obj({ a: num() }, { allowUnknown: true })({ a: 1, b: 2 }).ok, true);
  assert.equal(arrayOf(num({ min: 0 }))([1, -2, 3]).errors.length, 1);
});

// ---- CSV import parser ------------------------------------

const HEADER = "Date,Description,Debit,Credit,Currency,Reference";
const CSV = [
  HEADER,
  "01/09/2026,SALARY ACME PTE,,8000.00,SGD,PAY0901",
  "02/09/2026,\"NTUC FAIRPRICE, ORCHARD\",42.55,,SGD,POS123",
  "03/09/2026,GIRO SP UTILITIES,120.00,,SGD,GIRO55",
  "bad-row-no-date,,,,,",
].join("\r\n");

test("parseCsv handles quoted fields, embedded commas and CRLF; guessMapping maps common headers", () => {
  const grid = parseCsv(CSV);
  assert.equal(grid.length, 5);
  assert.equal(grid[2][1], "NTUC FAIRPRICE, ORCHARD", "embedded comma preserved");
  const m = guessMapping(grid[0]);
  assert.equal(m.date, 0);
  assert.equal(m.debit, 2);
  assert.equal(m.credit, 3);
  assert.equal(m.currency, 4);
});

test("normaliseRows produces typed transactions and reports every invalid row instead of aborting", () => {
  const grid = parseCsv(CSV);
  const { transactions, errors, rowCount } = normaliseRows(grid, guessMapping(grid[0]));
  assert.equal(rowCount, 4);
  assert.equal(transactions.length, 3);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /date/);
  const salary = transactions[0];
  assert.equal(salary.direction, "credit");
  assert.equal(salary.amount, 8000);
  assert.equal(salary.date, "2026-09-01");
  assert.equal(transactions[1].direction, "debit");
  assert.equal(transactions[1].amount, 42.55);
  assert.ok(transactions[1].fingerprint.includes("2026-09-02|debit|42.55"));
});

test("splitDuplicates catches a repeated row within a file AND against existing history", () => {
  const grid = parseCsv(CSV + "\r\n01/09/2026,SALARY ACME PTE,,8000.00,SGD,PAY0901");
  const { transactions } = normaliseRows(grid, guessMapping(grid[0]));
  const { fresh, duplicates } = splitDuplicates(transactions);
  assert.equal(duplicates.length, 1, "the repeated salary line is a duplicate");
  assert.equal(fresh.length, 3);

  const existing = new Set([transactions[2].fingerprint]);
  const second = splitDuplicates([transactions[2]], existing);
  assert.equal(second.fresh.length, 0, "already-imported row is skipped");
});
