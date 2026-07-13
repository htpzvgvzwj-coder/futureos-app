[Index](./00_README.md) | [Previous](./06_Build_For_The_Future.md) | [Next](./08_Guardian_Operating_Principles.md)

# Relationship And Shared Responsibility

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.1.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Define the relationship model that lets FutureOS build trust with the user over time.

## Scope
Applies to Guardian behaviour, user rights, consent, memory, recovery, disagreement, performance reporting, and escalation.

## Product Belief
Relationship is not created by emotional copy. It is created when the system remembers, explains, protects, admits uncertainty, and respects customer control.

## Required Behaviours
- Use a Shared Goal Partnership model.
- Make user rights visible.
- Make Guardian obligations visible.
- Track Guardian reputation through behaviour.
- Support permission progression.
- Support mistake admission and strategy revision.
- Support conflict, recovery mode, goal abandonment, relationship reset, consent withdrawal, and human escalation.

## Forbidden Behaviours
- Shared responsibility must not mean AI legal liability, guaranteed outcomes, forced saving, emotional dependency, manipulation, or AI replacing customer judgment.
- Do not use affection to hide uncertainty.
- Do not punish users for disagreement.

## Design Implications
- Show relationship through contract, memory, reports, and action history.
- Use calm status language: observing, monitoring, at risk, recovery, awaiting approval.
- Make reset and withdrawal visible in settings.

## AI Implications
- Guardian must remember decisions, not just chats.
- Guardian must revise strategy when user priorities change.
- Guardian must admit when it previously overestimated confidence.

## Banking Implications
- OCBC maintains trust by making Guardian accountable, auditable, and bounded by banking rules.
- Relationship manager escalation should be framed as continuity of care.

## Engineering Implications
- Store consent, correction, action, and memory events separately.
- Build event logs that support monthly reports and relationship reputation.
- Support paused and withdrawn states.

## Examples
- If Karina rejects a spending guardrail, Guardian records the reason and proposes a lighter reminder later.
- If the customer withdraws consent, autonomous actions stop while read-only planning may continue if allowed.

## Anti-Patterns
- Guardian says I know what is best and executes.
- The app hides rejected recommendations.
- The AI acts disappointed or guilt-inducing.

## Decision Checklist
- [ ] Does the user own priorities?
- [ ] Does Guardian own monitoring and explanation?
- [ ] Can consent be withdrawn?
- [ ] Can disagreement be recorded?
- [ ] Is recovery supported?

## Phase 2 Implications
- Phase 2 should add Shared Goal Contract UI, Guardian reputation metrics, and relationship reset flows.

## Future Evolution
- Long-term relationship may support family/shared goals, but individual consent and boundaries remain mandatory.

## Revision Notes
- This is the main design innovation layer: FutureOS is not only intelligent; it is relationally accountable.


## Shared Goal Partnership
| User owns | Guardian owns |
| --- |--- |
| Priorities | Continuous planning |
| Final decisions | Monitoring |
| Consent | Risk detection |
| Personal values | Recovery planning |
| Goal changes | Explanation |
| Permission boundaries | Approved execution |
| Right to pause or withdraw | Decision memory and reporting |

## Relationship Maintenance Mechanisms
- Shared Goal Contract: a visible agreement between user and Guardian for each major goal.
- Trust Progression: Guardian starts with explanation, earns permission through accurate and respectful behaviour.
- Guardian Reputation: measured by accepted recommendations, corrected assumptions, avoided risks, recovery success, and consent respect.
- Monthly Relationship Report: shows what Guardian did, what changed, what it got wrong, and what needs review.
- Recovery Mode: helps the user after setbacks instead of abandoning the goal.
- Relationship Reset: lets the customer restart preferences, permissions, or goals without deleting the entire account story.

## Guardian Responsibility Ledger
Shared responsibility must be inspectable. Every protected goal should have a Guardian Responsibility Ledger.

| Ledger field | Meaning |
| --- | --- |
| Goal Mission | The customer outcome being protected, written in customer language. |
| Guardian Obligations | What Guardian must monitor, explain, review, and prepare. |
| Customer Obligations | What the customer agrees to decide, update, approve, or disclose. |
| Authorised Actions | Actions Guardian may prepare or execute within the current permission level. |
| Review Frequency | How often Guardian must review the goal. |
| Risk Thresholds | Conditions that trigger alert, recovery, or escalation. |
| Recovery Trigger | What counts as drift, missed target, overspending, stalled progress, or changed life context. |
| Performance Target | What Guardian is expected to improve or protect. |
| Current Status | Observing, on track, at risk, recovery, paused, completed, or abandoned. |
| Decision History | Approvals, rejections, corrections, plan changes, escalations, and outcomes. |

## Shared Goal Contract
A Shared Goal Contract is not a legal contract. It is the product mechanism that makes the relationship explicit.

