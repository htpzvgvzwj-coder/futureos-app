[Index](./00_README.md) | [Previous](./01_FutureOS_Product_Constitution.md) | [Next](./03_Build_With_Users.md)

# Build With AI

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.1.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Define what AI-native means for FutureOS and prevent AI from becoming decoration.

## Scope
Applies to agent reasoning, simulation, memory, scoring, recommendations, autonomy, and human escalation.

## Product Belief
FutureOS should use AI because the customer problem requires reasoning over changing life context, not because AI is fashionable.

## Required Behaviours
- AI must reason, not decorate.
- AI must update from live profile and banking context.
- AI must support planning, monitoring, recovery, and execution.
- AI must explain uncertainty.
- AI must distinguish prediction from fact.
- AI must adapt to custom goals.
- AI must use memory of decisions, not only conversations.
- AI must learn from user corrections.
- AI must expose confidence.
- AI must detect when human escalation is required.

## Forbidden Behaviours
- Hardcoded recommendations presented as intelligence.
- Fabricated OCBC product facts.
- Financial projections presented as guaranteed outcomes.
- AI language that hides missing data.
- One-size-fits-all advice based on a fixed persona.

## Design Implications
- AI outputs must appear as evidence cards, scenarios, decision panels, confidence labels, and consent prompts.
- Do not use chatbot bubbles as the main interface.
- Show when AI is observing, recommending, awaiting approval, or monitoring.

## AI Implications
- Agent loop: Observe, Understand, Model, Simulate, Negotiate, Recommend, Explain, Request Consent, Execute, Monitor, Recover, Learn, Repeat.
- Memory should store meaningful decisions, corrections, consent events, and outcomes.
- The model must be able to say it does not know.

## Banking Implications
- AI can prepare banking actions only when the action is allowed by consent and product rules.
- Product facts must come from verified sources before production.
- High-risk recommendations require human or policy escalation.

## Engineering Implications
- AI outputs need structured schemas for scores, confidence, reasons, risks, actions, consent, and logs.
- Separate prompt logic from product rules.
- Maintain replayable decision logs for audit and debugging.

## Examples
- For SGD 450 overspending, AI should show observed spending, safe budget, affected goals, recommendation, confidence, and consent request.
- For a custom family goal, AI should adapt the scenario instead of forcing a home-purchase template.

## Anti-Patterns
- A button labelled Ask AI that returns generic advice.
- A scenario card that ignores changed profile data.
- Autonomous action without visible limits or logs.

## Decision Checklist
- [ ] Does AI use live profile context?
- [ ] Does it explain uncertainty?
- [ ] Can the user correct it?
- [ ] Is consent required before action?
- [ ] Can the output be audited?

## Phase 2 Implications
- Phase 2 should replace static mock reasoning with structured, profile-driven reasoning flows.
- AI independence levels must become visible and testable.

## Future Evolution
- The architecture should allow model replacement without rewriting product policy.
- Future agents may specialise, but Guardian remains accountable to the customer-facing outcome.

## Revision Notes
- AI-native means reasoning plus responsibility, not AI-themed UI.


## AI Independence Levels
| Level | Allowed actions | Consent | Reversibility | Visibility | Escalation |
| --- |--- |--- |--- |--- |--- |
| Level 1 - Explain | Explain possible outcomes and evidence. | No execution consent needed. | No action taken. | Advice label visible. | Escalate if user requests regulated advice. |
| Level 2 - Recommend | Compare options and recommend one. | Consent needed before any action. | Recommendation can be ignored. | Confidence and reason visible. | Escalate for high uncertainty. |
| Level 3 - Negotiate | Balance competing goals and propose trade-offs. | Consent needed before applying plan. | Plan can be edited. | Trade-off panel visible. | Escalate when goals conflict with risk rules. |
| Level 4 - Act with Approval | Prepare action plan and execute only after approval. | Explicit action consent required. | Rollback path required where possible. | Action Centre log visible. | Escalate for high-value or irreversible actions. |
| Level 5 - Autonomous Guardrails | Execute pre-approved actions within limits. | Prior guardrail consent required. | Pause and review must be available. | Autonomy badge, limits, and logs visible. | Stop when limits, risk, or consent boundaries are reached. |

## Logging Requirements
- Every recommendation must log input summary, confidence, uncertainty, options considered, selected strategy, consent status, and user response.
- Every Level 4 or Level 5 action must log the approved limit, execution status, rollback state, and monitoring outcome.

## Agent Stage Specification
FutureOS must treat the AI agent loop as an operational contract, not a concept diagram. Each stage has defined inputs, outputs, consent expectations, audit requirements, fallback behaviour, and escalation conditions.

