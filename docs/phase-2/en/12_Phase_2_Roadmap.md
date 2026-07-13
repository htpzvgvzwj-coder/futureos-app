[Index](./00_README.md) | [Previous](./11_Product_Decision_Records.md) | [Next](./13_Glossary.md)

# Phase 2 Roadmap

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## Purpose
Organise Phase 2 into workstreams that deepen FutureOS without duplicating modules.

## Scope
Applies to planned product, AI, design, banking, localisation, consent, and measurement work.

## Product Belief
Phase 2 should deepen the core systems and relationship model, not chase unrelated features.

## Required Behaviours
- Clearly distinguish existing, prototype, planned, research required, and future concept.
- Define objective, current state, target state, dependencies, deliverables, risks, success metrics, and exit criteria for each workstream.

## Forbidden Behaviours
- Do not present planned features as completed.
- Do not create new top-level systems.
- Do not hide research or compliance dependencies.

## Design Implications
- Roadmap work should map to visible user flows.
- Relationship and accountability should be designed as features, not text.

## AI Implications
- Agent behaviour should progress from explanation to governed autonomy.
- Goal-dependent simulation should replace static outputs.

## Banking Implications
- OCBC product orchestration must remain goal-first and suitability-aware.
- Execution flows require review before production claims.

## Engineering Implications
- Roadmap needs schemas for profile, goals, scenarios, actions, consent, memory, and reports.
- Measurement and logging are workstreams, not afterthoughts.

## Examples
- Guardian Memory is planned/prototype depending on current build state, not production memory.
- Autonomous Goal Lock is planned and requires consent review.

## Anti-Patterns
- A roadmap that lists screens without dependencies.
- Calling localStorage persistence production data architecture.
- Adding product names before verification.

## Decision Checklist
- [ ] Is the state label accurate?
- [ ] Is the owning system clear?
- [ ] Are risks named?
- [ ] Are exit criteria measurable?
- [ ] Are dependencies visible?

## Phase 2 Implications
- This document is the Phase 2 execution map.

## Future Evolution
- Later roadmaps should convert workstreams into release plans with PDR references.

## Revision Notes
- Status labels are intentionally conservative.


## Status Labels
- Existing: visible in the current prototype.
- Prototype: present as mock or local behaviour, not production integration.
- Planned: intended for Phase 2 build.
- Research required: needs discovery, policy, data, or technical validation.
- Future concept: useful direction beyond Phase 2.

## Workstreams
| Workstream | Objective | Current state | Target state | Key deliverables | Success metric | Exit criteria |
| --- |--- |--- |--- |--- |--- |--- |
| A. Relationship and shared responsibility | Make Guardian feel like a long-term partner. | Prototype concept. | Visible Shared Goal Contract and relationship report. | Contract, user rights, Guardian reputation, reset flow. | User understands what Guardian owns. | Contract and reset flow tested. |
| B. AI agent behaviour | Make agent loop structured and visible. | Prototype/mock. | Agent states and logs. | Observe-to-learn loop, autonomy levels, escalation. | Actions show state and reason. | All actions have consent state. |
| C. Live Life Graph | Make profile and goals drive outputs. | Editable profile exists. | Goal-dependent profile engine. | Profile schema, detected needs, evidence cards. | Outputs change with profile. | Multi-persona tests pass. |
| D. Goal-dependent Future Mirror | Replace fixed scenarios with dynamic simulation. | Prototype scenarios. | Inputs change score and timeline. | Scenario model, trade-offs, uncertainty. | Users understand consequences. | Scenario explanations complete. |
| E. Guardian accountability | Make Guardian auditable. | Action states exist in prototype. | History, memory, mistakes, monthly report. | Guardian log, report, recovery mode. | User can review decisions. | History covers recommendations and actions. |
| F. OCBC product orchestration | Connect goals to banking categories. | Prototype references. | Goal-first product pathways. | Product fit reasoning, Relationship Manager escalation. | Recommendations feel useful not salesy. | Product claims reviewed. |
| G. Singapore localisation | Make local context practical. | SGD and languages exist/prototype. | Singapore-aware planning context. | CPF/HDB/BTO context labels, PayNow/GIRO references. | Local context improves relevance. | Unimplemented integrations labelled. |
| H. Explainable AI | Make every score and recommendation provable. | Info modals/prototype. | Evidence stack for every AI output. | Calculation notes, confidence, uncertainty. | User can answer why. | No unexplained scores remain. |
| I. Privacy and consent | Make autonomy safe. | Settings prototype. | Consent ledger and guardrail limits. | Permission model, withdrawal, logs. | User knows what is allowed. | Level 4/5 flows have limits. |
| J. Product measurement | Measure life outcome value. | Not formalised. | Outcome and trust metrics. | Metrics map, failure signals, review cadence. | Team can judge impact. | Metrics linked to features. |

---

[Index](./00_README.md) | [Previous](./11_Product_Decision_Records.md) | [Next](./13_Glossary.md)
