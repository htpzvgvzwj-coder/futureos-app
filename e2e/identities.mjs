// One E2E identity per (Studio domain x Playwright project).
//
// Each flagship spec Seals a real commitment, which persists. If the nine
// Studios (x three viewports = 27 runs) shared one account, run N would see
// run N-1's sealed cross-goal impact and the assertions would drift. So
// every (domain, project) pair gets its own seeded user, its own plan, its
// own branches / commitments / Guardian policy / Ledger, and its own
// Playwright storageState file. `scripts/seed-e2e-user.mjs` creates all of
// them; `e2e/global-setup.ts` fails the run if any is missing.
//
// Plain .mjs so both the Node seed script and the Playwright specs import
// the SAME source of truth.

export const PROJECTS = ["mobile-320", "mobile-390", "desktop"];

export const STUDIOS = [
  { name: "Home Horizon", hash: "homeHorizon", api: "home-horizon", domain: "home" },
  { name: "Safety Runway", hash: "emergencyRunway", api: "emergency-runway", domain: "emergency" },
  { name: "Debt Gravity", hash: "repaymentPath", api: "debt-gravity", domain: "loan" },
  { name: "Future-Day Loom", hash: "futureLifeTimeline", api: "future-day-loom", domain: "retirement" },
  { name: "Calendar Orbit", hash: "tripOrbit", api: "calendar-orbit", domain: "travel" },
  { name: "Capital Prism", hash: "capitalPaths", api: "capital-prism", domain: "investment" },
  { name: "Living Envelope", hash: "protectionEnvelope", api: "living-envelope", domain: "insurance" },
  { name: "Private Constellation", hash: "familyConstellation", api: "private-constellation", domain: "family" },
  { name: "Wedding Living Scene", hash: "weddingLivingPlan", api: "wedding-thread", domain: "wedding" },
];

export const UNITS = ["sgd", "sgd_per_month", "months", "percentage", "date_shift_months", "count"];

export function identitySlug(domain, project) {
  return `e2e-${domain}-${project.replace(/-/g, "")}`;
}
export function identityEmail(domain, project) {
  return `${identitySlug(domain, project)}@futureos.test`;
}
export function authFileFor(domain, project) {
  return `e2e/.auth/${domain}-${project}.json`;
}

export function allIdentities() {
  const out = [];
  for (const s of STUDIOS) {
    for (const project of PROJECTS) {
      out.push({
        domain: s.domain,
        project,
        slug: identitySlug(s.domain, project),
        email: identityEmail(s.domain, project),
        authFile: authFileFor(s.domain, project),
      });
    }
  }
  return out;
}

export function screenshotName(hash, project) {
  return `${hash}-${project}.png`;
}
