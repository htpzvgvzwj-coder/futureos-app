import { test, expect, Page } from "@playwright/test";

// Living Thread - the nine flagship Studios end to end, as the seeded E2E
// user. NO conditional escapes: every step expects its element visible +
// enabled and fails otherwise; every API call must be 200; every impact
// unit must be non-null.

const STUDIOS: { name: string; hash: string; api: string }[] = [
  { name: "Home Horizon", hash: "homeHorizon", api: "home-horizon" },
  { name: "Safety Runway", hash: "emergencyRunway", api: "emergency-runway" },
  { name: "Debt Gravity", hash: "repaymentPath", api: "debt-gravity" },
  { name: "Future-Day Loom", hash: "futureLifeTimeline", api: "future-day-loom" },
  { name: "Calendar Orbit", hash: "tripOrbit", api: "calendar-orbit" },
  { name: "Capital Prism", hash: "capitalPaths", api: "capital-prism" },
  { name: "Living Envelope", hash: "protectionEnvelope", api: "living-envelope" },
  { name: "Private Constellation", hash: "familyConstellation", api: "private-constellation" },
  { name: "Wedding Living Scene", hash: "weddingLivingPlan", api: "wedding-thread" },
];
const UNITS = ["sgd", "sgd_per_month", "months", "percentage", "date_shift_months", "count"];

async function open(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function apiJson(page: Page, api: string) {
  const res = await page.request.get(`/api/${api}`);
  expect(res.status(), `/api/${api} must be 200`).toBe(200);
  return res.json();
}

for (const s of STUDIOS) {
  test(`${s.name}: 12-point causal-spine walk`, async ({ page }, testInfo) => {
    await open(page, s.hash);

    // 1 + 2 - move a core variable, the numbers recompute
    const slider = page.getByRole("slider").first();
    await expect(slider).toBeVisible();
    await slider.focus();
    const before = (await page.locator("body").innerText()).match(/SGD\s?[\d,]+/g)?.join("|") ?? "";
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await page.waitForTimeout(400);
    const after = (await page.locator("body").innerText()).match(/SGD\s?[\d,]+/g)?.join("|") ?? "";
    expect(after, "a figure changed after moving the control").not.toBe(before);

    // 3 - Fork creates a real branch
    const fork = page.getByRole("button", { name: /Fork this|从此分叉/ });
    await expect(fork).toBeVisible();
    await expect(fork).toBeEnabled();
    await fork.click();
    await expect(page.locator(".lsBranchList li")).toHaveCount(1);

    // 4 - a second Fork + Compare shows both; ONLY the active one drives
    await slider.press("ArrowRight");
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Fork this|从此分叉/ })).toBeEnabled();
    await page.getByRole("button", { name: /Fork this|从此分叉/ }).click();
    await expect(page.locator(".lsBranchList li")).toHaveCount(2);
    await page.getByRole("button", { name: /^Compare$|^对比$/ }).click();
    await expect(page.locator(".lsBranchCompare")).toBeVisible();

    const thread1 = await apiJson(page, "life-thread");
    // select the FIRST branch as the active moment, then the second, and
    // assert the thread's studio moment state follows the selection.
    const chips = page.locator(".lsBranchPick");
    await chips.nth(0).click();
    await page.waitForTimeout(600);
    const threadA = await apiJson(page, "life-thread");
    await chips.nth(1).click();
    await page.waitForTimeout(600);
    const threadB = await apiJson(page, "life-thread");
    expect(threadA.studioMomentStates?.[domainKey(s.hash)], "active branch selected").toBe("activeBranch");
    expect(JSON.stringify(threadA.studioImpacts?.aggregated ?? []), "the two active selections differ")
      .not.toBe(JSON.stringify(threadB.studioImpacts?.aggregated ?? []));
    void thread1;

    // 5 - the impactSet tags every affected goal with a typed unit
    const body = await apiJson(page, s.api);
    const goals = body?.impactSet?.affectedGoals ?? [];
    expect(goals.length, "the impactSet has affected goals").toBeGreaterThan(0);
    for (const g of goals) {
      expect(g.unit, `${s.name}: ${g.goalId}.${g.metric} carries a typed unit`).not.toBeNull();
      expect(UNITS).toContain(g.unit);
      expect(["up", "down", "flat"]).toContain(g.direction);
    }
    // 6 - allocation is per-leg
    const legs = body?.impactSet?.allocationLegs ?? null;
    for (const g of goals) {
      const funded = legs && Number(legs[g.goalId]) > 0;
      if (!funded) expect(g.confirmedAfter, `${g.goalId} unfunded -> ghost`).toBeNull();
    }

    // 7 + 8 - Seal preview then confirm
    const review = page.getByRole("button", { name: /Review|Seal|封存/ }).first();
    await expect(review).toBeVisible();
    await expect(review).toBeEnabled();
    await review.click();
    await expect(page.getByText(/Guardian|守护者/)).toBeVisible();
    const confirm = page.getByRole("button", { name: /Confirm|确认封存|Seal it/ }).first();
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // 9 - the Guardian rail appears in place
    await expect(page.locator(".lsGuardianRail")).toBeVisible();

    // ghost -> solid: the sealed studio now contributes a SOLID impact
    const sealedThread = await apiJson(page, "life-thread");
    expect(sealedThread.sealedStudioCount, "at least one sealed studio drives a solid impact").toBeGreaterThan(0);
    const solid = (sealedThread.studioImpacts?.aggregated ?? []).some((g: { state: string }) => g.state === "solid");
    expect(solid, "a solid cross-goal group exists after Seal").toBe(true);

    // 10 - reload restores the same sealed moment
    const railTextBefore = await page.locator(".lsGuardianRail").innerText();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".lsGuardianRail")).toBeVisible();
    expect(await page.locator(".lsGuardianRail").innerText()).toBe(railTextBefore);
    const reThread = await apiJson(page, "life-thread");
    expect(reThread.sealedStudioCount).toBe(sealedThread.sealedStudioCount);

    // 11 - Memory Scrubber replays Before / After
    const scrub = page.getByText(/Memory Scrubber|记忆回溯器/);
    await expect(scrub).toBeVisible();
    await scrub.click();
    await expect(page.locator(".lsScrubTable, .lsScrubDrawer")).toBeVisible();

    // 12 - no horizontal body scroll at this viewport, + a screenshot
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no h-scroll (${testInfo.project.name})`).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`${s.hash}-${testInfo.project.name}.png`, { fullPage: true, maxDiffPixelRatio: 0.03 });
  });
}

function domainKey(hash: string) {
  return {
    homeHorizon: "home", emergencyRunway: "emergency", repaymentPath: "loan", futureLifeTimeline: "retirement",
    tripOrbit: "travel", capitalPaths: "investment", protectionEnvelope: "insurance", familyConstellation: "family",
    weddingLivingPlan: "wedding",
  }[hash]!;
}
