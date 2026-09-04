import { test, expect } from "@playwright/test";

// Phase 5 smoke - the two Detect->visible-output tabs render for a real
// user against the real APIs: Guardian (decision queue over the shared
// Money Moment stream) and Spending Intelligence (pattern built only from
// posted transactions). No conditional skips.

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const rid = () => Math.random().toString(36).slice(2, 9);

test("Guardian and Spending Intelligence tabs render for a new user", async ({ page }) => {
  const email = `e2e-banktabs-${rid()}@futureos.test`;
  const signup = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: "test-password-123", displayName: "E2E User" },
    headers: { origin: BASE, referer: `${BASE}/` },
  });
  expect(signup.status(), await signup.text()).toBeLessThan(300);

  // Walk onboarding via the real API so we land on a usable Today.
  const post = (body: unknown) =>
    page.request.post(`${BASE}/api/onboarding`, { data: body, headers: { origin: BASE, referer: `${BASE}/` } });
  await post({ action: "set_account_type", accountType: "individual" });
  await post({ action: "set_consent", scope: "account_data", granted: true });

  // One real account so the shell has something to show.
  await page.request.post(`${BASE}/api/bank/accounts`, {
    data: { kind: "everyday", displayName: "Everyday", currency: "SGD" },
    headers: { origin: BASE, referer: `${BASE}/` },
  });

  await post({ action: "advance", step: "add_reality" });
  await post({ action: "advance", step: "first_result" });
  await post({ action: "advance", step: "complete" });

  await page.goto(BASE + "/");

  // Life tab — the Living Thread: a direction sentence, the Life Position
  // sentence, a weather chip, and Life Memory (starting point at minimum)
  await page.getByTestId("bottom-nav-lifeGraph").click();
  await expect(page.getByRole("heading", { name: /^Life$/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/promised to (your )?future plans/i).first()).toBeVisible();
  await expect(page.getByText(/safety (covers|buffer)/i).first()).toBeVisible();
  await expect(page.getByText(/\b(Calm|Tight|Exposed|Recovering|Opportunity)\b/).first()).toBeVisible();
  await expect(page.getByText(/Latest movement|Your starting point/i).first()).toBeVisible();

  // Guardian tab — the protection layer: one status + what it protects
  await page.getByTestId("bottom-nav-guardian").click();
  await expect(page.getByRole("heading", { name: /^Guardian$/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/^(Calm|Watching|Decision|Urgent)$/).first()).toBeVisible();
  await expect(page.getByText(/of \d+ promises protected/i)).toBeVisible();

  // Explore -> All tools -> Spending Intelligence
  await page.getByTestId("bottom-nav-mirror").click();
  await expect(page.getByText(/Try a future before you commit/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /^All tools$/i }).click();
  await page.getByRole("button", { name: /Spending Intelligence/i }).first().click();
  await expect(page.getByRole("heading", { name: /Spending Intelligence/i })).toBeVisible({ timeout: 15000 });
  // Either a real pattern or the honest "not enough history" card - never a fake number.
  await expect(
    page.getByText(/Not enough history yet|Based on \d+ posted transaction/i).first(),
  ).toBeVisible();
});
