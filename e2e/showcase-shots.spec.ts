import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";

// Future Bank Core Loop - 390px review screenshots of the rebuilt Today
// (Money Position -> Bank Now -> Money Current -> One thing that needs you
// -> What changed -> Plans in motion -> Recent activity) plus Explore,
// Change Receipt, Guardian and History - all against a fresh real account,
// on a production build (no dev overlay).

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });
const rid = () => Math.random().toString(36).slice(2, 9);
const H = { origin: BASE, referer: `${BASE}/` };

test.use({ viewport: { width: 390, height: 844 } });

async function freshUser(page: Page) {
  const email = `shot-${rid()}@futureos.test`;
  const r = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "shot-password-1", displayName: "Preview" },
    headers: H,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return email;
}

// The prod build marks the session cookie Secure; Playwright's
// APIRequestContext drops it over http, the browser keeps it - so every
// authenticated call goes through the page.
async function apiPost(page: Page, path: string, body: unknown) {
  return page.evaluate(
    async ([p, b]) => {
      const r = await fetch(p as string, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
    },
    [path, body] as const,
  );
}
async function apiGet(page: Page, path: string) {
  return page.evaluate(async (p) => {
    const r = await fetch(p as string, { headers: { "cache-control": "no-cache" } });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
  }, path);
}

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
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  return d.toISOString().slice(0, 7);
}

// A full realistic picture: two accounts, salary, rent, ordinary spend and
// one large unusual spend (a real detector trigger).
async function seedPicture(page: Page, { unusual = true } = {}) {
  const a = await apiPost(page, "/api/bank/accounts", { kind: "current", displayName: "Everyday", institution: "OCBC" });
  const b = await apiPost(page, "/api/bank/accounts", { kind: "savings", displayName: "Savings" });
  const acctId = a.body?.account?.id;
  const saveId = b.body?.account?.id;
  await apiPost(page, "/api/bank/transactions", { accountId: acctId, direction: "credit", amount: 9200, channel: "opening_balance", category: "opening_balance", merchant: "Opening balance" });
  await apiPost(page, "/api/bank/transactions", { accountId: saveId, direction: "credit", amount: 3000, channel: "opening_balance", category: "opening_balance", merchant: "Opening balance" });
  await apiPost(page, "/api/financial-twin/rows", { kind: "income", data: { kind: "salary", label: "Salary", monthlyAmount: 4200, nextExpectedDate: nextMonthISO() } });
  await apiPost(page, "/api/financial-twin/rows", { kind: "recurring", data: { label: "Rent", monthlyAmount: 1450, nextDueDate: soonISO(), recurringGroup: "rent" } });
  // 3 months of real income + expense history -> a real monthly basis, so
  // cross-plan projections (emergency runway etc.) move in real months.
  for (let i = 1; i <= 3; i++) {
    await apiPost(page, "/api/income/entries", { entryMonth: monthsAgo(i), amount: 4200 });
    await apiPost(page, "/api/expense/entries", { entryMonth: monthsAgo(i), amount: 2600 });
  }
  for (const [amt, merch, d] of [[42, "Kopitiam", 7], [58, "NTUC", 6], [33, "EZLink", 5], [120, "Shopee", 4]] as const) {
    await apiPost(page, "/api/bank/transactions", { accountId: acctId, direction: "debit", amount: amt, category: "shopping", merchant: merch, status: "posted", postedAt: daysAgoISO(d), authorisedAt: daysAgoISO(d) });
  }
  if (unusual) {
    await apiPost(page, "/api/bank/transactions", { accountId: acctId, direction: "debit", amount: 3400, category: "shopping", merchant: "Big Electronics", status: "posted", postedAt: daysAgoISO(2), authorisedAt: daysAgoISO(2) });
  }
  return { acctId, saveId };
}

async function gotoToday(page: Page) {
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText("Available now", { exact: true })).toBeVisible({ timeout: 25000 });
}

