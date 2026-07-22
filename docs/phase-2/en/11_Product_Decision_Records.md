[Index](./00_README.md) | [Previous](./10_Feature_Evaluation_Framework.md) | [Next](./12_Phase_2_Roadmap.md)

# Product Decision Records

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-21 |

## Purpose
Create a reusable decision memory system for FutureOS.

## Scope
Applies to architecture changes, feature acceptance, autonomy, scoring, data use, product logic, and top-level system boundaries.

## Product Belief
A serious AI banking product needs memory of why decisions were made, not only what was shipped.

## Required Behaviours
- Record PDRs for architecture decisions, new top-level systems, autonomy changes, product recommendation logic, score calculations, new data categories, and execution flows.
- Link PDRs to affected principles and review dates.

## Forbidden Behaviours
- Do not change core architecture silently.
- Do not add a fourth top-level system without PDR approval.
- Do not leave decision rationale only in chat or presentation notes.

## Design Implications
- PDR outcomes should influence UI language and hierarchy.
- Rejected decisions should still be remembered to prevent repetition.

## AI Implications
- AI behaviour changes must include risk, reversibility, confidence, and logging decisions.

## Banking Implications
- Product, execution, and escalation decisions must include banking impact and audit needs.

## Engineering Implications
- PDRs should be stored in Git and referenced by feature documentation.
- Implementation should link to decision IDs where relevant.

## Examples
- PDR-001 protects the three-system architecture.
- PDR-008 requires all scores to explain calculation and meaning.

## Anti-Patterns
- A team reintroduces Goal Negotiator as a new tab because the old rationale was lost.
- A score formula changes without changelog or review.

## Decision Checklist
- [ ] Does this change architecture?
- [ ] Does it affect consent?
- [ ] Does it affect AI autonomy?
- [ ] Does it affect product recommendations?
- [ ] Is review date set?

## Phase 2 Implications
- Phase 2 must use PDRs to prevent feature sprawl.

## Future Evolution
- PDRs can evolve into formal governance records if FutureOS moves toward production.

## Revision Notes
- Initial PDR set captures decisions already made during Phase 1 refinement.


## PDR Template
| Field | Description |
| --- |--- |
| PDR ID | Unique identifier. |
| Title | Decision title. |
| Date | Decision date. |
| Status | Draft, accepted, superseded, rejected. |
| Owner | Decision owner. |
| Context | Background. |
| Problem | Problem being resolved. |
| Options considered | Alternatives reviewed. |
| Decision | Selected path. |
| Rationale | Why this path was chosen. |
| Principles affected | Build principles and constitutional rules. |
| User impact | Effect on customers. |
| Banking impact | Effect on OCBC flows. |
| AI impact | Effect on models or agent behaviour. |
| Data impact | Data required or changed. |
| Security impact | Security or privacy implications. |
| Risks | Known risks. |
| Reversibility | Rollback or migration path. |
| Success criteria | How decision is validated. |
| Review date | When it should be revisited. |

## Initial PDRs
| PDR | Decision | Status |
| --- |--- |--- |
| PDR-001 | FutureOS has three top-level systems only. | Accepted |
| PDR-002 | Life Graph owns customer understanding. | Accepted |
| PDR-003 | Future Mirror owns simulation and trade-offs. | Accepted |
| PDR-004 | Future Self Guardian owns monitoring and execution. | Accepted |
| PDR-005 | Old module names remain internal subsections. | Accepted |
| PDR-006 | Selected states use teal or green, not red. | Accepted |
| PDR-007 | All scenarios must be goal-dependent. | Accepted |
| PDR-008 | All scores require explanation. | Accepted |
| PDR-009 | User profile data drives outputs. | Accepted |
| PDR-010 | FutureOS uses SGD by default. | Accepted |
| PDR-011 | Autonomous actions require explicit guardrails. | Accepted |
| PDR-012 | Product recommendations must be goal-linked. | Accepted |
| PDR-013 | Life Graph reads customer data through a pluggable provider registry, not one hardcoded source. | Draft |

## PDR-013 Detail: Life Graph Data-Provider Abstraction

