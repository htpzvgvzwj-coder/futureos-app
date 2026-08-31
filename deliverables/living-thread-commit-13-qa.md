# Living Thread — E2E / a11y / visual QA

## What is in the repo now

| Artifact | Path | Runs here? |
|---|---|---|
| Deterministic E2E user + 9 reality paths + storageState | `scripts/seed-e2e-user.mjs` (`npm run test:e2e:seed`) | **yes** (needs `.env`) — already run once against Neon |
| Playwright config (320 / 390 / desktop, auto-uses `e2e/.auth/user.json`) | `playwright.config.ts` | needs a browser |
| 12-point causal-spine walk per Studio | `e2e/flagship-studios.spec.ts` | needs a browser |
| Visual-regression screenshots — light/dark × EN/ZH × reduced-motion × {320,390,desktop} | `e2e/visual-regression.spec.ts` | needs a browser |
| Static a11y / responsive contract check (source-level) | `tests/flagship-a11y-contract.test.mjs` | **yes** — part of `npm test` |
| npm scripts | `test:e2e`, `test:e2e:seed`, `test:e2e:install`, `test:e2e:update-snapshots` | — |

The seeded user `e2e@futureos.test` and its nine plan reality paths now
exist in the shared DB (the seed script is idempotent). `e2e/.auth/` and
`e2e/report/` are **gitignored** — the storageState holds a live session
token and must not be committed.

## The 12 checks the spec asks for (per Studio, in `flagship-studios.spec.ts`)

1. move a core variable → 2. figures recompute immediately →
3. Fork creates a real branch → 4. a second Fork + Compare shows both,
only the active one drives the thread → 5. the `/api/<studio>` impactSet
tags every affected goal with a typed `unit` + a valid `direction` →
6. `allocationLegs` per-leg: `confirmedAfter` is null for any unfunded
leg → 7. Seal preview shows the Guardian summary → 8. Seal confirm →
9. the `.lsGuardianRail` watch strip appears in place →
10. reload restores the same sealed moment → 11. the Memory Scrubber
replays Before/After → 12. no horizontal body scroll at 320 / 390.

## To produce the acceptance artifacts (browser machine)

```bash
npm run test:e2e:install                 # one-time
npm run test:e2e:seed                    # writes e2e/.auth/user.json (needs .env)
npm run dev &                            # app on 127.0.0.1:3000
npm run test:e2e                         # E2E + first screenshot baselines
```

First run writes `e2e/*-snapshots/*.png` and `e2e/report/`. Attach the
report + the `mobile-320` / `mobile-390` PNGs to the PR. Until then
`node scripts/studio-matrix.mjs` keeps `mobile_a11y` UNMET for all nine
Studios (it checks for the artifacts on disk), so the matrix reads
**0/9 complete** and the PR stays Draft.

## Static checks that already pass here (`npm test`)

- every flagship scene exposes a `role="slider"` handle with
  `aria-valuenow` / `aria-valuetext` + `aria-label`, an `onKeyDown` that
  responds to Arrow keys and calls `preventDefault()`;
- every flagship scene has a `prefers-reduced-motion: reduce` rule for
  its own class prefix in `app/globals.css`;
- every flagship scene renders an explicit Unknown / no-data path;
- wide content sits in an `overflow-x: auto` container.
