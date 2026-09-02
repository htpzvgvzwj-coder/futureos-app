import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STUDIOS, authFileFor } from "./identities.mjs";

// Living Thread - the real 320/390 screenshots the acceptance matrix asks
// for: light/dark x EN/ZH x reduced-motion x the viewport projects in
// playwright.config.ts. Each scene loads its own (domain x project)
// identity (no shared account). No skips.

test.use({ storageState: { cookies: [], origins: [] } });

const byHash = Object.fromEntries(STUDIOS.map((s) => [s.hash, s.domain]));

for (const colorScheme of ["light", "dark"] as const) {
  for (const reduced of [false, true]) {
    test.describe(`${colorScheme}${reduced ? " + reduced-motion" : ""}`, () => {
      test.use({ colorScheme, reducedMotion: reduced ? "reduce" : "no-preference" });
      for (const s of STUDIOS) {
        test(`snapshot #${s.hash}`, async ({ page, context }, testInfo) => {
          const state = JSON.parse(readFileSync(path.join(process.cwd(), authFileFor(byHash[s.hash], testInfo.project.name)), "utf8"));
          await context.addCookies(state.cookies);
          await page.goto(`/#${s.hash}`);
          await page.waitForSelector("h1");
          await expect(page).toHaveScreenshot(
            `${s.hash}-${testInfo.project.name}-${colorScheme}${reduced ? "-rm" : ""}.png`,
            { fullPage: true, maxDiffPixelRatio: 0.02 },
          );
        });
      }
    });
  }
}
