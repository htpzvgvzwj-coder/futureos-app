import { test, expect } from "@playwright/test";

// Guardian Phase 2 — the decision loop. A parked money move is shown with
// its before/after impact on Safe-to-Spend before it runs; Continue commits
// it, Guardian Proof records it, and it survives a reload. Honours
// E2E_BASE_URL (used to smoke production).

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);
const hdr = { origin: BASE, referer: `${BASE}/` };

test("Guardian shows a move's impact before it runs, commits it, and records it", async ({ page }) => {
  test.setTimeout(150000);
  const email = `e2e-gdec-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: hdr,
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  const ob = (b: unknown) => page.request.post(`${BASE}/api/onboarding`, { data: b, headers: hdr });
  await ob({ action: "set_account_type", accountType: "youth" });
  await ob({ action: "set_consent", scope: "account_data", granted: true });
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "current", displayName: "Everyday", currency: "SGD" }, headers: hdr });
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "savings", displayName: "Savings", currency: "SGD" }, headers: hdr });
  const accts = (await page.request.get(`${BASE}/api/bank/accounts`).then((r) => r.json())).accounts;
  const from = accts.find((a: { displayName: string }) => a.displayName === "Everyday").id;
  const to = accts.find((a: { displayName: string }) => a.displayName === "Savings").id;
  await page.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: from, direction: "credit", amount: 4000, channel: "salary" }, headers: hdr });
  await ob({ action: "advance", step: "add_reality" });
  await ob({ action: "advance", step: "first_result" });
  await ob({ action: "advance", step: "complete" });

  // a supervised account parks the move
  const pay = await page.request.post(`${BASE}/api/bank/pay`, {
    data: { type: "internal_transfer", fromAccountId: from, toAccountId: to, amount: 300, idempotencyKey: `e2e-${rid()}` },
    headers: hdr,
  });
  expect(pay.status()).toBe(202);

  await page.goto(BASE + "/");
  await page.getByTestId("bottom-nav-guardian").click({ timeout: 25000 });

  // Guardian Now reads Decision; open the decision
  await expect(page.getByText(/^Decision$/)).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /Review this decision/i }).click();

  // the before/after impact is shown, with the honest "between your own accounts" note
  await expect(page.getByText(/Before this runs/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Money you can spend now/i)).toBeVisible();
  await expect(page.getByText(/moves it between your own accounts/i)).toBeVisible();

  // commit it
  await page.getByRole("button", { name: /^Continue$/ }).click();

  // it ran + Guardian Proof records it
  await expect(page.getByText(/Guardian proof/i)).toBeVisible({ timeout: 20000 });
  const txns = await page.request.get(`${BASE}/api/bank/transactions?limit=50`).then((r) => r.json());
  expect(txns.transactions.filter((tx: { isInternalTransfer?: boolean }) => tx.isInternalTransfer).length).toBe(2);

  // persists: no pending decision after a reload
  await page.goto(BASE + "/");
  await page.getByTestId("bottom-nav-guardian").click({ timeout: 25000 });
  await expect(page.getByText(/of \d+ promises protected/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: /Review this decision/i })).toHaveCount(0);
});
