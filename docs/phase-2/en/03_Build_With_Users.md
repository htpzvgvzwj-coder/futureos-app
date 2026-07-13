[Index](./00_README.md) | [Previous](./02_Build_With_AI.md) | [Next](./04_Build_With_OCBC.md)

# Build With Users

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Make FutureOS user-problem-first instead of feature-first.

## Scope
Applies to profile, goals, language, accessibility, scenarios, recovery, and user testing.

## Product Belief
The customer is not a data object. FutureOS must build a relationship by respecting personal priorities, corrections, setbacks, and changing life stages.

## Required Behaviours
- No feature without a verified user problem.
- User goals must be editable.
- User profile must drive outputs.
- Support custom goals.
- Support different ages, income levels, relationships, risk profiles, and life stages.
- Respect financial literacy differences.
- Make every score understandable.
- Make every action reversible where possible.
- Design for incomplete profiles and conflicting goals.

## Forbidden Behaviours
- Assuming one universal life journey.
- Judgmental language.
- Forced positivity.
- Treating ignored recommendations as user failure.
- Locking outputs to a fixed persona.
- Hiding why a recommendation changed.

## Design Implications
- Use plain language before technical detail.
- Show edit controls for profile and goals.
- Support recovery paths after setbacks.
- Make progress feel supportive, not performative.

## AI Implications
- AI should ask for missing context only when necessary.
- AI should learn from user corrections.
- AI should avoid moral judgement about spending.

## Banking Implications
- Banking support should respect the customer's stated priorities.
- Product matching must not override declared goals.
- Relationship manager escalation should be framed as support, not sales pressure.

## Engineering Implications
- Profile-driven outputs should be testable with multiple personas.
- Custom goals require flexible data models.
- Local persistence should preserve user preferences without pretending to be production storage.

## Examples
- If Karina changes family planning priority, Future Mirror should update scenario impact.
- If a user skips a guardrail, Guardian should offer a lighter recovery option later.

## Anti-Patterns
- Every user receives the same wedding/home simulation.
- A score says poor discipline without explaining the calculation.
- A skipped action disappears without future recovery.

## Decision Checklist
- [ ] Is the user problem verified?
- [ ] Can the user edit the goal?
- [ ] Does the output change when profile changes?
- [ ] Is the language respectful?
- [ ] Is there a recovery path?

## Phase 2 Implications
- Phase 2 should add richer custom goals, user correction loops, and relationship memory.
- User testing should include different life stages, not only Karina.

## Future Evolution
- FutureOS should support family/shared goals, temporary setbacks, and changing customer identity over many years.

## Revision Notes
- Relationship is demonstrated through behaviour: remembering, explaining, recovering, and respecting consent.


## Required Feature Discovery Template
| Field | Required answer |
| --- |--- |
| User problem | What real customer difficulty does this address? |
| User segment | Who experiences this and under what life stage? |
| Evidence | What observation, interview, prototype test, or banking pattern supports it? |
| Current workaround | How does the customer manage this today? |
| Why current solution fails | What is confusing, manual, delayed, or risky? |
| FutureOS response | How do Life Graph, Future Mirror, or Guardian help? |
| Risks | What could go wrong for trust, privacy, or finances? |
| Success metric | What customer outcome improves? |
| Failure metric | What signal means the feature harms or confuses users? |
| Ethical considerations | Could this pressure, shame, or manipulate the customer? |
| OCBC relevance | Why is a bank uniquely positioned to help? |
| Singapore relevance | What local context matters? |

---

[Index](./00_README.md) | [Previous](./02_Build_With_AI.md) | [Next](./04_Build_With_OCBC.md)
