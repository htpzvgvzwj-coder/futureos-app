[Index](./00_README.md) | [Previous](./13_Glossary.md) | Next

# Change Log

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.1.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Record documentation changes so FutureOS has a clear operating history.

## Scope
Applies to Phase 2 Bible updates, principle changes, PDR additions, roadmap changes, and terminology updates.

## Semantic Documentation Versioning
| Version type | Meaning | Example |
| --- |--- |--- |
| Major | Philosophy, architecture, or governance change. | Adding a fourth top-level system. |
| Minor | New principle, workstream, framework, or PDR set. | Adding Guardian Reputation framework. |
| Patch | Clarification, correction, link fix, or wording improvement. | Clarifying SGD default wording. |

## Version 2.1.0-draft
Date: 2026-07-13

Deepened the Phase 2 Bible from a principle outline into a more operational system specification.

Affected documents:
- Build With AI.
- Build With OCBC.
- Relationship And Shared Responsibility.
- Guardian Operating Principles.
- Change Log.

Added:
- Agent Stage Specification with inputs, outputs, tools, risk level, consent, audit, fallback, and escalation rules.
- Agent Output Contract for engineering teams.
- Guardian Responsibility Ledger for each protected goal.
- Shared Goal Contract states and responsibility boundaries.
- Guardian Trust Event Model, mistake admission, and trust repair rules.
- Guardian Accountability and Reputation Model.
- Guardian Performance Metrics and reputation states.
- Permission progression formula for higher autonomy.
- Product Conflict Rules to prevent unsuitable banking recommendations.
- Product Suitability Evidence requirements for OCBC product orchestration.
- Consent Violation Protocol and Monthly Guardian Report requirements.

Decision:
- The Bible should define mechanisms, states, formulas, ledgers, workflows, evidence, and failure handling, not only product philosophy.
- Chinese documentation must remain a semantic counterpart of the English documentation, not a shortened summary.

## Version 2.0.0-draft
Date: 2026-07-13

Initial Phase 2 documentation system created.

Included:
- Initial Phase 2 structure.
- Five build principles.
- Shared responsibility framework.
- Guardian operating model.
- Feature evaluation framework.
- Product decision record system.
- Phase 2 roadmap workstreams.
- English and Simplified Chinese documentation sets.

## Required Behaviours
- Update this file whenever documentation meaning changes.
- Use PDRs for architecture or autonomy changes.
- Keep English and Chinese counterparts aligned.

## Forbidden Behaviours
- Do not change principles silently.
- Do not update only one language version for major changes.
- Do not treat changelog as release marketing.

## Decision Checklist
- [ ] Is this major, minor, or patch?
- [ ] Are affected files listed?
- [ ] Is a PDR required?
- [ ] Are English and Chinese files aligned?

## Phase 2 Implications
- Changelog becomes the product memory for documentation, just as Guardian Memory becomes product memory for customer decisions.

## Future Evolution
- Later versions may split changelog by documentation, product prototype, and deployed release.

## Revision Notes
- Created as part of Phase 2 Bible draft.

---

[Index](./00_README.md) | [Previous](./13_Glossary.md) | Next
