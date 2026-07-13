[Index](./00_README.md) | [Previous](./03_Build_With_Users.md) | [Next](./05_Build_With_Singapore.md)

# Build With OCBC

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.1.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Define how FutureOS uses OCBC's banking strengths without becoming a product sales engine.

## Scope
Applies to product matching, account context, execution flows, relationship manager escalation, auditability, and cross-product coordination.

## Product Belief
FutureOS is valuable because it can connect insight to trusted banking context and approved execution. Without OCBC, it becomes another external AI advisor.

## Required Behaviours
- Start from the customer outcome, not the product to sell.
- Use banking data advantages responsibly.
- Connect recommendations to suitability reasoning.
- Coordinate products across goals.
- Keep product conflicts visible.
- Prepare applications only when the customer understands the reason.
- Audit product recommendations and execution steps.

## Forbidden Behaviours
- No product recommendation without suitability reasoning.
- No recommendation that harms protected goals.
- No product claims without verification before production.
- No hidden product prioritisation.
- No using fear to sell protection or credit.

## Design Implications
- Product suggestions should appear as support paths inside a goal, not as ads.
- Show why a product category may help and what risk it introduces.
- Keep OCBC service flows calm and professional.

## AI Implications
- AI must distinguish prototype references from verified production product facts.
- AI must explain product fit and product conflict.
- AI must know when relationship manager review is needed.

## Banking Implications
- OCBC provides account context, transaction context, execution advantages, trust, regulation, product orchestration, and Relationship Manager escalation.
- Categories include savings and deposits, credit cards, payments, loans and mortgages, investments and wealth, insurance, and relationship manager support.

## Engineering Implications
- Product catalogue data should be separate from AI prompts.
- Recommendation logic should support policy checks and audit logs.
- Execution flows need status, consent, failure, and rollback states.

## Examples
- A Goal Wallet suggestion can use deposits and automated transfers to support a declared goal.
- Insurance readiness can recommend a review without claiming a specific policy is suitable.

## Anti-Patterns
- FutureOS begins with Which OCBC product can we sell?
- An investment product appears because the customer has high savings but ignores emergency fund weakness.
- A mortgage suggestion appears before affordability and readiness are explained.

## Decision Checklist
- [ ] What outcome is the customer trying to achieve?
- [ ] Why is OCBC needed?
- [ ] What product category is relevant?
- [ ] What suitability reason is shown?
- [ ] What protected goal could be harmed?

## Phase 2 Implications
- Build a product orchestration layer inside Guardian and Future Mirror, not as a new top-level system.
- Prototype product references must be marked as prototype until verified.

## Future Evolution
- Future production versions require product, legal, risk, compliance, and data review before real recommendations.

## Revision Notes



## Core Rule
FutureOS never begins with the question: Which product can we sell?

It begins with: What outcome is the customer trying to achieve?

## Prototype Product Categories
| Category | Prototype role | Production requirement |
| --- |--- |--- |
| Savings and deposits | Goal Wallets, emergency fund protection, automated transfers. | Verify product terms and transfer rules. |
| Credit cards | Responsible credit planning and spending pattern visibility. | Avoid encouraging debt that harms protected goals. |
| Payments | PayNow, GIRO, scheduled transfers, spending flow context. | Confirm integration and consent requirements. |
| Loans and mortgages | Home readiness and affordability preparation. | Require suitability, affordability, and policy review. |
| Investments and wealth | Long-term growth and allocation readiness. | Require risk profiling and regulated advice boundaries. |
| Insurance | Family protection readiness and review prompts. | Require human or licensed review where needed. |
| Relationship manager support | Escalation for complex or high-stakes decisions. | Define eligibility and handoff standards. |

## Product Conflict Rules
FutureOS must know when not to recommend a product. A bank-grade product engine is defined as much by restraint as by matching.

