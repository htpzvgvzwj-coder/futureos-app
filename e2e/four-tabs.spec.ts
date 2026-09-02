import { test, expect } from "@playwright/test";

// The four bottom-nav tabs (Today / Life / Explore / Guardian) each render
// their real screen and a key control on each works. Runs against whatever
// E2E_BASE_URL points at (used to smoke production). No conditional skips.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);
const hdr = { origin: BASE, referer: `${BASE}/` };

test("Today / Life / Explore / Guardian all render and their key controls work", async ({ page }) => {
  const email = `e2e-fourtabs-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: hdr,
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  const ob = (body: unknown) => page.request.post(`${BASE}/api/onboarding`, { data: body, headers: hdr });
  await ob({ action: "set_account_type", accountType: "individual" });
  await ob({ action: "set_consent", scope: "account_data", granted: true });
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "current", displayName: "Everyday", currency: "SGD" }, headers: hdr });
  const accts = (await page.request.get(`${BASE}/api/bank/accounts`).then((r) => r.json())).accounts;
  await page.request.post(`${BASE}/api/bank/transactions`, {
    data: { accountId: accts[0].id, direction: "credit", amount: 3200, channel: "salary" },
    headers: hdr,
  });
  await ob({ action: "advance", step: "add_reality" });
  await ob({ action: "advance", step: "first_result" });
  await ob({ action: "advance", step: "complete" });

  await page.goto(BASE + "/");

  // --- Today (bottom-nav-home) ---
  await page.getByTestId("bottom-nav-home").click();
  await expect(page.getByRole("button", { name: /See my full money picture/i })).toBeVisible({ timeout: 20000 });
  // a key control: open the full money picture (Financial Twin)
  await page.getByRole("button", { name: /See my full money picture/i }).click();
  await expect(page.getByRole("heading", { name: /Your money picture/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Where your money sits|Nothing added yet/i).first()).toBeVisible();
  await page.getByRole("button", { name: /← Today/i }).click();

  // --- Life (bottom-nav-lifeGraph) ---
  await page.getByTestId("bottom-nav-lifeGraph").click();
  await expect(page.getByText(/Life position/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/What is moving|steady|not set up/i).first()).toBeVisible();

  // --- Explore (bottom-nav-mirror) ---
  await page.getByTestId("bottom-nav-mirror").click();
  await expect(page.getByText(/Bank capabilities/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Spend & Pay/i)).toBeVisible();
  await expect(page.getByText(/Plan a future/i)).toBeVisible();
  // a key control: open a capability zone
  await page.getByText(/Financial Twin/i).first().click();
  await expect(page.getByRole("heading", { name: /Your money picture/i })).toBeVisible({ timeout: 15000 });

  // --- Guardian (bottom-nav-guardian) ---
  await page.getByTestId("bottom-nav-guardian").click();
  await expect(page.getByRole("heading", { name: /^Guardian$/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/What Guardian can never do/i)).toBeVisible();
  await expect(page.getByText(/move money or make a payment/i)).toBeVisible();

  // nav round-trips back to Today
  await page.getByTestId("bottom-nav-home").click();
  await expect(page.getByRole("button", { name: /See my full money picture/i })).toBeVisible({ timeout: 15000 });
});
