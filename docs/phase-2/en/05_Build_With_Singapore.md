[Index](./00_README.md) | [Previous](./04_Build_With_OCBC.md) | [Next](./06_Build_For_The_Future.md)

# Build With Singapore

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Make FutureOS local-first for Singapore rather than a generic global fintech concept.

## Scope
Applies to currency, life events, payments, housing, retirement, multilingual support, privacy, regulation awareness, and family obligations.

## Product Belief
A life-outcome banking system must understand the local financial environment where the customer's life actually happens.

## Required Behaviours
- Use SGD as default currency.
- Account for Singapore cost-of-living context.
- Respect CPF, HDB, BTO, mortgage readiness, marriage, family planning, education, retirement, SRS, insurance expectations, multilingual needs, PDPA awareness, MAS governance awareness, PayNow, salary crediting, GIRO, regional travel, SME and intergenerational responsibilities.

## Forbidden Behaviours
- Do not claim CPF, HDB, MAS, PDPA, PayNow, or product integrations that are not implemented.
- Do not copy global assumptions into Singapore-specific decisions.
- Do not treat every customer as a young home buyer.

## Design Implications
- Use SGD consistently.
- Language switching must support English, Simplified Chinese, Bahasa Melayu, and Tamil.
- Local contexts should appear as practical planning signals, not policy essays.

## AI Implications
- AI should mark local context as current prototype, future possible integration, or requires legal review.
- AI must not fabricate government policy or product rules.
- AI should ask for uncertainty when local data is missing.

## Banking Implications
- OCBC relevance includes local payment behaviour, deposits, credit, mortgages, wealth, insurance, SME, and regional banking support.
- Human review is needed for regulated or high-stakes advice.

## Engineering Implications
- Localisation should avoid hardcoded strings and hardcoded SGD-only assumptions in global code paths.
- Policy-sensitive integrations need versioning and source verification.

## Examples
- A family planning simulation can include SGD childcare buffers as prototype assumptions.
- A home readiness flow can mention HDB/BTO context as planning context, not claim direct integration.

## Anti-Patterns
- FutureOS shows USD examples.
- The app says CPF has been integrated when it has not.
- The AI gives legal or policy advice without review.

## Decision Checklist
- [ ] Is SGD used?
- [ ] Is the Singapore context relevant?
- [ ] Is the claim implemented or clearly planned?
- [ ] Does this require legal or policy review?
- [ ] Are multilingual implications covered?

## Phase 2 Implications
- Phase 2 should make Singapore context visible in Life Graph and Future Mirror while keeping unimplemented integrations labelled.

## Future Evolution
- FutureOS may expand regionally, but Singapore remains the first local operating model.

## Revision Notes
- Local-first does not mean overloading the UI with policy detail. It means the system makes locally sensible assumptions.


## Current, Planned, And Review-Required Context
| Category | Current prototype | Future possible integration | Review required |
| --- |--- |--- |--- |
| SGD | Used as default display currency. | Multi-currency planning. | FX and disclosure review. |
| CPF | Mentioned as local context. | CPF-informed retirement planning. | Policy and data access review. |
| HDB/BTO | Used as planning context. | Readiness checklist and timeline model. | Housing policy review. |
| PayNow/GIRO | Shown as banking behaviour references. | Execution or transfer flows. | Integration and consent review. |
| PDPA/MAS | Governance awareness. | Formal compliance workflows. | Legal and compliance review. |

---

[Index](./00_README.md) | [Previous](./04_Build_With_OCBC.md) | [Next](./06_Build_For_The_Future.md)
