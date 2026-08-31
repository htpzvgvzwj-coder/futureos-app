import { test, expect, Page, BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STUDIOS, UNITS, authFileFor, screenshotName } from "./identities.mjs";

// Living Thread - the nine flagship Studios end to end, each as its OWN
// seeded (domain x project) identity so one Studio's Seal never pollutes
// another's cross-goal numbers. NO conditional escapes: every step expects
// its element visible + enabled and fails otherwise; every API call must be
// 200; every impact unit must be non-null and in the closed vocabulary.
//
// Exactly 20 assertions per Studio per viewport (the "20-check walk").

// Do not inherit any global auth; each test loads its own identity's cookies.
test.use({ storageState: { cookies: [], origins: [] } });

async function loadIdentity(context: BrowserContext, domain: string, project: string) {
  const file = path.join(process.cwd(), authFileFor(domain, project));
  const state = JSON.parse(readFileSync(file, "utf8"));
  await context.addCookies(state.cookies);
}

async function open(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function apiJson(page: Page, api: string) {
  const res = await page.request.get(`/api/${api}`);
  expect(res.status(), `/api/${api} must be 200`).toBe(200);
  return res.json();
}
const figures = (s: string) => (s.match(/SGD\s?[\d,]+/g) ?? []).join("|");

for (const s of STUDIOS) {
  test(`${s.name}: 20-check causal-spine walk`, async ({ page, context }, testInfo) => {
    const project = testInfo.project.name;
    await loadIdentity(context, s.domain, project);

    // 1 - the native scene mounts
    await open(page, s.hash);

    // 2 - a keyboard-operable slider handle is present + live
    const slider = page.getByRole("slider").first();
    await expect(slider).toBeVisible();
    await expect(slider).toBeEnabled();
    await slider.focus();

    // 3 - moving the handle recomputes a visible figure
    const before = figures(await page.locator("body").innerText());
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await page.waitForTimeout(400);
    const after = figures(await page.locator("body").innerText());
    expect(after, "a figure changed after moving the control").not.toBe(before);

    // 4 - the Studio's own API answers 200
    const body = await apiJson(page, s.api);
    const goals = body?.impactSet?.affectedGoals ?? [];

    // 5 - the server impactSet has affected goals
    expect(goals.length, "the impactSet has affected goals").toBeGreaterThan(0);

    // 6 - every affected goal carries a typed unit from the closed vocabulary
    for (const g of goals) {
      expect(g.unit, `${s.name}: ${g.goalId}.${g.metric} carries a typed unit`).not.toBeNull();
      expect(UNITS, `${g.goalId}.${g.metric} unit is known`).toContain(g.unit);
    }

    // 7 - every affected goal has a valid direction
    for (const g of goals) expect(["up", "down", "flat"]).toContain(g.direction);

    // 8 - every affected goal has a valid effectState (possible before Seal)
    for (const g of goals) {
      expect(["possible", "placed", "confirmed"], `${g.goalId} effectState`).toContain(g.effectState);
    }

    // 9 - per-leg: an unfunded goal has NO confirmed number
    const legs = body?.impactSet?.allocationLegs ?? null;
    for (const g of goals) {
      const funded = legs && Number(legs[g.goalId]) > 0;
      if (!funded) expect(g.confirmedAfter, `${g.goalId} unfunded -> ghost`).toBeNull();
    }

    // 10 - Fork creates a real branch
    const forkName = /Fork this|从此分叉/;
    const fork = page.getByRole("button", { name: forkName });
    await expect(fork).toBeVisible();
    await expect(fork).toBeEnabled();
    await fork.click();
    await expect(page.locator(".lsBranchList li")).toHaveCount(1);

    // 11 - a second Fork -> two branches
    await slider.press("ArrowRight");
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: forkName })).toBeEnabled();
    await page.getByRole("button", { name: forkName }).click();
    await expect(page.locator(".lsBranchList li")).toHaveCount(2);

    // 12 - Compare shows both branches side by side
    await page.getByRole("button", { name: /^Compare$|^对比$/ }).click();
    await expect(page.locator(".lsBranchCompare")).toBeVisible();

    // 13 - selecting branch A makes it the active moment in the Life Thread
    const chips = page.locator(".lsBranchPick");
    await chips.nth(0).click();
    await page.waitForTimeout(600);
    const threadA = await apiJson(page, "life-thread");
    expect(threadA.studioMomentStates?.[s.domain], "active branch selected").toBe("activeBranch");

    // 14 - the Life Thread carries ONE canonical snapshot id, and no baseline conflict
    expect(threadA.canonicalSnapshotId, "the thread exposes a canonical snapshot id").toBeTruthy();
    expect(threadA.studioBaselineConflict ?? false, "a clean run has no baseline conflict").toBe(false);

    // 15 - selecting branch B changes the aggregated cross-goal impact
    await chips.nth(1).click();
    await page.waitForTimeout(600);
    const threadB = await apiJson(page, "life-thread");
    expect(JSON.stringify(threadB.studioImpacts?.aggregated ?? []), "the two active selections differ")
      .not.toBe(JSON.stringify(threadA.studioImpacts?.aggregated ?? []));

    // 16 - Seal preview shows the Guardian consent summary
    const review = page.getByRole("button", { name: /Review|Seal|封存/ }).first();
    await expect(review).toBeVisible();
    await expect(review).toBeEnabled();
    await review.click();
    await expect(page.getByText(/Guardian|守护者/)).toBeVisible();

    // 17 - confirming the Seal puts the Guardian rail in place
    const confirm = page.getByRole("button", { name: /Confirm|确认封存|Seal it/ }).first();
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.locator(".lsGuardianRail")).toBeVisible();

    // 18 - ghost -> solid: the sealed Studio now drives a SOLID cross-goal group
    const sealedThread = await apiJson(page, "life-thread");
    expect(sealedThread.sealedStudioCount, "a sealed studio drives a solid impact").toBeGreaterThan(0);
    const solid = (sealedThread.studioImpacts?.aggregated ?? []).some((g: { state: string }) => g.state === "solid");
    expect(solid, "a solid cross-goal group exists after Seal").toBe(true);

    // 19 - reload restores the identical sealed moment + Guardian rail
    const railTextBefore = await page.locator(".lsGuardianRail").innerText();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".lsGuardianRail")).toBeVisible();
    expect(await page.locator(".lsGuardianRail").innerText(), "the rail text survives a reload").toBe(railTextBefore);
    const reThread = await apiJson(page, "life-thread");
    expect(reThread.sealedStudioCount, "sealed count survives a reload").toBe(sealedThread.sealedStudioCount);

    // 20 - Memory Scrubber replays Before / After; no h-scroll; one screenshot
    const scrub = page.getByText(/Memory Scrubber|记忆回溯器/);
    await expect(scrub).toBeVisible();
    await scrub.click();
    await expect(page.locator(".lsScrubTable, .lsScrubDrawer")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no h-scroll (${project})`).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(screenshotName(s.hash, project), { fullPage: true, maxDiffPixelRatio: 0.03 });
  });
}
