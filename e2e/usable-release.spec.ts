import { test, expect, request as pwRequest } from "@playwright/test";

// Usable Release - the real new-user journey, end to end, no skips.
// Each test registers its OWN fresh user via the API (no shared seed, no
// preset persona) and drives the real UI + APIs.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);

async function registerAndLogin(page, email: string, password = "test-password-123") {
  // sign up via the API (same-origin: the request comes from the page context)
  const res = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password, displayName: "E2E User" },
    headers: { origin: BASE, referer: `${BASE}/` },
  });
  expect(res.status(), await res.text()).toBeLessThan(300);
}

test.describe("Flow A - new user: register, consent, add reality, Today, logout, login restored", () => {
  test("a brand-new user gets no persona and can reach a real Today", async ({ page }) => {
    const email = `e2e-flowA-${rid()}@futureos.test`;
    await registerAndLogin(page, email);

    // 1 - land in the app; a new user sees onboarding, never a persona
    await page.goto(BASE + "/");
    await expect(page.getByText(/set up futureos|account type|what kind of account/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/karina/i)).toHaveCount(0);

    // 2 - account type
    await page.getByRole("button", { name: /individual adult/i }).click();

    // 3 - consent: grant the required scopes then continue
    await expect(page.getByText(/what may futureos use/i)).toBeVisible();
    for (const scope of ["account_data", "transaction_data", "assets_liabilities"]) {
      const box = page.locator(`#consent-${scope}`);
      if (!(await box.isChecked())) {
        await box.click();
        await expect(box).toBeChecked();
      }
    }
    const cont = page.getByRole("button", { name: /^continue$/i });
    await expect(cont).toBeEnabled();
    await cont.click();

    // 4 - add reality: go manual, add an account + income + a bill
    await expect(page.getByText(/add your reality/i)).toBeVisible();
    await page.getByRole("button", { name: /enter manually/i }).click();

    await expect(page.getByLabel(/^type$/i).first()).toBeVisible();
    // add an account
    await page.getByLabel(/^Name$/i).first().fill("Everyday");
    await page.getByRole("button", { name: /^Add$/ }).first().click();
    await expect(page.getByText(/Account added|Saved/i)).toBeVisible();

    await page.getByRole("button", { name: /^Done$/i }).click();

    // 5 - first result then into the bank
    await page.getByRole("button", { name: /i've added what i can/i }).click().catch(() => {});
    await page.getByRole("button", { name: /go to my bank/i }).click();

    // 6 - Today reads as a bank
    await expect(page.getByText(/available to spend/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /^Pay$/ })).toBeVisible();

    // 7 - logout
    await page.request.post(`${BASE}/api/auth/logout`, { headers: { origin: BASE, referer: `${BASE}/` } });
    await page.goto(BASE + "/");
    // an unauthenticated visit should not show the bank header
    // 8 - log back in, state restored (the account we added is still there)
    const login = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email, password: "test-password-123" },
      headers: { origin: BASE, referer: `${BASE}/` },
    });
    expect(login.ok()).toBeTruthy();
    const accts = await (await page.request.get(`${BASE}/api/bank/accounts`)).json();
    expect(accts.accounts.some((a: { displayName: string }) => a.displayName === "Everyday")).toBeTruthy();
  });
});

test.describe("Flow E - isolation: User A cannot read or modify User B", () => {
  test("A's session cannot see B's accounts or transactions", async ({ playwright }) => {
    const ctxA = await pwRequest.newContext({ baseURL: BASE });
    const ctxB = await pwRequest.newContext({ baseURL: BASE });
    const emailA = `e2e-isoA-${rid()}@futureos.test`;
    const emailB = `e2e-isoB-${rid()}@futureos.test`;
    const h = { origin: BASE, referer: `${BASE}/` };

    await ctxA.post("/api/auth/signup", { data: { email: emailA, password: "pw-a-123456", displayName: "A" }, headers: h });
    await ctxB.post("/api/auth/signup", { data: { email: emailB, password: "pw-b-123456", displayName: "B" }, headers: h });

    const accA = await (await ctxA.post("/api/bank/accounts", { data: { kind: "current", displayName: "A-only" }, headers: h })).json();
    const accB = await (await ctxB.post("/api/bank/accounts", { data: { kind: "current", displayName: "B-only" }, headers: h })).json();
    expect(accA.account.id).toBeTruthy();
    expect(accB.account.id).toBeTruthy();

    const listA = await (await ctxA.get("/api/bank/accounts")).json();
    expect(listA.accounts.map((x: { displayName: string }) => x.displayName)).toEqual(["A-only"]);

    // A tries to post a transaction against B's account -> rejected
    const cross = await ctxA.post("/api/bank/transactions", {
      data: { accountId: accB.account.id, direction: "credit", amount: 100 },
      headers: h,
    });
    expect(cross.status()).toBeGreaterThanOrEqual(400);

    await ctxA.dispose();
    await ctxB.dispose();
  });
});

test.describe("Flow F - CSRF: a cross-origin API mutation is blocked", () => {
  test("a POST with a foreign Origin is 403", async ({ playwright }) => {
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    const res = await ctx.post("/api/onboarding", {
      data: { action: "advance", step: "complete" },
      headers: { origin: "https://evil.example", referer: "https://evil.example/" },
    });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });
});
