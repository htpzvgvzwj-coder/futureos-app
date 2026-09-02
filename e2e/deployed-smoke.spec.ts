import { test, expect } from "@playwright/test";

// Smoke test against the DEPLOYED Vercel preview (not localhost).
const U = process.env.DEPLOY_URL ?? "https://futureos-app-56qz-ilb5ya958-m5tc6mj8tn-2268s-projects.vercel.app";

test("deployed /showcase: register a fresh user, reach Today with a real number", async ({ page }) => {
  const email = `deploy-smoke-${Date.now()}@futureos.test`;
  const H = { origin: U, referer: `${U}/` };

  const signup = await page.request.post(`${U}/api/auth/signup`, { data: { email, password: "smoke-pass-1", displayName: "Smoke" }, headers: H });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  await page.goto(`${U}/showcase`);
  await expect(page.getByRole("heading", { name: /how future bank works/i })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/karina/i)).toHaveCount(0);
  await page.screenshot({ path: "screenshots/deployed-1-welcome.png", fullPage: true });

  await page.getByRole("button", { name: /set up my money picture/i }).click();
  await page.getByRole("button", { name: /add one account manually/i }).click();
  await page.getByLabel(/^Name$/i).first().fill("Everyday");
  await page.getByRole("button", { name: /^Add$/ }).first().click();
  await expect(page.getByText(/Account added|Saved/i)).toBeVisible();

  const accts = await (await page.request.get(`${U}/api/bank/accounts`)).json();
  const acctId = accts.accounts?.[0]?.id;
  expect(acctId).toBeTruthy();
  await page.request.post(`${U}/api/bank/transactions`, { data: { accountId: acctId, direction: "credit", amount: 8000, channel: "salary", merchant: "ACME Pte Ltd" }, headers: H });
  await page.request.post(`${U}/api/bank/transactions`, { data: { accountId: acctId, direction: "debit", amount: 1850, category: "housing", merchant: "Landlord GIRO" }, headers: H });

  await page.getByRole("button", { name: /^Done$/i }).click();
  await expect(page.getByRole("heading", { name: /^today$/i })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/SGD 6,150/)).toBeVisible(); // 8000 - 1850
  await page.screenshot({ path: "screenshots/deployed-2-today.png", fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
