[Index](./00_README.md) | [Previous](./07_Relationship_And_Shared_Responsibility.md) | [Next](./09_Product_Development_Standard.md)

# Guardian Operating Principles

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.1.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Define Future Self Guardian as an accountable financial operator, not a decorative AI persona.

## Scope
Applies to monitoring, recommendations, recovery, execution, memory, states, outputs, escalation, and privacy.

## Product Belief
The Guardian earns trust by protecting declared goals, operating within limits, and remaining explainable under pressure.

## Required Behaviours
- Protect declared goals.
- Monitor continuously.
- Detect drift.
- Explain changes.
- Generate recovery options.
- Respect priority order.
- Avoid harmful product conflicts.
- Admit uncertainty.
- Admit mistakes.
- Maintain an audit trail.
- Stop when consent is withdrawn.
- Escalate when risk exceeds limits.
- Preserve emergency liquidity.
- Avoid excessive debt, unsuitable risk, and privacy overreach.

## Forbidden Behaviours
- Do not optimise one goal by silently damaging another.
- Do not execute without consent.
- Do not present confidence as certainty.
- Do not hide failed or rejected actions.
- Do not continue autonomous behaviour after withdrawal.

## Design Implications
- Guardian main page should be a clean hub; details live in focused screens.
- Use status badges and action states.
- Show what Guardian is doing now and what it will review next.

## AI Implications
- Guardian must choose strategies based on goal priorities and risk limits.
- Guardian must generate recovery options, not only ideal plans.
- Guardian must trigger escalation when outside safe autonomy.

## Banking Implications
- Guardian actions must align with OCBC product rules and customer consent.
- Emergency liquidity protection is a default constraint unless customer explicitly changes it.

## Engineering Implications
- Implement Guardian as a state machine with event logs.
- Separate recommendation outputs from execution commands.
- Support idempotency for action execution and review.

## Examples
- When spending exceeds safe budget, Guardian enters At Risk and then Awaiting Approval for a guardrail.
- After approval, Guardian enters Monitoring and records the action.

## Anti-Patterns
- Guardian is always Active without explaining current state.
- Guardian creates product recommendations without checking protected goals.
- Guardian cannot be paused.

## Decision Checklist
- [ ] What state is Guardian in?
- [ ] What output is generated?
- [ ] What goal is protected?
- [ ] What consent applies?
- [ ] What escalation rule exists?

## Phase 2 Implications
- Phase 2 should add explicit Guardian states, outputs, monthly reports, and action history.

## Future Evolution
- Guardian may become more autonomous, but only by earning permission and staying auditable.

## Revision Notes
- Guardian is a financial operator with boundaries, not a mascot.


## Guardian States
| State | Meaning | Required UI signal |
| --- |--- |--- |
| Observing | Reading profile and financial context. | Quiet monitoring label. |
| Planning | Building strategy options. | Planning status and expected output. |
| Monitoring | Tracking active goals and risk. | Monitoring badge. |
| At Risk | A goal or behaviour has crossed a threshold. | Risk explanation and affected goals. |
| Recovery | A setback requires revised plan. | Recovery options. |
| Awaiting Approval | Action is prepared but not executed. | Consent prompt. |
| Executing | Approved action is being performed. | Progress state and log. |
| Completed | Action finished. | Completion record. |
| Escalated | Human or policy review needed. | Escalation reason. |
| Paused | Consent withdrawn or customer paused Guardian. | Paused state and resume rules. |

## Guardian Outputs
- Recommendation
- Proposal
- Trade-off
- Recovery plan
- Action request
- Monthly report
- Decision review
- Goal completion review

## Guardian Accountability And Reputation Model
Guardian Reputation is not a personality score. It is an operational measure of whether Guardian deserves more trust for a specific goal category.

Reputation must be calculated per customer and per goal category. A Guardian may be trusted for spending guardrails but still restricted for investment rebalancing.

