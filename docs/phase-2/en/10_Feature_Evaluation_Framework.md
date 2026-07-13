[Index](./00_README.md) | [Previous](./09_Product_Development_Standard.md) | [Next](./11_Product_Decision_Records.md)

# Feature Evaluation Framework

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Provide a scoring framework for accepting, revising, or rejecting FutureOS features.

## Scope
Applies to new ideas, Phase 2 workstreams, demo features, AI behaviours, product flows, and banking execution capabilities.

## Product Belief
Feature quality must be judged by outcome value, trust, explainability, OCBC advantage, and future usefulness, not by novelty alone.

## Required Behaviours
- Score every proposed feature from 0 to 5 across all criteria.
- Record assumptions, missing evidence, and required PDRs.
- Reject features that weaken consent, explainability, or architecture even if they look impressive.

## Forbidden Behaviours
- No feature passes only because it is visually impressive.
- No AI feature passes if it cannot explain itself.
- No banking feature passes if it is not goal-linked.
- No autonomy feature passes without guardrails.

## Design Implications
- High-scoring features should be easy to understand in the UI.
- Low explainability requires redesign before implementation.

## AI Implications
- AI-native value must measure whether AI reasoning is necessary.
- Data availability and confidence must be explicit.

## Banking Implications
- OCBC-specific value and regulatory feasibility are separate criteria.
- A feature may be strategically valuable but not currently feasible.

## Engineering Implications
- Technical feasibility and scalability must include maintainability and auditability.
- Data availability should not be assumed.

## Examples
- Guardian Memory scores high on relationship, long-term usefulness, and differentiation.
- Generic AI chat scores low because it duplicates chatbot behaviour and weakens architecture.

## Anti-Patterns
- Choosing features by demo drama only.
- Accepting product recommendations without suitability reasoning.
- Treating research-required features as existing.

## Decision Checklist
- [ ] Is the score documented?
- [ ] Are low-scoring criteria addressed?
- [ ] Does the feature need a PDR?
- [ ] Is consent clear?
- [ ] Is it owned by one core system?

## Phase 2 Implications
- Use this framework to choose between deeper simulation, Guardian Memory, product orchestration, and autonomy features.

## Future Evolution
- The scoring criteria may evolve, but user control, trust, and life outcome impact should remain core.

## Revision Notes
- Scoring is a decision aid, not a substitute for judgment.


## Scoring Criteria
| Criterion | 0 means | 5 means |
| --- |--- |--- |
| User problem severity | No clear problem. | Painful, frequent, or high-stakes problem. |
| AI-native value | AI is decorative. | AI reasoning is essential. |
| OCBC-specific value | Could be any app. | Requires banking context or execution. |
| Singapore relevance | Generic global assumption. | Strong local context. |
| Life outcome impact | No meaningful outcome. | Protects or improves a major life outcome. |
| Explainability | Cannot be explained. | Evidence, uncertainty, and logic are clear. |
| User control | User cannot control it. | User can edit, approve, pause, or reverse. |
| Trust impact | May reduce trust. | Strengthens trust through transparency. |
| Execution value | No action path. | Creates useful approved action. |
| Scalability | One-off demo logic. | Reusable across users and goals. |
| Technical feasibility | Not feasible now. | Buildable with current architecture. |
| Regulatory feasibility | Likely blocked. | Clear path with review. |
| Data availability | Data unavailable. | Data available or safely mockable. |
| Product differentiation | Common feature. | Distinctive FutureOS advantage. |
| Long-term usefulness | Only demo value. | Useful across years. |

## Thresholds
- Pass: 58 or higher, with no score below 3 for explainability, user control, trust, and consent-related execution.
- Revise: 42 to 57, or any critical criterion below 3.
- Reject: below 42, or any feature that violates the constitution.

## Feature Review Template
| Field | Entry |
| --- |--- |
| Feature name | Name of proposed feature. |
| Owning system | Life Graph, Future Mirror, or Future Self Guardian. |
| Problem | User problem and evidence. |
| Score | 0-75 total plus critical notes. |
| Consent model | No action, approval required, or autonomous guardrail. |
| Risks | User, AI, banking, regulatory, engineering. |
| Decision | Pass, revise, reject. |
| Required PDR | Yes or no. |

## Example Scores
| Feature | Likely decision | Reason |
| --- |--- |--- |
| Generic AI chat | Reject | Weak architecture fit and low OCBC-specific value. |
| Goal Wallet | Pass | Clear outcome, banking execution value, and explainability. |
| Future simulation | Pass | Strong AI-native and life outcome value. |
| Product recommendation | Revise | Must prove suitability and goal link. |
| Autonomous Goal Lock | Revise | High value but requires guardrails, consent, and logs. |
| Guardian Memory | Pass | Strong relationship and long-term usefulness. |
| Relationship Manager booking | Pass | Useful escalation path if triggered by clear need. |
| AI life-event detection | Revise | Valuable but privacy, uncertainty, and consent must be clear. |

---

[Index](./00_README.md) | [Previous](./09_Product_Development_Standard.md) | [Next](./11_Product_Decision_Records.md)
