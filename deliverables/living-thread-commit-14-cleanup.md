# Living Thread — Commit 14: cleanup

## Done in this commit

### Old scene component files
All six PR#11 scene components were removed at the commit that replaced
them (not deferred to here):

| Old | Removed in | Replacement |
|---|---|---|
| `app/features/loan/RepaymentPath.jsx` | commit 4 | `DebtGravity.jsx` |
| `app/features/retirement/FutureLifeTimeline.jsx` | commit 5 | `FutureDayLoom.jsx` |
| `app/features/travel/TripOrbit.jsx` | commit 6 | `CalendarOrbit.jsx` |
| `app/features/investment/CapitalPaths.jsx` | commit 7 | `CapitalPrism.jsx` |
| `app/features/insurance/ProtectionEnvelope.jsx` | commit 8 | `LivingEnvelope.jsx` |
| `app/features/family/FamilyConstellation.jsx` | commit 9 | `PrivateConstellation.jsx` |

### Orphaned CSS
`app/globals.css`: **62 dead rules removed** (7115 → 7043 lines) — every
selector verified to (a) belong to one of the deleted components and (b)
have zero references in `app/**` or `lib/**`:

- `.pe*` (Protection Envelope) — Living Envelope uses `.le*`
- `.fc*` (Family Constellation + Blind Merge) — Private Constellation uses `.pc*`
- `.toNodeRing / .toNodeChip / .toNodeCtl / .toScene / .toCentre` (Trip Orbit
  tap-to-reveal) — Calendar Orbit uses `.co*`
- `.exploreFieldNode*` / `.exploreFieldGrid` / `.exploreFieldHead h1` /
  `.exploreFieldSub` / `.exploreFieldMore` / `.lifeEvidenceGo` / `.flDayNav`
  (the removed 7-node Explore grid + old Life panels)

The prune was mechanical and conservative: `@media` / `@supports` /
`@keyframes` blocks untouched; any rule with a non-class selector kept;
any class still referenced anywhere kept; template-literal class families
(`hhProv-${p}`, `cpBand-${id}`, `rwVerdict-${v}`, …) explicitly kept.

### Routes
No dead routes. The deleted scenes never had dedicated API routes (they
used `/api/future-field`); each flagship scene added its own
`/api/<studio>` route which is live.

## Deliberately NOT bundled here — Part 7 (`page.jsx` decomposition)

`app/page.jsx` is ~17.6k lines. Reducing it to < 400 lines + CSS Modules
is a large standalone refactor that would touch nearly every screen and
carries real regression risk against a **9/9-green** Draft PR. It is left
as a dedicated follow-up. Concrete plan:

1. `app/screen-registry.jsx` — move the `screens` enum + the
   `screenMap` dictionary (`[screens.X]: <Component/>`) out, taking
   `{ t, language, setActiveScreen, … }` as props.
2. One route file per top-level surface under `app/(surfaces)/…` (Today /
   Life / Explore / Guardian), each importing only the feature components
   it renders.
3. Move the remaining inline `<style>` / long `className` string builders
   into CSS Modules co-located with their feature.
4. Keep `page.jsx` as a thin shell: providers + the active-surface switch.

Each step is independently shippable and test-guarded; none of it changes
Studio behaviour.

## Remaining before Ready-for-Review

- Commit 13's Playwright E2E + real 320/390 screenshots
  (`deliverables/living-thread-commit-13-qa.md`) — needs a browser machine.
- Part 0 production-truth purge, Part 1 server-recompute-from-locked-branch
  + DB Seal-idempotency column, Part 2 canonical `currentMoment` rebuild,
  Part 3 `app/components/living-thread/*` SVG surface, Part 4 four-entrance
  rewrite — all still carried from the reinforced spec, none started.

The matrix (`node scripts/studio-matrix.mjs`) reads **9/9 complete,
11/11 contract slots**, but the PR **stays Draft**: the flip to Ready is
the user's call once the browser-machine QA and the carried Parts are
resolved.
