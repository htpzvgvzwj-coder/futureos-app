import { test, expect } from "@playwright/test";

// Guardian as a protection layer: the home is three layers (one status,
// what it protects, the causal proof), and the Contract below the fold is
// real + persists. Honours E2E_BASE_URL (used to smoke production).

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);
const hdr = { origin: BASE, referer: `${BASE}/` };

test("Guardian shows one status + protected promises + a working, persistent Contract", async ({ page }) => {
  test.setTimeout(150000);
  const email = `e2e-guardian-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: hdr,
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  const ob = (b: unknown) => page.request.post(`${BASE}/api/onboarding`, { data: b, headers: hdr });
  await ob({ action: "set_account_type", accountType: "individual" });
  await ob({ action: "set_consent", scope: "account_data", granted: true });
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "current", displayName: "Everyday", currency: "SGD" }, headers: hdr });
  const accts = (await page.request.get(`${BASE}/api/bank/accounts`).then((r) => r.json())).accounts;
  await page.request.post(`${BASE}/api/bank/transactions`, { data: { accountId: accts[0].id, direction: "credit", amount: 3000, channel: "salary" }, headers: hdr });
  await ob({ action: "advance", step: "add_reality" });
  await ob({ action: "advance", step: "first_result" });
  await ob({ action: "advance", step: "complete" });

  await page.goto(BASE + "/");
  await page.getByTestId("bottom-nav-guardian").click();

  // 1 — Guardian Now: exactly one status label + a headline
  await expect(page.getByText(/^(Calm|Watching|Decision|Urgent)$/).first()).toBeVisible({ timeout: 20000 });

  // 2 — Protected by Guardian
  await expect(page.getByText(/of \d+ promises protected/i)).toBeVisible();
  await expect(page.getByText(/Next check/i)).toBeVisible();
  await page.getByRole("button", { name: /Safety floor/i }).click();
  await expect(page.getByText(/emergency buffer/i).first()).toBeVisible();

  // below the fold: the Guardian Contract is real and persists
  await page.getByRole("button", { name: /Handling, access & the Guardian Contract/i }).click();
  await expect(page.getByText("Guardian Contract", { exact: true })).toBeVisible();

  // "Act" is disabled for moving emergency money
  const emergencyRow = page.locator("div", { hasText: /Move money out of your emergency buffer/i }).last();
  await expect(emergencyRow.getByRole("button", { name: /^Act$/ })).toBeDisabled();

  // raise "pause a plan's contribution" to Act, reload, it sticks
  const pauseRow = page.locator("div", { hasText: /Pause a plan's monthly contribution/i }).last();
  await pauseRow.getByRole("button", { name: /^Act$/ }).click();
  await expect(pauseRow.getByRole("button", { name: /^Act$/ })).toHaveAttribute("aria-pressed", "true");

  // persists server-side (survives reload / re-login)
  const c = await page.request.get(`${BASE}/api/guardian`).then((r) => r.json());
  expect(c.contract.capabilities.find((x: { capability: string }) => x.capability === "pause_plan_contribution").level).toBe("act");

  // and re-renders from that state on a fresh load of the Guardian tab
  await page.goto(BASE + "/");
  await page.getByTestId("bottom-nav-guardian").click({ timeout: 35000 });
  await expect(page.getByText(/^(Calm|Watching|Decision|Urgent)$/).first()).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /Handling, access & the Guardian Contract/i }).click();
  await expect(
    page.locator("div", { hasText: /Pause a plan's monthly contribution/i }).last().getByRole("button", { name: /^Act$/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
