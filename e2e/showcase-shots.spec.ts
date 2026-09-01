import { test, expect } from "@playwright/test";
import fs from "node:fs";

// Captures the six review screenshots of the Future Bank "Money Current"
// slice at 390px, against a fresh registered user (no seed, no persona).
// Also covers: skip -> recovery CTA, and Fix a problem -> a real screen.

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

test.use({ viewport: { width: 390, height: 844 } });

test("Future Bank slice: welcome -> snapshot -> today -> needs -> home -> change receipt (+ reload)", async ({ page }) => {
  await freshUser(page);

  // A - Welcome
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/karina/i)).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/fb-1-welcome.png`, fullPage: true });

  // B - Money Snapshot (3 steps)
  await page.getByRole("button", { name: /build my money picture/i }).click();
  await expect(page.getByRole("heading", { name: /where should we begin/i })).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-2-money-snapshot.png`, fullPage: true });
  await page.getByRole("button", { name: /a current account/i }).click();
  await expect(page.getByRole("heading", { name: /add this account/i })).toBeVisible();
  await page.getByLabel(/nickname/i).fill("Everyday");
  await page.getByLabel(/current balance/i).fill("4,200");
  await page.getByRole("button", { name: /save account/i }).click();
  await expect(page.getByRole("heading", { name: /what should we watch first/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /my income/i }).click();
  // give Today a real bill + salary via the API so the current has nodes
  const accts = await (await page.request.get(`${BASE}/api/bank/accounts`)).json();
  const acctId = accts.accounts?.[0]?.id;
  await page.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: acctId, direction: "debit", amount: 1450, category: "housing", merchant: "Landlord GIRO" }, headers: H });
  await page.request.post(`${BASE}/api/financial-twin/rows`, { data: { kind: "income", data: { kind: "salary", label: "Salary", monthlyAmount: 4200, nextExpectedDate: nextMonthISO() } }, headers: H });
  await page.request.post(`${BASE}/api/financial-twin/rows`, { data: { kind: "recurring", data: { label: "Rent", monthlyAmount: 1450, nextDueDate: soonISO(), recurringGroup: "rent" } }, headers: H });
  await page.getByRole("button", { name: /see my money picture/i }).click();

  // C - Today
  await expect(page.getByText(/available to spend/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel(/money current/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-3-today.png`, fullPage: true });

  // explain sheet on the main number
  await page.getByRole("button", { name: /available to spend/i }).click();
  await expect(page.getByText(/how it's worked out/i)).toBeVisible();
  await page.getByRole("button", { name: /^close$/i }).click();

  // D - What needs you next
  await page.getByRole("button", { name: /see what needs you next/i }).click();
  await expect(page.getByRole("heading", { name: /what needs you next/i })).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-4-needs-next.png`, fullPage: true });

  // E - Home Horizon
  await page.getByRole("button", { name: /^build a future$/i }).click();
  await expect(page.getByRole("heading", { name: /home horizon/i })).toBeVisible();
  await page.getByRole("button", { name: /400–600k|400-600k/i }).click();
  await page.getByLabel(/target year/i).selectOption({ index: 3 });
  await page.getByRole("button", { name: /show my horizon/i }).click();
  await expect(page.locator("text=Home Horizon").first()).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${OUT}/fb-5-home-horizon.png`, fullPage: true });

  // F - Change Receipt (Money Current ripple)
  await page.getByLabel(/monthly pace/i).evaluate((el: HTMLInputElement) => {
    el.value = "1500";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: /apply this pace/i }).click();
  await expect(page.getByText(/^what changed$/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/exceeds_regulatory_ceiling/i)).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/fb-6-change-receipt.png`, fullPage: true });

  // reload keeps the seeded path
  await page.reload();
  await expect(page.getByText(/your money has a present|available to spend/i)).toBeVisible({ timeout: 20000 });
  const field = await (await page.request.get(`${BASE}/api/future-field?domain=home`)).json();
  expect(field.hasRealityPath).toBeTruthy();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow at 390").toBeLessThanOrEqual(1);
});

test("skip setup leaves a clear recovery CTA, not an empty Today", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await page.getByRole("button", { name: /build my money picture/i }).click();
  await page.getByRole("button", { name: /just explore a goal first/i }).click();
  // routed to "what needs you next" with a recommendation, never a dead Today
  await expect(page.getByRole("heading", { name: /what needs you next/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/make your picture sharper|bring in your transactions/i)).toBeVisible();
});

test("Fix a money problem opens a real Problem sheet, not Today", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await page.getByRole("button", { name: /build my money picture/i }).click();
  await page.getByRole("button", { name: /just explore a goal first/i }).click();
  await page.getByRole("button", { name: /^solve a problem$/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/what kind of problem/i)).toBeVisible();
  await page.getByRole("button", { name: /a payment or bill is under pressure/i }).click();
  // either a found case or an honest "no matching issue" - never blank
  await expect(page.getByText(/no matching issue is currently found|at risk|why now/i)).toBeVisible();
});

function nextMonthISO() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}
function soonISO() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().slice(0, 10);
}
