[Index](./00_README.md) | [Previous](./12_Phase_2_Roadmap.md) | [Next](./14_Change_Log.md)

# Glossary

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Define FutureOS terminology so product, AI, design, banking, and engineering teams use the same language.

## Scope
This glossary applies to all Phase 2 documents, prototype flows, pitch materials, PDRs, and future requirements.

## Product Belief
Consistent language protects architecture. If teams use different words for the same responsibility, features will drift and duplicate.

## Terms
| Term | Definition |
| --- |--- |
| FutureOS | An AI-native life management layer embedded inside an OCBC-style mobile banking experience. |
| AI-native Life Management | A system where AI continuously interprets profile, goals, risks, scenarios, and approved actions to protect life outcomes. |
| Life outcome | A meaningful customer result such as emergency resilience, family readiness, home readiness, investment growth, or retirement security. |
| Life Graph | The system that understands customer life stage, goals, accounts, products, risks, and financial behaviour. |
| Future Mirror | The system that simulates scenarios, trade-offs, future consequences, and uncertainty before decisions are made. |
| Future Self Guardian | The accountable AI agent that monitors, recommends, explains, prepares actions, and executes only within consent. |
| Goal Wallet | A goal-linked savings or allocation container used to protect a declared life outcome. |
| Goal readiness | A measure of how prepared the customer is to achieve a goal under current conditions. |
| Future Score | A explainable indicator of long-term financial health under a given scenario. |
| AI Confidence | The system's confidence in its analysis, separated from certainty. |
| Product Fit Score | A suitability-oriented indicator of how well a product category supports a declared goal. |
| Guardian Memory | Decision and event memory that helps Guardian improve recommendations over time. |
| Guardian Reputation | A trust signal based on accuracy, consent respect, correction handling, recovery success, and user acceptance. |
| Shared Goal Partnership | The relationship model where the user owns priorities and consent while Guardian owns monitoring and explanation. |
| Shared Responsibility | A bounded operating model, not a guarantee of outcomes or replacement of judgment. |
| Autonomous Guardrails | Pre-approved limits that allow Guardian to act within defined boundaries. |
| Autonomous Goal Lock | A planned guardrail that protects a goal from being undermined by conflicting spending or product decisions. |
| Recovery Mode | A Guardian state that helps restore progress after setbacks. |
| OCBC Product Matching | Goal-first matching of banking categories to customer needs with suitability reasoning. |
| Explainable AI | AI output that shows evidence, assumptions, uncertainty, and recommendation logic. |
| Life event | A meaningful change such as marriage, family planning, home purchase, career change, business startup, or retirement. |
| Financial DNA | A prototype concept for patterns in income, spending, saving, risk preference, goals, and behaviour. |
| Decision memory | Stored record of decisions, corrections, approvals, rejections, and outcomes. |
| Action Centre | The place where customers approve, modify, reject, or review Guardian actions. |
| Guardian Report | A periodic report showing progress, risks, actions, score changes, and recommendations. |
| Product orchestration | Coordinating savings, payments, credit, mortgage, wealth, and insurance around life goals. |
| Live profile | The current customer profile used to drive outputs. |
| Consent | Explicit permission for data use, recommendation, action preparation, or execution. |
| Reversibility | The ability to undo, pause, modify, or recover from an action where possible. |

## Required Behaviours
- Use these terms consistently.
- Do not rename top-level systems casually.
- Add new terms only when they clarify responsibility.

## Forbidden Behaviours
- Do not use old module names as competing top-level systems.
- Do not use autonomy terms without consent language.
- Do not use score terms without explanation.

## Decision Checklist
- [ ] Does the term already exist here?
- [ ] Does the term clarify a responsibility?
- [ ] Does it create a duplicate module?
- [ ] Does it need a PDR?

## Phase 2 Implications
- New feature proposals should reference glossary terms.
- Any new core term should be added to English and Chinese files together.

## Future Evolution
- Glossary should become a controlled vocabulary for design, code, analytics, and policy documentation.

## Revision Notes
- Initial glossary created for Phase 2 documentation system.

---

[Index](./00_README.md) | [Previous](./12_Phase_2_Roadmap.md) | [Next](./14_Change_Log.md)
