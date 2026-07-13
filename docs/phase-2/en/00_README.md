[Index](./00_README.md) | Previous | [Next](./01_FutureOS_Product_Constitution.md)

# Reading Guide

| Document status | Phase 2 Bible draft |
| --- | --- |
| Version | 2.0.0-draft |
| Owner | FutureOS product, AI, design, banking, and engineering teams |
| Last updated | 2026-07-13 |

## What This Bible Is
The Phase 2 Bible is the operating system for building OCBC FutureOS after the first prototype foundation. It is not a feature backlog, marketing deck, school report, or static design note. It is the shared decision system for product, AI, design, banking, compliance, and engineering teams.

FutureOS is an AI-native life management layer inside an OCBC-style mobile banking experience. Its purpose is to move banking from managing products to managing customer life outcomes.

## Who Should Read It
- Product teams deciding what FutureOS should become next.
- Designers shaping mobile flows, trust surfaces, and relationship moments.
- AI teams defining agent behaviour, confidence, memory, uncertainty, and escalation.
- Banking teams connecting deposits, cards, loans, wealth, insurance, payments, and relationship support.
- Engineers protecting architecture, data boundaries, localisation, and auditability.
- Demo teams preparing a clear story for judges, stakeholders, or internal sponsors.

## How This Differs From Requirements
Requirements say what to build. This Bible explains why a feature deserves to exist, what risk it introduces, what architecture it belongs to, and how it must behave when the customer is under financial pressure.

## How This Differs From Design Documentation
Design documentation defines screens and interaction details. This Bible defines the deeper product logic behind those screens: customer relationship, AI accountability, OCBC relevance, Singapore context, and future resilience.

## Mandatory Documents For Product Decisions
Before any meaningful Phase 2 feature is accepted, the team must read:
- [01 FutureOS Product Constitution](./01_FutureOS_Product_Constitution.md)
- [02 Build With AI](./02_Build_With_AI.md)
- [03 Build With Users](./03_Build_With_Users.md)
- [04 Build With OCBC](./04_Build_With_OCBC.md)
- [10 Feature Evaluation Framework](./10_Feature_Evaluation_Framework.md)
- [11 Product Decision Records](./11_Product_Decision_Records.md)

## Reading Order
| Order | Document | Use |
| --- |--- |--- |
| 00 | [Reading Guide](./00_README.md) | Foundation |
| 01 | [FutureOS Product Constitution](./01_FutureOS_Product_Constitution.md) | Foundation |
| 02 | [Build With AI](./02_Build_With_AI.md) | Foundation |
| 03 | [Build With Users](./03_Build_With_Users.md) | Foundation |
| 04 | [Build With OCBC](./04_Build_With_OCBC.md) | Foundation |
| 05 | [Build With Singapore](./05_Build_With_Singapore.md) | Foundation |
| 06 | [Build For The Future](./06_Build_For_The_Future.md) | Foundation |
| 07 | [Relationship And Shared Responsibility](./07_Relationship_And_Shared_Responsibility.md) | Operating model |
| 08 | [Guardian Operating Principles](./08_Guardian_Operating_Principles.md) | Operating model |
| 09 | [Product Development Standard](./09_Product_Development_Standard.md) | Operating model |
| 10 | [Feature Evaluation Framework](./10_Feature_Evaluation_Framework.md) | Operating model |
| 11 | [Product Decision Records](./11_Product_Decision_Records.md) | Operating model |
| 12 | [Phase 2 Roadmap](./12_Phase_2_Roadmap.md) | Reference |
| 13 | [Glossary](./13_Glossary.md) | Reference |
| 14 | [Change Log](./14_Change_Log.md) | Reference |

## One-Page Summary Of The Five Build Principles
| Principle | Meaning | Rejects |
| --- |--- |--- |
| Build with AI | AI must reason, simulate, explain, ask for consent, execute within approved limits, monitor, recover, and learn. | Decorative AI, fake intelligence, hardcoded recommendations. |
| Build with Users | FutureOS starts from user problems, editable goals, recovery after setbacks, and respect for different life stages. | One universal life journey, judgmental language, forced positivity. |
| Build with OCBC | Meaningful features must connect to banking data, trusted execution, responsible product orchestration, and auditability. | External-advisor behaviour with no banking advantage. |
| Build with Singapore | The product must understand SGD, CPF, HDB, BTO, PayNow, GIRO, multilingual needs, PDPA awareness, and local family responsibilities. | Generic global fintech assumptions. |
| Build for the Future | Architecture must support new goals, models, regulations, life stages, regional expansion, and long-term relationship memory. | Prototype logic tied to one persona or one scenario. |

## Product Decision Records
Product Decision Records, or PDRs, are required for architecture changes, new top-level systems, changes to AI autonomy, new product recommendation logic, new scoring methods, new data categories, and any customer-facing execution behaviour.

Each PDR must record context, options, decision, rationale, reversibility, risk, success criteria, and review date. PDRs prevent FutureOS from becoming a feature collection without a memory of why decisions were made.

## English And Chinese Alignment
English files are the working source for international product, design, and engineering discussion. Chinese files are the matching Simplified Chinese operating version for bilingual review and presentation. Updates should preserve semantic alignment, not word-for-word literal translation.

## Ownership, Versioning, And Review Cadence
- Owner: FutureOS product strategy.
- Review cadence: weekly during hackathon build, monthly during sustained development.
- Versioning: major for philosophy or architecture changes, minor for new principles or frameworks, patch for clarification.
- Amendment process: open a PDR, propose the change, review affected docs, update English and Chinese counterparts, and record the change in [14 Change Log](./14_Change_Log.md).

---

[Index](./00_README.md) | Previous | [Next](./01_FutureOS_Product_Constitution.md)
