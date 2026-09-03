import { test, expect } from "@playwright/test";

// Connections — the three outside-data links connect for real (a stored
// per-account link), and the pulled detail is viewable. No conditional skips.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);
const hdr = { origin: BASE, referer: `${BASE}/` };

test("connect SGFinDex and the insurer; the linked data is viewable and persists", async ({ page }) => {
  test.setTimeout(120000);
  const email = `e2e-conn-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: hdr,
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  const ob = (b: unknown) => page.request.post(`${BASE}/api/onboarding`, { data: b, headers: hdr });
  await ob({ action: "set_account_type", accountType: "individual" });
  await ob({ action: "set_consent", scope: "account_data", granted: true });
  await page.request.post(`${BASE}/api/bank/accounts`, { data: { kind: "current", displayName: "Everyday", currency: "SGD" }, headers: hdr });
  await ob({ action: "advance", step: "add_reality" });
  await ob({ action: "advance", step: "first_result" });
  await ob({ action: "advance", step: "complete" });

  await page.goto(BASE + "/");
  await page.getByTestId("bottom-nav-mirror").click();
  await page.getByRole("button", { name: /See everything that's limited and why/i }).click();
  await expect(page.getByRole("heading", { name: /Connections/i })).toBeVisible({ timeout: 15000 });

  // SGFinDex: connect -> Connected -> see the pulled sources
  const sgRow = page.getByTestId("conn-sgfindex");
  await sgRow.getByRole("button", { name: /^Connect$/ }).click();
  await expect(sgRow.getByText(/^Connected$/)).toBeVisible({ timeout: 15000 });
  await sgRow.getByRole("button", { name: /See what's linked/i }).click();
  await expect(sgRow.getByText(/CPF Board/i).first()).toBeVisible();
  await expect(sgRow.getByText(/IRAS/i).first()).toBeVisible();

  // Insurer: connect -> policies visible
  const insRow = page.getByTestId("conn-insurer");
  await insRow.getByRole("button", { name: /^Connect$/ }).click();
  await expect(insRow.getByText(/^Connected$/)).toBeVisible({ timeout: 15000 });
  await insRow.getByRole("button", { name: /See what's linked/i }).click();
  await expect(insRow.getByText(/Great Eastern/i).first()).toBeVisible();

  // persists on the API
  const c = await page.request.get(`${BASE}/api/connections`).then((r) => r.json());
  const byId = Object.fromEntries(c.connections.map((x: { id: string }) => [x.id, x]));
  expect(byId.sgfindex.status).toBe("connected");
  expect(byId.insurer.status).toBe("connected");
  expect(byId.payment_provider.status).toBe("not_connected");

  // and re-renders connected after a reload
  await page.reload();
  await page.getByTestId("bottom-nav-mirror").click();
  await page.getByRole("button", { name: /See everything that's limited and why/i }).click();
  await expect(page.getByTestId("conn-sgfindex").getByText(/^Connected$/)).toBeVisible({ timeout: 15000 });
});
