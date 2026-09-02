import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { allIdentities } from "./identities.mjs";

// Playwright globalSetup - seeds one deterministic E2E identity per
// (Studio domain x project) + its reality path + its storageState file.
// If this fails the ENTIRE run fails; the specs never silently skip for
// missing auth, and one run's Seal never pollutes another's account.
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  // The flagship-studios spec needs 27 seeded identities; the lean
  // usable-release spec registers its own users and does not. Allow
  // skipping the heavy seed.
  if (process.env.E2E_SKIP_SEED === "1") return;
  try {
    execFileSync(process.execPath, ["--env-file=.env", "scripts/seed-e2e-user.mjs"], {
      cwd: root,
      stdio: "inherit",
    });
  } catch (e) {
    throw new Error(`E2E seed failed - cannot run the suite without seeded identities + reality paths. ${(e as Error).message}`);
  }
  const missing = allIdentities()
    .map((id) => id.authFile)
    .filter((f) => !existsSync(path.join(root, f)));
  if (missing.length > 0) {
    throw new Error(`E2E seed ran but ${missing.length} storageState file(s) were not written: ${missing.join(", ")}`);
  }
}
