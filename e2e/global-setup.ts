import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Playwright globalSetup - seeds the deterministic E2E user + all nine
// reality paths + e2e/.auth/user.json. If this fails the ENTIRE run
// fails; the specs never silently skip for missing auth.
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  try {
    execFileSync(process.execPath, ["--env-file=.env", "scripts/seed-e2e-user.mjs"], {
      cwd: root,
      stdio: "inherit",
    });
  } catch (e) {
    throw new Error(`E2E seed failed - cannot run the suite without a seeded user + reality paths. ${(e as Error).message}`);
  }
  if (!existsSync(path.join(root, "e2e/.auth/user.json"))) {
    throw new Error("E2E seed ran but e2e/.auth/user.json was not written");
  }
}
