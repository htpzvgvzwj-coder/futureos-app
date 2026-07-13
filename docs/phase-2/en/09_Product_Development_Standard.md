[Index](./00_README.md) | [Previous](./08_Guardian_Operating_Principles.md) | [Next](./10_Feature_Evaluation_Framework.md)

# Product Development Standard

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Define the complete operating process for creating a FutureOS feature.

## Scope
Applies from idea discovery through implementation, monitoring, review, and deprecation.

## Product Belief
A FutureOS feature is not ready because it looks good. It is ready when it solves a real user problem, fits the architecture, respects trust, and can be audited.

## Required Behaviours
- Every feature must have owner, problem statement, target user, expected outcome, non-goals, data dependencies, AI role, banking role, risk level, consent model, success metrics, failure criteria, rollback plan, and documentation update.
- Every feature must pass product, AI, user, OCBC, Singapore, data, consent, explainability, security, and measurement review.

## Forbidden Behaviours
- Do not build from UI inspiration alone.
- Do not add features that bypass the three-system architecture.
- Do not ship scoring without explanation.
- Do not ship action flows without consent and rollback thinking.

## Design Implications
- Prototype must include empty, loading, success, failure, recovery, and changed-preference states.
- Design must show what system owns the feature.

## AI Implications
- AI role must be explicit: explain, recommend, negotiate, act with approval, or operate guardrails.
- AI outputs must be structured and testable.

## Banking Implications
- OCBC relevance must be documented.
- Product and service execution must be auditable and bounded.

## Engineering Implications
- Data requirements, schema, persistence, event logs, permissions, and rollback must be defined before implementation.
- Documentation updates are part of done.

## Examples
- A Guardian Memory feature must specify memory event schema, consent boundary, edit/delete rules, and monthly report impact.
- A Future Mirror simulation must specify input fields, scenario model, score explanation, and uncertainty.

## Anti-Patterns
- A new card appears on Home but does not connect to Life Graph, Future Mirror, or Guardian.
- A feature uses mock data but claims production integration.
- A CTA works visually but has no status or history.

## Decision Checklist
- [ ] Has the user problem been validated?
- [ ] Which system owns it?
- [ ] What data is required?
- [ ] What consent is required?
- [ ] How is success measured?
- [ ] How is failure handled?

## Phase 2 Implications
- Phase 2 should use this standard before adding deeper AI or banking flows.

## Future Evolution
- This process should become a lightweight governance model for production discovery.

## Revision Notes
- Documentation is a delivery artifact, not a post-launch cleanup task.


## Development Stages
| Stage | Review question |
| --- |--- |
| 1. Problem discovery | What real customer problem is being solved? |
| 2. Evidence review | What evidence supports the problem? |
| 3. Product fit assessment | Why does this belong in FutureOS? |
| 4. Principle assessment | Which build principles apply? |
| 5. Life Graph impact | What customer understanding changes? |
| 6. Future Mirror impact | What simulation or trade-off changes? |
| 7. Guardian impact | What monitoring or action changes? |
| 8. OCBC relevance | Why is the bank needed? |
| 9. Singapore relevance | What local context matters? |
| 10. Data requirements | What data is used and why? |
| 11. Consent requirements | What permission is needed? |
| 12. Explainability requirements | How is the output explained? |
| 13. Security review | What can go wrong? |
| 14. Prototype | Can the behaviour be demonstrated? |
| 15. User testing | Did users understand and trust it? |
| 16. Decision review | What decision is recorded? |
| 17. Implementation | Is it built within architecture? |
| 18. Monitoring | What logs and metrics exist? |
| 19. Post-launch review | Did the feature improve outcomes? |
| 20. Deprecation or expansion | Should it continue, change, or stop? |

---

[Index](./00_README.md) | [Previous](./08_Guardian_Operating_Principles.md) | [Next](./10_Feature_Evaluation_Framework.md)
