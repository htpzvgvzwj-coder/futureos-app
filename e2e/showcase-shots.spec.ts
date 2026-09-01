import { test, expect } from "@playwright/test";
import fs from "node:fs";

// Captures the five review screenshots of the /showcase Future Bank slice
// + a 320px mobile shot. Registers its own fresh user (no seed, no persona).

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });
const rid = () => Math.random().toString(36).slice(2, 9);
const H = { origin: BASE, referer: `${BASE}/` };

async function freshUser(page) {
  const email = `shot-${rid()}@futureos.test`;
  const r = await page.request.post(`${BASE}/api/auth/signup`, { data: { email, password: "shot-password-1", displayName: "Preview" }, headers: H });
  expect(r.ok(), await r.text()).toBeTruthy();
  return email;
}

async function runFlow(page, { mobile = false } = {}) {
  await freshUser(page);
  const tag = mobile ? "mobile320-" : "";

  // 1 - Welcome
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByRole("heading", { name: /how future bank works/i })).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${OUT}/${tag}1-welcome.png`, fullPage: true });

  // 2 - Reality setup: add one account manually
  await page.getByRole("button", { name: /set up my money picture/i }).click();
  await expect(page.getByRole("heading", { name: /add your money/i })).toBeVisible();
  await page.getByRole("button", { name: /add one account manually/i }).click();
  await expect(page.getByText(/add an account/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/${tag}2-reality-setup.png`, fullPage: true });

  // fill the account form (first "Name" + first "Add")
  await page.getByLabel(/^Name$/i).first().fill("Everyday");
  await page.getByRole("button", { name: /^Add$/ }).first().click();
  await expect(page.getByText(/Account added|Saved/i)).toBeVisible();

  // add a real income stream + a recurring bill so Safe-to-Spend has inputs
  const incomeAmount = page.getByLabel(/Monthly amount/i).first();
  if (await incomeAmount.count()) {
    await incomeAmount.fill("8000");
    await incomeAmount.press("Tab");
  }

  // post a couple of real ledger transactions against the new account so
  // Today shows genuine (non-zero) figures - a salary credit + rent debit.
  const accts = await (await page.request.get(`${BASE}/api/bank/accounts`)).json();
  const acctId = accts.accounts?.[0]?.id;
  if (acctId) {
    await page.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: acctId, direction: "credit", amount: 8000, channel: "salary", category: "salary", merchant: "ACME Pte Ltd" }, headers: H });
    await page.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: acctId, direction: "debit", amount: 1850, category: "housing", merchant: "Landlord GIRO" }, headers: H });
    await page.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: acctId, direction: "debit", amount: 62.4, category: "groceries", merchant: "FairPrice" }, headers: H });
  }

  await page.getByRole("button", { name: /^Done$/i }).click();

  // 3 - Today
  await expect(page.getByRole("heading", { name: /^today$/i })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/available to spend/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/${tag}3-today.png`, fullPage: true });

  // 4 - Explore (curated)
  await page.getByRole("button", { name: /see what matters next/i }).click();
  await expect(page.getByRole("heading", { name: /what matters next/i })).toBeVisible();
  await expect(page.getByText(/recommended for you/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/${tag}4-explore.png`, fullPage: true });

  // 5 - Home first path + change receipt
  await page.getByRole("button", { name: /build a future|plan a home/i }).first().click();
  await expect(page.getByRole("heading", { name: /your first home path/i })).toBeVisible();
  await page.getByRole("button", { name: /400k–600k|400k-600k/i }).click();
  await page.getByLabel(/which year/i).selectOption({ index: 3 });
  await page.getByRole("button", { name: /show my first path/i }).click();
  await expect(page.getByText(/here is your first path/i)).toBeVisible({ timeout: 20000 });
  const monthly = page.getByLabel(/set aside each month/i);
  await monthly.fill("1,500");
  await page.getByRole("button", { name: /apply this change/i }).click();
  await expect(page.getByText(/what changed/i)).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${OUT}/${tag}5-home-change-receipt.png`, fullPage: true });

  // horizontal-overflow assertion (esp. at 320)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
}

test("desktop: five review screenshots of the /showcase slice", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1200 });
  await runFlow(page);
});

test("mobile 320: the slice fits with no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await runFlow(page, { mobile: true });
});