## Guardian Performance Metrics
| Metric | Definition | Direction |
| --- | --- | --- |
| Goal Protection Rate | Percentage of protected goals that remain within agreed thresholds during the review period. | Higher is better. |
| Goal Completion Support Rate | Percentage of completed goals where Guardian actions or recommendations materially supported progress. | Higher is better. |
| Drift Detection Lead Time | How early Guardian detects goal drift before a missed milestone or risk event. | Higher is better, if alerts are useful. |
| Recovery Plan Success Rate | Percentage of recovery plans that restore the goal to on-track status. | Higher is better. |
| Recommendation Acceptance Rate | Percentage of recommendations accepted or modified instead of skipped. | Contextual, not automatically higher is better. |
| Recommendation Outcome Accuracy | Percentage of accepted recommendations that produce the expected direction of impact. | Higher is better. |
| Unnecessary Intervention Rate | Percentage of alerts or recommendations the customer marks as not useful. | Lower is better. |
| Human Escalation Accuracy | Percentage of escalations judged appropriate by user, policy, or banker review. | Higher is better. |
| Consent Violation Count | Count of actions that exceeded or ignored consent boundaries. | Must be zero. |
| Strategy Revision Speed | Time required to revise a plan after correction, rejection, or life change. | Lower is better. |

## Reputation States
| State | Condition | Product behaviour |
| --- | --- | --- |
| Unproven | New goal, limited history, insufficient data, or newly reset relationship. | Explain only or recommend only. |
| Building Trust | Some useful recommendations, no consent issues, early monitoring accuracy. | Recommend and negotiate; action requires explicit approval. |
| Trusted | Consistent useful outcomes, timely drift detection, user accepts or constructively modifies advice. | Eligible for Level 4 actions with approval. |
| Highly Trusted | Strong performance across multiple cycles, no consent violations, stable data, user explicitly opts in. | Eligible for Level 5 guardrails within narrow limits. |
| Restricted | Repeated low usefulness, incorrect assumptions, or unresolved data issues. | Reduce intervention and require review before action. |
| Under Review | Possible harmful recommendation, missed material risk, or consent concern. | Freeze autonomy, escalate, and show review status. |

## Permission Progression Formula
Guardian may become eligible for higher autonomy only when all five conditions are met:

1. Observed good performance for the relevant goal category.
2. Explicit user approval for the next autonomy level.
3. Zero consent violations.
4. Sufficient and current financial data.
5. Clear limits, reversibility, or safety fallback.

If any condition fails, Guardian remains at the current autonomy level or moves down.

## Guardian Responsibility Ledger Events
Every Guardian action or inaction should map to a ledger event.

| Event type | Required fields |
| --- | --- |
| Monitoring event | Goal, threshold checked, result, timestamp, data source. |
| Risk event | Trigger, affected goals, severity, lead time, evidence. |
| Recommendation event | Options considered, selected strategy, confidence, alternatives, limitations. |
| Consent event | Consent type, scope, limits, duration, customer response. |
| Execution event | Approved action, status, product/service involved, rollback state. |
| Recovery event | Drift cause, recovery plan, customer choice, progress status. |
| Learning event | User correction, rejected assumption, strategy revision, reputation impact. |
| Escalation event | Reason, destination, summary shared, outcome. |

## State Transition Rules
| From | To | Trigger |
| --- | --- | --- |
| Observing | Planning | New goal, profile update, or detected need. |
| Planning | Awaiting Approval | Material action or strategy requires customer decision. |
| Monitoring | At Risk | Risk threshold crossed. |
| At Risk | Recovery | Customer accepts or requests revised plan. |
| Awaiting Approval | Executing | Customer gives explicit consent. |
| Executing | Completed | Action finishes and audit log is written. |
| Any active state | Paused | Consent withdrawn or customer pauses Guardian. |
| Any active state | Escalated | Risk exceeds autonomy, policy, or confidence limits. |
| Restricted | Building Trust | Customer review resolves issue and useful behaviour resumes. |
| Under Review | Restricted | Issue confirmed but recoverable. |
| Under Review | Paused | Consent issue or harmful recommendation remains unresolved. |

## Consent Violation Protocol
Consent violation is the most serious Guardian failure.

1. Stop the affected action immediately.
2. Notify the customer with plain language.
3. Record the event in Guardian History.
4. Move the relevant goal to Under Review.
5. Disable higher autonomy for the affected category.
6. Escalate to human, policy, or security review.
7. Explain remediation before autonomy can be restored.

## Monthly Guardian Report Requirements
The monthly report must make Guardian accountable, not merely encouraging.

It must include:
- Goals monitored.
- Risks detected.
- Alerts sent.
- Recommendations accepted, modified, rejected, and skipped.
- Actions executed with consent.
- Recovery plans created.
- Strategy changes and reasons.
- Score changes and drivers.
- Guardian mistakes, uncertainty, or unresolved issues.
- Reputation state changes.
- Next review date.

---

[Index](./00_README.md) | [Previous](./07_Relationship_And_Shared_Responsibility.md) | [Next](./09_Product_Development_Standard.md)
