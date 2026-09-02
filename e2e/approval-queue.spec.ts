import { test, expect } from "@playwright/test";

// Phase 6 Round 2 - the approval queue. On a supervised (youth) account a
// real internal transfer is PARKED as a pending authorization request; it
// only runs after it is approved in Guardian. No conditional skips.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);
const hdr = { origin: BASE, referer: `${BASE}/` };

test("a youth account parks an internal transfer for approval; Guardian approves and it runs", async ({ page }) => {
  const email = `e2e-authz-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: hdr,
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  const ob = (body: unknown) => page.request.post(`${BASE}/api/onboarding`, { data: body, headers: hdr });
  await ob({ action: "set_account_type", accountType: "youth" });
  await ob({ action: "set_consent", scope: "account_data", granted: true });
  await ob({ action: "advance", step: "add_reality" });
  await ob({ action: "advance", step: "first_result" });
  await ob({ action: "advance", step: "complete" });

  // two accounts + salary into the first
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "current", displayName: "Everyday", currency: "SGD" }, headers: hdr });
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "savings", displayName: "Savings", currency: "SGD" }, headers: hdr });
  const accts = await page.request.get(`${BASE}/api/bank/accounts`).then((r) => r.json());
  const from = accts.accounts.find((a: { displayName: string }) => a.displayName === "Everyday").id;
  const to = accts.accounts.find((a: { displayName: string }) => a.displayName === "Savings").id;
  await page.request.post(`${BASE}/api/bank/transactions`, {
    data: { accountId: from, direction: "credit", amount: 5000, channel: "salary" },
    headers: hdr,
  });

  // attempt an internal transfer -> parked, not executed
  const pay = await page.request.post(`${BASE}/api/bank/pay`, {
    data: { type: "internal_transfer", fromAccountId: from, toAccountId: to, amount: 400, idempotencyKey: `e2e-${rid()}` },
    headers: hdr,
  });
  expect(pay.status()).toBe(202);
  const payBody = await pay.json();
  expect(payBody.status).toBe("pending_approval");
  expect(payBody.canMoveMoney).toBe(false);

  // nothing moved
  let txns = await page.request.get(`${BASE}/api/bank/transactions?limit=50`).then((r) => r.json());
  expect(txns.transactions.filter((tx: { isInternalTransfer?: boolean }) => tx.isInternalTransfer).length).toBe(0);

  // Guardian shows it waiting; approve it
  await page.goto(BASE + "/");
  await page.getByTestId("bottom-nav-guardian").click();
  await expect(page.getByText(/Waiting for approval/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/between your own accounts/i)).toBeVisible();
  await page.getByRole("button", { name: /Approve & do it/i }).click();
  await expect(page.getByText(/Nothing is waiting/i)).toBeVisible({ timeout: 15000 });

  // now the transfer has really run
  txns = await page.request.get(`${BASE}/api/bank/transactions?limit=50`).then((r) => r.json());
  expect(txns.transactions.filter((tx: { isInternalTransfer?: boolean }) => tx.isInternalTransfer).length).toBe(2);
});