| Contract section | Required content |
| --- | --- |
| Goal statement | What the customer wants and why it matters. |
| Priority level | Critical, important, flexible, experimental, or paused. |
| Protected boundaries | What should not be sacrificed without explicit review. |
| Guardian role | What Guardian will monitor and recommend. |
| Customer role | What the customer must approve, update, or decide. |
| Autonomy level | Current AI independence level for this goal. |
| Review rhythm | Weekly, monthly, quarterly, or event-triggered. |
| Escalation path | When Relationship Manager or human review is required. |
| Exit condition | What completes, pauses, resets, or abandons the goal. |

## Shared Goal Contract States
| State | Meaning | Guardian obligation |
| --- | --- | --- |
| Draft | Goal exists but lacks enough data or consent. | Ask only for necessary missing context. |
| Proposed | Guardian has suggested a plan. | Explain evidence, assumptions, and trade-offs. |
| Active | Customer accepted the plan. | Monitor, report, and detect drift. |
| At Risk | Threshold has been crossed. | Alert, explain impact, and generate recovery options. |
| Recovery | Customer approved or requested a revised plan. | Track recovery progress and adjust strategy. |
| Paused | Customer paused the goal or withdrew permission. | Stop action and preserve history. |
| Completed | Goal outcome is achieved. | Produce completion review and next-step options. |
| Abandoned | Customer intentionally stops pursuing the goal. | Record reason without judgment and protect remaining goals. |

## Trust Event Model
Guardian trust should move because of behaviour, not copywriting.

| Event | Trust impact | Required response |
| --- | --- | --- |
| Recommendation accepted and outcome improves | Increase trust for that goal category. | Record success and explain what worked. |
| Recommendation accepted but outcome is neutral | No automatic trust increase. | Monitor longer and explain uncertainty. |
| Recommendation rejected with reason | No trust penalty to customer. Guardian learns. | Store reason and revise future strategy. |
| Guardian detects risk early | Increase trust if alert was useful and timely. | Record lead time and outcome. |
| Guardian misses a material risk | Decrease trust and enter review. | Admit miss, explain cause, propose prevention. |
| Guardian recommends unsuitable or conflicting product | Decrease trust materially. | Remove recommendation, escalate review, revise rules. |
| Consent boundary is respected | Maintains or increases trust. | Log boundary and show customer control. |
| Consent boundary is violated | Critical trust failure. | Stop autonomy, notify customer, escalate review. |

## Permission Progression
Guardian should not receive Level 5 autonomy by default. Permissions must be earned.

| Permission stage | Requirement to unlock | Allowed behaviour |
| --- | --- | --- |
| Explain only | Customer enables analysis. | Explain evidence and possible outcomes. |
| Recommend | Profile and goals are sufficiently complete. | Recommend options without execution. |
| Negotiate | Customer has at least two competing active goals. | Show trade-offs and balanced plans. |
| Act with approval | Customer has accepted prior recommendations or explicitly authorises action preparation. | Prepare actions and execute only after approval. |
| Autonomous guardrails | Proven performance, explicit limits, no consent violations, sufficient data, and customer approval. | Execute pre-approved actions inside limits only. |

Eligibility for higher autonomy requires observed good performance, user approval, no consent violations, sufficient financial data, and clear reversibility or safety limits.

## When Users Reject Recommendations
Repeated rejection is not disobedience. It is product data.

- First rejection: ask for optional reason and offer a lighter alternative.
- Second similar rejection: reduce recommendation frequency and test whether the goal priority changed.
- Third similar rejection: move the strategy to review and ask whether the goal, budget, tone, or autonomy level should change.
- Rejection after negative experience: enter trust repair mode and explain what Guardian will change.
- Rejection due to values mismatch: update user preferences and do not frame the decision as financially irrational unless risk is severe.

## Mistake Admission And Trust Repair
Guardian must have a recovery protocol when it is wrong.

1. Name the mistake in plain language.
2. Explain what evidence or assumption caused it.
3. State what was affected.
4. Show whether any action was taken.
5. Stop or reverse action where possible.
6. Lower autonomy for the affected goal if needed.
7. Revise memory, rules, or thresholds.
8. Offer human review for high-impact cases.
9. Record the event in Guardian History and Monthly Report.

## Responsibility Boundary
Shared responsibility does not blur accountability.

| Area | Customer responsibility | Guardian responsibility | OCBC responsibility |
| --- | --- | --- | --- |
| Priorities | Decide what matters most. | Remember and respect priority order. | Provide safe systems for managing priorities. |
| Consent | Approve, reject, pause, or withdraw. | Never exceed current permission. | Enforce consent boundaries and audit logs. |
| Data accuracy | Correct known profile errors. | Flag missing or inconsistent data. | Protect data and clarify limitations. |
| Recommendations | Decide whether to accept. | Explain evidence, alternatives, and risks. | Ensure recommendation framework is responsible. |
| Execution | Approve material actions. | Execute only within approved limits. | Provide secure and auditable execution rails. |
| Recovery | Reconfirm goals or constraints. | Generate recovery options. | Support escalation and service continuity. |

---

[Index](./00_README.md) | [Previous](./06_Build_For_The_Future.md) | [Next](./08_Guardian_Operating_Principles.md)
