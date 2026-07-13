[Index](./00_README.md) | [Previous](./10_Feature_Evaluation_Framework.md) | [Next](./12_Phase_2_Roadmap.md)

# Product Decision Records

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

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

---

[Index](./00_README.md) | [Previous](./10_Feature_Evaluation_Framework.md) | [Next](./12_Phase_2_Roadmap.md)
