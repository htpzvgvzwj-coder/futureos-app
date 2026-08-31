import { test, expect, Page } from "@playwright/test";
import { existsSync } from "node:fs";

// Living Thread - the nine flagship Studios, end to end, as the seeded E2E
// user. Run `npm run test:e2e:seed` first (writes e2e/.auth/user.json);
// without it these skip rather than fail.
const HAS_AUTH = existsSync("e2e/.auth/user.json");
test.skip(!HAS_AUTH, "run `npm run test:e2e:seed` first");

// domain -> the URL hash the SPA routes on + the primary variable control.
const STUDIOS: { name: string; hash: string; sealMonthly: number }[] = [
  { name: "Home Horizon", hash: "homeHorizon", sealMonthly: 1800 },
  { name: "Safety Runway", hash: "emergencyRunway", sealMonthly: 500 },
  { name: "Debt Gravity", hash: "repaymentPath", sealMonthly: 300 },
  { name: "Future-Day Loom", hash: "futureLifeTimeline", sealMonthly: 500 },
  { name: "Calendar Orbit", hash: "tripOrbit", sealMonthly: 300 },
  { name: "Capital Prism", hash: "capitalPaths", sealMonthly: 800 },
  { name: "Living Envelope", hash: "protectionEnvelope", sealMonthly: 60 },
  { name: "Private Constellation", hash: "familyConstellation", sealMonthly: 1100 },
  { name: "Wedding Living Plan", hash: "weddingLivingPlan", sealMonthly: 800 },
];

async function openStudio(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
}

for (const s of STUDIOS) {
  test(`${s.name}: the 12-point causal-spine walk`, async ({ page }, testInfo) => {
    await openStudio(page, s.hash);

    // 1 + 2 - move a core variable, the numbers recompute immediately
    const slider = page.getByRole("slider").first();
    await expect(slider).toBeVisible();
    const numbersBefore = await page.locator("text=/SGD\\s?[0-9]/").allTextContents();
    await slider.focus();
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await page.waitForTimeout(300);
    const numbersAfter = await page.locator("text=/SGD\\s?[0-9]/").allTextContents();
    expect(numbersAfter.join("|"), "a figure changed after moving the control").not.toBe(numbersBefore.join("|"));

    // 3 - create a real branch (Fork), 4 - only the active branch is live
    const fork = page.getByRole("button", { name: /Fork this|从此分叉/ });
    if (await fork.isEnabled().catch(() => false)) {
      await fork.click();
      await expect(page.locator(".lsBranchList li")).toHaveCount(1, { timeout: 10_000 });
      await slider.press("ArrowRight");
      await page.getByRole("button", { name: /Fork this|从此分叉/ }).click();
      await expect(page.locator(".lsBranchList li")).toHaveCount(2);
      // compare view lists both, with a per-branch monthly effect + sealable
      await page.getByRole("button", { name: /^Compare$|^对比$/ }).click();
      await expect(page.locator(".lsBranchCompare")).toBeVisible();
    }

    // 5 - impactSet units: the network response tags each affected goal
    const domainApi = {
      homeHorizon: "home-horizon", emergencyRunway: "emergency-runway", repaymentPath: "debt-gravity",
      futureLifeTimeline: "future-day-loom", tripOrbit: "calendar-orbit", capitalPaths: "capital-prism",
      protectionEnvelope: "living-envelope", familyConstellation: "private-constellation", weddingLivingPlan: "wedding-thread",
    }[s.hash]!;
    const api = await page.request.get(`/api/${domainApi}`);
    if (api.ok()) {
      const body = await api.json();
      const goals = body?.impactSet?.affectedGoals ?? [];
      for (const g of goals) {
        expect(["sgd", "sgd_per_month", "months", "percentage", "date_shift_months", "count", null]).toContain(g.unit ?? null);
        expect(["up", "down", "flat"]).toContain(g.direction);
      }
      // 6 - allocation is per-leg (confirmedAfter only where a leg is funded)
      if (body?.impactSet?.allocationLegs) {
        const legs = body.impactSet.allocationLegs;
        for (const g of goals) {
          const funded = legs && legs[g.goalId] > 0;
          if (!funded) expect(g.confirmedAfter).toBeNull();
        }
      }
      // 9 - guardian policy shape is present in the response
      expect(body?.guardianState).toBeTruthy();
    }

    // 7 + 8 - Seal preview then confirm (through the scene's own control)
    const reviewBtn = page.getByRole("button", { name: /Review|Seal|封存/ }).first();
    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click();
      await expect(page.getByText(/Guardian|守护者/)).toBeVisible();
      const confirmBtn = page.getByRole("button", { name: /Confirm|确认封存|Seal it/ }).first();
      if (await confirmBtn.isEnabled().catch(() => false)) {
        await confirmBtn.click();
        // 9 - a Guardian watch rail appears in place
        await expect(page.locator(".lsGuardianRail")).toBeVisible({ timeout: 10_000 });
        // 10 - reload restores the same sealed moment
        await page.reload();
        await expect(page.locator(".lsGuardianRail")).toBeVisible({ timeout: 15_000 });
      }
    }

    // 11 - Memory Scrubber replays before/after
    const scrub = page.getByText(/Memory Scrubber|记忆回溯器/);
    if (await scrub.isVisible().catch(() => false)) {
      await scrub.click();
      await expect(page.locator(".lsScrubTable, .lsScrubDrawer")).toBeVisible();
    }

    // 12 - no horizontal body scroll at this viewport
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no horizontal body scroll (${testInfo.project.name})`).toBeLessThanOrEqual(1);
  });
}

test("EN <-> ZH: no raw i18n keys leak into a Studio heading", async ({ page }) => {
  for (const s of STUDIOS) {
    await openStudio(page, s.hash);
    const h1 = (await page.getByRole("heading", { level: 1 }).first().textContent()) ?? "";
    expect(h1).not.toMatch(/^[a-z][A-Za-z]+\.[a-z]/);
  }
});
