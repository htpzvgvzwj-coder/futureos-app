# Living Thread — Commit 13: E2E / a11y / visual QA

## What is in the repo now

| Artifact | Path | Runs here? |
|---|---|---|
| Playwright config (320 / 390 / desktop projects) | `playwright.config.ts` | needs a browser |
| Flagship-Studio E2E (native scene, keyboard slider, BranchStrip, no h-scroll, EN/ZH) | `e2e/flagship-studios.spec.ts` | needs a browser |
| Visual-regression screenshots — light/dark × EN/ZH × reduced-motion × {320,390,desktop} | `e2e/visual-regression.spec.ts` | needs a browser |
| Static a11y / responsive contract check (source-level) | `tests/flagship-a11y-contract.test.mjs` | **yes** — part of `npm test` |
| npm scripts | `test:e2e`, `test:e2e:install`, `test:e2e:update-snapshots` | — |

## What still has to be produced on a browser-capable machine

The Draft PR's acceptance matrix (Part O item 10) asks for **real 320/390 px
screenshots (light/dark, EN/ZH, reduced-motion)** and a green **Playwright
E2E** run. Those cannot be generated in this environment — the
browser-automation harness is not connected and there is no headless
Chromium. To finish item 13:

```bash
npm run test:e2e:install                 # one-time
E2E_STORAGE_STATE=./e2e/.auth/user.json \  # a logged-in Playwright storageState
E2E_BASE_URL=http://127.0.0.1:3000 \
  npm run dev &                           # app on 127.0.0.1:3000
npm run test:e2e                          # E2E + first screenshot baselines
```

First run writes the baselines under
`e2e/*.spec.ts-snapshots/` and an HTML report under `e2e/report/`.
Attach the report + the `mobile-320` / `mobile-390` PNGs to the PR.

## Static checks that already pass here (`npm test`)

- every flagship scene exposes a `role="slider"` handle with
  `aria-valuenow` + `aria-label`, an `onKeyDown` handler that responds to
  Arrow keys and calls `preventDefault()`;
- every flagship scene has a `prefers-reduced-motion: reduce` rule for its
  own class prefix in `app/globals.css`;
- every flagship scene renders an explicit Unknown / no-data path (never a
  fabricated figure);
- wide content sits in an `overflow-x: auto` container so the body never
  scrolls sideways at 320 px.