| Field | Detail |
| --- | --- |
| PDR ID | PDR-013 |
| Title | Life Graph reads customer data through a pluggable provider registry, not one hardcoded source. |
| Date | 2026-07-21 |
| Status | Draft - requires product/compliance owner review before Accepted. This record was drafted by an AI assistant working from the codebase and the Build For The Future principle; it has not been through legal or banking-governance review. |
| Owner | Unassigned - needs a named FutureOS product owner. |
| Context | Life Graph's "customer understanding" today has exactly one real source: `preferences.profile`, a plain object the customer fills in themselves, stored only in browser localStorage. Despite the "SGFinDex" framing used in product narrative and in `CrossBankDataScreen`'s cross-bank ideas, no external bank or aggregator has ever been connected in this prototype - those screens are explicitly disclosed concept previews using simulated data. A provider abstraction now exists in `app/page.jsx` (`LIFE_GRAPH_PROVIDERS` registry, one entry: `manualEntryProvider`, shape `{ id, labelKey, getProfile(preferences), getCustomGoals(preferences) }`), built specifically so a second real source could be added without rewriting the ~20 call sites that read through `getUserProfile()`/`getCustomGoals()`. |
| Problem | What would actually be required - technically, legally, and architecturally - to register a genuine second provider (real SGFinDex-style aggregation, or a specific bank/open-banking API), without violating existing constitutional principles (data responsibility before personalisation, consent before execution, auditability, "AI must avoid fabricated product facts")? |
| Options considered | (1) Direct SGFinDex integration - Singapore's real financial data exchange; requires a MAS-sanctioned data-sharing pathway and an actual OCBC-side agreement, not something obtainable inside a prototype. (2) A commercial open-banking aggregator (a Plaid-equivalent for SG, if one exists) - a lower integration barrier than bank-by-bank access, but still a real commercial agreement and API keys. (3) A sandbox/demo-mode second provider using a real aggregator's published sandbox environment (genuinely external data, but explicitly non-production) to prove the architecture end-to-end without needing production banking credentials. (4) Stay manual-entry-only and treat the registry as pure architectural readiness until a real partnership exists (current state, as of PDR-013's drafting). |
| Decision | Not yet decided - this PDR documents the requirements and gaps so option (3) (sandbox-mode second provider) can be evaluated as the lowest-risk next step, once a named owner reviews it. No code changes are implied by drafting this PDR. |
| Rationale | A hackathon/prototype context cannot obtain a real production banking data-sharing agreement, so any "real second provider" claim not backed by (1) or (2) would itself be a fabricated product fact - exactly what the Constitution forbids. Sandbox-mode integration is the only option that is both genuinely external and honestly available without a real partnership. |
| Principles affected | Build With OCBC (meaningful features must connect to real banking data, not external-advisor behaviour with no banking advantage); Data responsibility before personalisation; AI must avoid fabricated product facts; Auditability is part of the customer experience. |
| User impact | None today - no behaviour changes until a provider is actually added. If added, the customer would need an explicit, revocable consent flow before any external account is linked - this does not exist yet anywhere in the app (there is no auth/consent-grant system at all, per the existing multi-user gap noted in [[futureos_differentiation_strategy]]). |
| Banking impact | A real integration would put OCBC in the position of displaying and acting on another institution's data inside Guardian's recommendation logic - every number sourced this way must be visibly attributed to its provider (see Data impact) so a banker reviewing an escalation can tell OCBC-confirmed data from externally-reported data at a glance. |
| AI impact | Guardian's "AI touches zero numbers" discipline currently assumes all inputs are either the customer's own declared profile or OCBC's own confirmed savings-plan artifacts. It has no concept of data provenance or staleness. A real second provider requires extending that discipline: every computed number must carry a `source` tag (which provider it came from) and a `asOf`/`lastSyncedAt` timestamp, so Guardian never treats a 3-day-old externally-fetched balance as equivalent to a live, customer-just-confirmed number. |
| Data impact | New data categories: other institutions' account balances/transactions, read-only OAuth-style access tokens, consent scope and expiry, sync timestamps. None of this is modelled anywhere in the current schema (`scripts/migrate.sql`) - a real provider needs its own token-storage table with encryption at rest and an explicit revocation path, not an extension of `preferences.profile`. |
| Security impact | PDPA (Singapore's Personal Data Protection Act) compliance for any externally-sourced personal financial data; encrypted token storage; no persisting of raw third-party credentials; a working revoke-access flow (the current app's data model has no concept of "disconnect a data source" at all - `deleteLocalData()` only clears this browser's local state). |
| Risks | Regulatory risk (MAS/PDPA) if pursued for real; OCBC brand/liability risk if a third-party feed is stale or wrong and Guardian acts on it; added latency inside Guardian's compute path from a live network call; ongoing cost if a commercial aggregator is used. |
| Reversibility | High at the architecture level - a provider is just an entry in `LIFE_GRAPH_PROVIDERS`; removing one requires no changes to the ~20 downstream call sites. Reversibility is much lower at the data level once real external tokens/data have been stored - a real revoke-and-delete path must exist before a second provider ever goes live, not be added later. |
| Success criteria | A second provider can be registered by implementing the existing `{ getProfile, getCustomGoals }` shape (extended to async + provenance/staleness per the AI impact field above) with zero changes to existing call sites - this is mechanically testable once such a provider exists. |
| Review date | Not date-based - review when a real data-sharing conversation (SGFinDex, an aggregator, or a specific partner bank) is actually underway, not on a calendar. |

---

[Index](./00_README.md) | [Previous](./10_Feature_Evaluation_Framework.md) | [Next](./12_Phase_2_Roadmap.md)
