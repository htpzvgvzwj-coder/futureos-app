import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Phase 6 Round 3 - real cross-user link. Two people, two browser contexts:
// the owner invites a guardian; the guardian accepts, sees only a health
// view, and approves a parked transfer. Server enforces the link. No skips.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);
const hdr = { origin: BASE, referer: `${BASE}/` };

async function signup(api: APIRequestContext, email: string) {
  const r = await api.post(`${BASE}/api/auth/signup`, { data: { email, password: "test-password-123", displayName: email.split("@")[0] }, headers: hdr });
  expect(r.status(), await r.text()).toBeLessThan(300);
}
async function onboard(api: APIRequestContext, accountType: string) {
  const p = (body: unknown) => api.post(`${BASE}/api/onboarding`, { data: body, headers: hdr });
  await p({ action: "set_account_type", accountType });
  await p({ action: "set_consent", scope: "account_data", granted: true });
  await p({ action: "advance", step: "add_reality" });
  await p({ action: "advance", step: "first_result" });
  await p({ action: "advance", step: "complete" });
}

test("owner invites a guardian; guardian accepts, sees health only, and approves a parked transfer", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const guardianCtx = await browser.newContext();
  const owner: Page = await ownerCtx.newPage();
  const guardian: Page = await guardianCtx.newPage();

  const ownerEmail = `e2e-link-owner-${rid()}@futureos.test`;
  const guardianEmail = `e2e-link-guard-${rid()}@futureos.test`;
  await signup(owner.request, ownerEmail);
  await signup(guardian.request, guardianEmail);
  await onboard(owner.request, "youth");
  await onboard(guardian.request, "individual");

  // owner: a guardian placeholder with approve scope, then an invite code
  const roleRes = await owner.request.post(`${BASE}/api/account`, {
    data: { action: "grant_role", role: "guardian", scope: "approve" },
    headers: hdr,
  });
  const roleId = (await roleRes.json()).role.id;
  const inviteRes = await owner.request.post(`${BASE}/api/care`, { data: { action: "invite", roleId }, headers: hdr });
  const code = (await inviteRes.json()).code as string;
  expect(code).toMatch(/^[A-Z0-9-]{14}$/);

  // owner: two accounts + salary, then a transfer that parks for approval
  await owner.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "current", displayName: "Everyday", currency: "SGD" }, headers: hdr });
  await owner.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "savings", displayName: "Savings", currency: "SGD" }, headers: hdr });
  const accts = (await owner.request.get(`${BASE}/api/bank/accounts`).then((r) => r.json())).accounts;
  const from = accts.find((a: { displayName: string }) => a.displayName === "Everyday").id;
  const to = accts.find((a: { displayName: string }) => a.displayName === "Savings").id;
  await owner.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: from, direction: "credit", amount: 4000, channel: "salary" }, headers: hdr });
  const pay = await owner.request.post(`${BASE}/api/bank/pay`, {
    data: { type: "internal_transfer", fromAccountId: from, toAccountId: to, amount: 250, idempotencyKey: `e2e-${rid()}` },
    headers: hdr,
  });
  expect(pay.status()).toBe(202);

  // guardian: accept the code in the UI
  await guardian.goto(BASE + "/");
  await guardian.getByTestId("bottom-nav-mirror").click();
  await guardian.getByRole("button", { name: /^Family/ }).click();
  await expect(guardian.getByRole("heading", { name: /Family & Care/i })).toBeVisible({ timeout: 15000 });
  await guardian.getByLabel(/Enter their invite code/i).fill(code);
  await guardian.getByRole("button", { name: /Link my account to theirs/i }).click();
  await expect(guardian.getByText(/Linked\./i)).toBeVisible({ timeout: 15000 });

  // guardian: Guardian tab -> People you look after -> Open
  await guardian.getByTestId("bottom-nav-guardian").click();
  await expect(guardian.getByText(/People you look after/i)).toBeVisible({ timeout: 15000 });
  await guardian.getByRole("button", { name: /^Open$/ }).first().click();

  // guardian sees a health view + the pending approval, and approves it
  await expect(guardian.getByText(/Right now/i)).toBeVisible({ timeout: 15000 });
  await expect(guardian.getByText(/They asked you to approve/i)).toBeVisible();
  await expect(guardian.getByText(/between your own accounts/i)).toBeVisible();
  await guardian.getByRole("button", { name: /Approve & do it/i }).click();
  await expect(guardian.getByText(/Nothing right now\./i)).toBeVisible({ timeout: 15000 });

  // owner side: the transfer really ran
  const txns = await owner.request.get(`${BASE}/api/bank/transactions?limit=50`).then((r) => r.json());
  expect(txns.transactions.filter((tx: { isInternalTransfer?: boolean }) => tx.isInternalTransfer).length).toBe(2);

  // the guardian never sees exact amounts in the health view text
  const healthText = await guardian.getByText(/Safe-to-spend/i).locator("xpath=ancestor::*[1]").innerText();
  expect(healthText).not.toMatch(/\d[\d,]{2,}/);

  await ownerCtx.close();
  await guardianCtx.close();
});