// ---------------------------------------------------------------------

test("Today - full hierarchy with the three Bank Now actions + a detected issue", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`); // establishes the session cookie in the browser
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await seedPicture(page, { unusual: true });
  await gotoToday(page);

  // 1 Money Position
  await expect(page.getByText(/^Available now$/i)).toBeVisible();
  await expect(page.getByText(/^Protected$/i).first()).toBeVisible();
  await expect(page.getByText(/^Committed$/i).first()).toBeVisible();
  // 2 Bank Now - the three conventional actions
  await expect(page.getByRole("button", { name: /PayNow/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Foreign Exchange/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Scan & Pay/i })).toBeVisible();
  // 3 Money Current
  await expect(page.getByLabel(/money current/i)).toBeVisible();
  // 4 One thing that needs you - the detected unusual spend
  await expect(page.getByRole("article").getByText(/payment to Big Electronics is well above your usual spend/i)).toBeVisible();
  // 6 Plans in motion / 7 Recent activity
  await expect(page.getByText(/Recent activity/i)).toBeVisible();

  await page.screenshot({ path: `${OUT}/fb-today-full.png`, fullPage: true });

  // no horizontal overflow, no dev overlay
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow at 390").toBeLessThanOrEqual(1);
  await expect(page.locator("text=/Unhandled Runtime Error|__next-build-watcher/i")).toHaveCount(0);
});

test("Today - number explanation sheet opens for the main figure", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await seedPicture(page, { unusual: false });
  await gotoToday(page);

  await page.getByRole("button", { name: /available now/i }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(/how it's worked out/i).first()).toBeVisible();
  await expect(sheet.getByText(/confidence/i).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-explain-sheet.png`, fullPage: true });
  await page.getByRole("button", { name: /^close$/i }).click();
});

test("Today - calm state: no invented warning, and what Future Bank is watching", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  // minimal picture: one account + opening balance only -> nothing unusual
  const a = await apiPost(page, "/api/bank/accounts", { kind: "current", displayName: "Everyday" });
  await apiPost(page, "/api/bank/transactions", { accountId: a.body?.account?.id, direction: "credit", amount: 6000, channel: "opening_balance", category: "opening_balance", merchant: "Opening balance" });
  await gotoToday(page);

  await expect(page.getByText(/nothing needs your attention right now/i)).toBeVisible();
  await expect(page.getByText(/future bank is watching/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-today-calm.png`, fullPage: true });
});

test("Today - after an internal transfer: a persisted Money Changed receipt", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await seedPicture(page, { unusual: false });
  await gotoToday(page);

  await page.getByRole("button", { name: /PayNow/i }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(/external paynow is not connected/i)).toBeVisible();
  await sheet.getByLabel(/^Amount$/i).fill("800");
  await sheet.getByRole("button", { name: /move my money/i }).click();
  await expect(sheet.getByText(/moved SGD/i)).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500); // sheet auto-closes + refetch

  await expect(page.getByText(/moved SGD 800 between your own accounts/i).first()).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/fb-today-after-transfer.png`, fullPage: true });

  // reload -> the receipt persists (server-owned, not React state)
  await page.reload();
  await expect(page.getByText("Available now", { exact: true })).toBeVisible({ timeout: 20000 });
  const mm = await apiGet(page, "/api/money-moments");
  expect(mm.body?.moneyChanged?.hasChange).toBeTruthy();
});