| Stage | Input data | Output | User consent | Audit required | Failure fallback | Human escalation trigger |
| --- | --- | --- | --- | --- | --- | --- |
| Observe | Profile, accounts, balances, transactions, goals, preferences, notification settings, consent state. | New event signal or no-change signal. | Existing data-use consent. | Yes. | Mark signal as incomplete and request missing data only if necessary. | Missing consent, suspicious data, or possible fraud indicator. |
| Understand | Observed event, Life Graph profile, goal priorities, product context. | Interpreted customer situation and affected goals. | Existing analysis consent. | Yes. | Show limited-confidence interpretation. | Ambiguous customer intent or high-stakes goal impact. |
| Model | Customer profile, assumptions, thresholds, risk preferences, historical decisions. | Structured planning model with assumptions. | No new consent unless new data category is needed. | Yes. | Use conservative defaults and label assumptions. | Missing critical input for affordability, suitability, or protection. |
| Simulate | Model, goal timelines, spending and saving patterns, scenario parameters. | Future paths, score changes, risk and trade-off estimates. | No execution consent. | Yes. | Show scenario as estimated, not guaranteed. | Projection affects regulated advice or high-value decision. |
| Negotiate | Scenarios, declared priorities, protected goals, product conflicts. | Balanced strategy and trade-off explanation. | Consent only if applying strategy. | Yes. | Offer lower-risk alternatives. | Strategy sacrifices a protected or higher-priority goal. |
| Recommend | Strategy, confidence, risk limits, customer history, product suitability evidence. | Recommendation with reason, confidence, alternatives, and limitations. | No execution consent. | Yes. | Recommend human review or gather missing data. | Low confidence, product suitability uncertainty, or vulnerable customer signal. |
| Explain | Evidence, assumptions, score drivers, uncertainty, affected goals. | Human-readable explanation and proof stack. | No execution consent. | Yes. | Provide "what we know / what we do not know" summary. | Customer disputes evidence or asks for regulated explanation. |
| Request Consent | Proposed action, limits, reversibility, risks, expected impact. | Consent prompt, modify option, reject option, skip option. | Explicit consent required. | Yes. | Keep recommendation pending and do not execute. | Customer confusion, high-risk action, or irreversible action. |
| Execute | Approved action, consent scope, product rules, guardrails. | Banking instruction, scheduled task, goal update, or service request. | Explicit action or guardrail consent. | Yes. | Stop execution, show failure state, preserve prior state. | Execution failure, policy breach, limit breach, or potential harm. |
| Monitor | Active actions, goals, thresholds, progress, drift signals. | Status update, alert, or no-change event. | Existing monitoring consent. | Yes. | Lower autonomy and request review if data is stale. | Repeated drift, consent expiry, or unexplained data change. |
| Recover | Goal drift, failed action, rejected advice, missed target, life change. | Recovery options and revised strategy. | Depends on action. | Yes. | Offer lowest-risk recovery and schedule review. | Recovery requires credit, investment, insurance, or mortgage advice. |
| Learn | User correction, approval, rejection, outcome, escalation result. | Updated memory, confidence adjustment, strategy revision. | Existing memory consent. | Yes. | Store as unresolved learning item. | User flags recommendation as wrong or harmful. |

## Agent Output Contract
Every material AI output must be structured enough for product, design, and engineering teams to inspect. Free-text alone is not acceptable.

| Output field | Required meaning |
| --- | --- |
| `event_type` | What changed: spending drift, goal progress, risk threshold, profile update, consent change, product readiness, or user correction. |
| `customer_context` | The profile, goal, or account context used. |
| `evidence` | The facts used, such as SGD amount, goal progress, target date, account balance, or user preference. |
| `assumptions` | Any estimated values or default rules. |
| `affected_goals` | Goals improved, protected, delayed, or put at risk. |
| `confidence` | Confidence level and reason. |
| `uncertainty` | What the system does not know. |
| `recommendation` | Proposed strategy or next step. |
| `alternatives` | At least one lower-risk or user-controlled alternative for material decisions. |
| `consent_required` | Whether no consent, review consent, action consent, or guardrail consent is required. |
| `reversibility` | Whether the action can be undone, paused, modified, or only reviewed. |
| `audit_log_id` | Reference to the decision log. |
| `escalation_required` | Whether human, policy, product, or compliance review is required. |

## AI Failure Modes
FutureOS must design for AI failure before autonomy increases.

| Failure mode | Product response | Autonomy impact |
| --- | --- | --- |
| Missing data | Show limited confidence and request only necessary missing input. | No increase in autonomy. |
| Conflicting goals | Enter negotiation mode and show trade-offs. | Action requires approval. |
| Low confidence | Recommend review or ask for clarification. | Restrict to Level 1 or Level 2. |
| Customer rejects recommendation | Record reason, revise strategy, reduce intervention frequency if pattern repeats. | No penalty to customer. |
| Incorrect recommendation | Admit error, explain correction, revise memory, and lower Guardian reputation for that goal. | Freeze higher autonomy until reviewed. |
| Product fact uncertainty | Do not recommend product; show category-level guidance only. | Human or product review required. |
| Consent boundary reached | Stop action immediately and show reason. | Move Guardian to Paused or Awaiting Approval. |

## Engineering Contract
The AI layer must be testable without relying on visual inspection of screens.

- Agent stages must emit structured events.
- Every recommendation must be replayable from recorded inputs and assumptions.
- The UI may summarise reasoning, but the underlying decision object must retain full evidence.
- Prompt text must not contain final banking policy. Product rules, consent limits, and escalation rules must live outside prompt copy.
- Mock data must be labelled as prototype data and separated from future production data interfaces.
- Model replacement must not change product contracts, consent boundaries, or audit fields.
- Automated tests should include at least three personas, three goal types, missing data, rejected advice, and withdrawn consent.

## Relationship Between AI And Guardian
AI is the reasoning capability. Guardian is the accountable customer-facing operator. This distinction matters.

- AI may generate options.
- Guardian selects what to present based on obligations, permissions, and protected goals.
- AI may calculate confidence.
- Guardian decides whether confidence is high enough to act.
- AI may learn from feedback.
- Guardian must explain what changed and why.

If a model output conflicts with Guardian obligations, Guardian obligations win.

---

[Index](./00_README.md) | [Previous](./01_FutureOS_Product_Constitution.md) | [Next](./03_Build_With_Users.md)