| Conflict condition | Product rule | Required explanation |
| --- | --- | --- |
| Emergency fund is below target | Do not prioritise high-risk investment top-ups over emergency liquidity. | Explain that liquidity protects near-term resilience before growth. |
| Goal horizon is under 12 months | Do not use volatile assets as the primary funding source. | Explain short horizon and capital preservation needs. |
| Credit card or unsecured debt is high | Do not recommend new discretionary credit as the first solution. | Explain debt pressure and repayment priority. |
| Insurance gap exists | Do not automatically recommend the highest-premium product. | Explain coverage need, affordability, and review requirement. |
| Mortgage readiness is weak | Do not push a loan application before affordability is improved. | Explain debt servicing, down payment, and stability gaps. |
| Product benefit conflicts with a protected goal | Do not hide the conflict. | Show the supported goal, harmed goal, and alternative option. |
| Customer has rejected similar advice repeatedly | Do not repeat the same recommendation without revision. | Explain what has changed or switch to a lighter intervention. |
| Data is insufficient for suitability | Do not present the product as suitable. | Request missing information or escalate to human review. |

## Product Suitability Evidence
Every product recommendation must include a visible evidence stack. Product matching is not complete until the system can answer these fields.

| Evidence field | Required answer |
| --- | --- |
| Goal supported | Which customer goal does this product category support? |
| Customer data used | Which profile, account, transaction, goal, or preference data influenced the recommendation? |
| Suitability reason | Why is this product category relevant now? |
| Product risk | What risk, cost, lock-in, volatility, debt, or liquidity issue may arise? |
| Alternative considered | What lower-risk, lower-cost, or non-product alternative was considered? |
| Product conflict check | Which protected goals were checked for conflict? |
| Expected impact | What changes for the goal if the customer accepts? |
| Limitation | What is not known or not guaranteed? |
| Human review requirement | Is Relationship Manager, licensed advisor, or policy review required? |

## OCBC Product Orchestration Workflow
Product orchestration must happen inside the three-system architecture.

| Step | Owning system | Output |
| --- | --- | --- |
| Detect need | Life Graph | Detected need, evidence, urgency, affected goals. |
| Simulate effect | Future Mirror | Scenario impact before and after product support. |
| Check conflicts | Future Self Guardian | Protected goal conflict check and liquidity check. |
| Match category | Future Self Guardian | Product category, not unverified product claim. |
| Explain suitability | Future Self Guardian | Evidence stack, limitation, alternatives. |
| Request consent | Future Self Guardian | Approval to prepare, apply, book, or execute. |
| Escalate if required | Relationship Manager or licensed review | Human handoff with reason and summary. |
| Monitor outcome | Guardian Memory and Monthly Report | Whether the product path helped the goal. |

## Product Recommendation States
| State | Meaning | Allowed action |
| --- | --- | --- |
| Not applicable | Product category does not support the goal. | Do not show as recommendation. |
| Watch | Product may become relevant later. | Show as future readiness note only. |
| Explore | Product category may help, but data is incomplete. | Ask for more context or show education. |
| Prepare | Customer appears ready to review. | Prepare checklist or appointment. |
| Recommend review | Product category is relevant but needs human or policy review. | Offer Relationship Manager or licensed review. |
| Ready for consent | Action is clear, low-risk, and within rules. | Ask for approval. |
| Blocked | Conflict, missing consent, or risk prevents recommendation. | Explain why and show alternatives. |

## Customer Relationship Maintenance
OCBC should use FutureOS to maintain trust, not only deepen product holdings.

- If FutureOS avoids recommending a product because it would harm a protected goal, that restraint should be visible.
- If a recommendation requires human review, the handoff should preserve context so the customer does not repeat the full story.
- If the customer rejects a product path, FutureOS should remember the reason and avoid pushing the same path until conditions change.
- If a product is adopted, FutureOS must monitor whether it continues to support the original goal.
- If a product becomes unsuitable due to life change, FutureOS must surface a review instead of silently leaving the product in the plan.

## Engineering Contract For Product Matching
- Product catalogue, eligibility, risk labels, and suitability rules must be data-driven and versioned.
- Product matching logic must not be embedded only in prompt text.
- Every product recommendation event must include suitability evidence, conflict result, and consent state.
- Prototype product references must carry a `prototype_reference` flag.
- Production product recommendations require verified product data, policy review, and audit logs.
- Product recommendation UI must support `not recommended` and `blocked` states, not only positive matches.

---

[Index](./00_README.md) | [Previous](./03_Build_With_Users.md) | [Next](./05_Build_With_Singapore.md)
