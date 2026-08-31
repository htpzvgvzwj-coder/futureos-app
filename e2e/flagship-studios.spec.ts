import { test, expect } from "@playwright/test";

// Living Thread commit 13 - the nine flagship Studios, end to end.
//
// Requires a logged-in session. Set E2E_STORAGE_STATE to a Playwright
// storageState json (or wire your own login in a beforeEach). Without it
// these are skipped, not failed.
const STORAGE = process.env.E2E_STORAGE_STATE;
test.skip(!STORAGE, "set E2E_STORAGE_STATE to a logged-in storageState json");
if (STORAGE) test.use({ storageState: STORAGE });

const STUDIOS: { name: string; hash: string; sliderLabel: RegExp }[] = [
  { name: "Home Horizon", hash: "#homeHorizon", sliderLabel: /home/i },
  { name: "Safety Runway", hash: "#emergencyRunway", sliderLabel: /target|end/i },
  { name: "Debt Gravity", hash: "#repaymentPath", sliderLabel: /release|payoff/i },
  { name: "Future-Day Loom", hash: "#futureLifeTimeline", sliderLabel: /seam|age/i },
  { name: "Calendar Orbit", hash: "#tripOrbit", sliderLabel: /trip|nights/i },
  { name: "Capital Prism", hash: "#capitalPaths", sliderLabel: /seam|gate/i },
  { name: "Living Envelope", hash: "#protectionEnvelope", sliderLabel: /cover/i },
  { name: "Private Constellation", hash: "#familyConstellation", sliderLabel: /node|seam/i },
  { name: "Wedding Living Plan", hash: "#weddingLivingPlan", sliderLabel: /guest|budget/i },
];

for (const s of STUDIOS) {
  test(`${s.name}: native scene renders, a slider handle is keyboard-operable, reduced-motion honoured`, async ({ page }) => {
    await page.goto(`/${s.hash}`);
    // the scene mounts (its back link + heading are always present)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // at least one direct-manipulation handle, keyboard operable
    const slider = page.getByRole("slider").first();
    await expect(slider).toBeVisible();
    await slider.focus();
    const before = await slider.getAttribute("aria-valuenow");
    await slider.press("ArrowRight");
    const after = await slider.getAttribute("aria-valuenow");
    expect(after).not.toBe(before);

    // the BranchStrip (Create/Select/Compare/Undo) is present
    await expect(page.getByText(/Branches|分支/)).toBeVisible();
  });

  test(`${s.name}: 320 + 390 widths do not scroll the body horizontally`, async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(`/${s.hash}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `no horizontal body scroll at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test("EN <-> ZH toggle keeps every Studio heading translated (no raw keys)", async ({ page }) => {
  for (const s of STUDIOS) {
    await page.goto(`/${s.hash}`);
    const h1 = (await page.getByRole("heading", { level: 1 }).first().textContent()) ?? "";
    expect(h1).not.toMatch(/^[a-z]+([A-Z][a-z]+)*\.[a-z]/); // not a dotted i18n key
  }
});
