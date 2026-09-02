import { test, expect } from "@playwright/test";

// Phase 6 Round 1 - Family & Care made real: account type, a Care Circle
// row with a relation + what they're noted for, and a written handoff plan
// that is a note only (never executed). Real APIs, real persistence across
// a reload. No conditional skips.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);

test("account type, a Care Circle relation, and a written handoff plan persist", async ({ page }) => {
  const email = `e2e-care-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: { origin: BASE, referer: `${BASE}/` },
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  const post = (body: unknown) =>
    page.request.post(`${BASE}/api/onboarding`, { data: body, headers: { origin: BASE, referer: `${BASE}/` } });
  await post({ action: "set_account_type", accountType: "individual" });
  await post({ action: "set_consent", scope: "account_data", granted: true });
  await post({ action: "advance", step: "add_reality" });
  await post({ action: "advance", step: "first_result" });
  await post({ action: "advance", step: "complete" });

  await page.goto(BASE + "/");

  // Explore -> Family & Care
  await page.getByTestId("bottom-nav-mirror").click();
  await page.getByRole("button", { name: /^Family/ }).click();
  await expect(page.getByRole("heading", { name: /Family & Care/i })).toBeVisible({ timeout: 15000 });

  // Account setup: switch to a youth account
  await page.getByRole("button", { name: /Youth, with a guardian/i }).click();
  await expect(page.getByText(/Account set to .Youth, with a guardian./i)).toBeVisible();

  // Add a guardian, then give them a relation + something they're noted for
  await page.getByRole("button", { name: /A guardian for me/i }).click();
  await expect(page.getByText(/Added as a placeholder/i)).toBeVisible();

  await page.getByRole("button", { name: /^Edit$/ }).first().click();
  await page.getByLabel(/Who they are/i).fill("My mother");
  await page.getByRole("button", { name: /Emergency fund/i }).click();
  await page.getByRole("button", { name: /^Save$/ }).click();
  await expect(page.getByText(/My mother/)).toBeVisible();
  await expect(page.getByText(/noted for: .*Emergency fund/i)).toBeVisible();

  // Write a handoff plan
  await page.getByRole("button", { name: /Write a handoff plan/i }).click();
  await page.getByRole("button", { name: /Retirement handoff/i }).click();
  await page.getByRole("button", { name: /My mother/ }).click();
  await page.getByLabel(/When this plan should apply/i).fill("at 65");
  await page.getByLabel(/What they should know/i).fill("keep the bills paid from the joint account");
  await page.getByRole("button", { name: /Save as a written plan/i }).click();
  await expect(page.getByText(/Handoff plan saved as a written note/i)).toBeVisible();
  await expect(page.getByText(/Future Bank never carries it out on its own/i).first()).toBeVisible();

  // Persistence: the API has it, described only
  const h = await page.request.get(`${BASE}/api/account?view=handoff`).then((r) => r.json());
  expect(h.handoff.status).toBe("described");
  expect(h.handoff.kind).toBe("retirement");
  expect(h.handoff.instructions).toMatch(/keep the bills paid/);

  // Persistence across a reload in the UI
  await page.reload();
  await page.getByTestId("bottom-nav-mirror").click();
  await page.getByRole("button", { name: /^Family/ }).click();
  await expect(page.getByText(/Retirement handoff — written down/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/My mother/).first()).toBeVisible();
  await expect(page.getByText(/noted for: .*Emergency fund/i)).toBeVisible();
});
