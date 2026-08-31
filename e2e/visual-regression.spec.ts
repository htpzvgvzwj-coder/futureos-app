import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

// Living Thread - the real 320/390 screenshots the acceptance matrix
// (Part O) asks for. Run on a browser-capable machine after
// `npm run test:e2e:seed`; the first run writes the baselines under
// e2e/*-snapshots/.
//
// light + dark x EN + ZH x reduced-motion is driven by the projects in
// playwright.config.ts plus the params below.
test.skip(!existsSync("e2e/.auth/user.json"), "run `npm run test:e2e:seed` first");

const SCENES = [
  "#homeHorizon", "#emergencyRunway", "#repaymentPath", "#futureLifeTimeline",
  "#tripOrbit", "#capitalPaths", "#protectionEnvelope", "#familyConstellation", "#weddingLivingPlan",
];

for (const colorScheme of ["light", "dark"] as const) {
  for (const reduced of [false, true]) {
    test.describe(`${colorScheme}${reduced ? " + reduced-motion" : ""}`, () => {
      test.use({ colorScheme, reducedMotion: reduced ? "reduce" : "no-preference" });
      for (const hash of SCENES) {
        test(`snapshot ${hash}`, async ({ page }, testInfo) => {
          await page.goto(`/${hash}`);
          await page.waitForSelector("h1");
          await expect(page).toHaveScreenshot(
            `${hash.slice(1)}-${testInfo.project.name}-${colorScheme}${reduced ? "-rm" : ""}.png`,
            { fullPage: true, maxDiffPixelRatio: 0.02 },
          );
        });
      }
    });
  }
}