test("Explore - noticed / plans moving / choose; then Home change -> Change Receipt with affected plans", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await seedPicture(page, { unusual: true });
  // two other real plans so a Home change genuinely moves other goals
  await apiPost(page, "/api/future-field/seed", { domain: "emergency", mode: "estimate", answers: { cash_band: "10k-30k", essentials_band: "1.5k-3k", target_months: "6" }, exactAmounts: { monthly_contribution: 600 } });
  await apiPost(page, "/api/future-field/seed", { domain: "wedding", mode: "estimate", answers: { wedding_month: "2028-06", guest_band: "40-90", style: "mid_range" }, exactAmounts: { monthly_contribution: 500 } });
  await gotoToday(page);

  await page.getByRole("button", { name: /see what needs you next/i }).click();
  await expect(page.getByRole("heading", { name: /what needs you next/i })).toBeVisible();
  await expect(page.getByText(/future bank noticed/i)).toBeVisible();
  await expect(page.getByText(/your plans are moving/i)).toBeVisible();
  await expect(page.getByText(/choose what to do/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-explore-noticed.png`, fullPage: true });

  // Build a home plan -> Change Receipt
  await page.getByRole("button", { name: /build a future/i }).click();
  await expect(page.getByRole("heading", { name: /home horizon/i })).toBeVisible();
  await page.getByRole("button", { name: /400–600k|400-600k/i }).click();
  await page.getByLabel(/target year/i).selectOption({ index: 3 });
  await page.getByRole("button", { name: /show my horizon/i }).click();
  await expect(page.getByLabel(/monthly pace/i)).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /apply this pace/i }).click();
  await expect(page.getByText(/^You changed$/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/exceeds_regulatory_ceiling/i)).toHaveCount(0);
  await expect(page.getByText(/Preview|Committed/).first()).toBeVisible();
  // every materially affected plan/goal, not just Home
  const movedRows = page.locator("text=/^Moved$/");
  expect(await movedRows.count(), "the receipt lists several affected plans/goals").toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: `${OUT}/fb-change-receipt.png`, fullPage: true });

  // Explore again now shows the plan moving
  await page.getByRole("button", { name: /back to what needs you next/i }).click();
  await expect(page.getByText(/your plans are moving/i)).toBeVisible();
  await expect(page.getByText(/^home$/i).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-explore-plans.png`, fullPage: true });
});

test("Guardian and History read the same Money Moment / event", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await seedPicture(page, { unusual: true });
  await gotoToday(page);

  // reach Guardian via All services
  await page.getByRole("button", { name: /see what needs you next/i }).click();
  await page.getByRole("button", { name: /^all services$/i }).click();
  const svc = page.getByRole("dialog");
  await svc.getByPlaceholder(/search services/i).fill("guardian");
  await svc.getByRole("button", { name: /open guardian/i }).click();
  await expect(page.getByRole("heading", { name: /guardian/i })).toBeVisible();
  await expect(page.getByText(/reads the same Money Moments/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-guardian.png`, fullPage: true });

  // History
  await page.getByRole("button", { name: /← Today/i }).click();
  await page.getByRole("button", { name: /see what needs you next/i }).click();
  await page.getByRole("button", { name: /^all services$/i }).click();
  const svc2 = page.getByRole("dialog");
  await svc2.getByPlaceholder(/search services/i).fill("history");
  await svc2.getByRole("button", { name: /open history/i }).click();
  await expect(page.getByRole("heading", { name: /history/i })).toBeVisible();
  await page.screenshot({ path: `${OUT}/fb-history.png`, fullPage: true });
});

test("detector lifecycle: acknowledge persists across reload", async ({ page }) => {
  await freshUser(page);
  await page.goto(`${BASE}/showcase`);
  await expect(page.getByText(/your money has a present/i)).toBeVisible({ timeout: 20000 });
  await seedPicture(page, { unusual: true });
  await gotoToday(page);

  await expect(page.getByRole("article").getByText(/above your usual spend/i)).toBeVisible();
  await page.getByRole("button", { name: /i recognise this/i }).click();
  await expect(page.getByRole("article").getByText(/above your usual spend/i)).toHaveCount(0, { timeout: 15000 });

  await page.reload();
  await expect(page.getByText("Available now", { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("article").getByText(/above your usual spend/i)).toHaveCount(0);
});
