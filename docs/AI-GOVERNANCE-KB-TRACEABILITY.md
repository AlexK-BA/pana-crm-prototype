# AI Governance, Knowledge-Base Traceability and Human Handoff

Status: implemented prototype contract, 2026-10-02. This is a product/technical compliance baseline, not legal advice or a declaration of conformity.

## 1. Goal and boundaries

The CRM may use AI only for administrative, non-clinical conversation support: clinic/service information, routing, appointment administration and transfer to a human. It must not diagnose, recommend treatment, interpret medical documentation, decide urgency, or determine access to care. Those requests require human handoff.

The canonical ownership model remains unchanged: `Patient` is not `EngagementCase`; Medical CRM owns clinical facts; CRM owns operational cases/tasks/communications. AI output is an `Interaction`, never a Patient/medical field and never a source for silent Patient Matching.

## 2. Confirmed requirements

| ID | Requirement | Acceptance condition |
|---|---|---|
| AI-01 | Distinguish patient, employee, bot and system messages | `Interaction.senderKind` remains canonical and is rendered in every conversation view. |
| AI-02 | Trace a bot answer to KB evidence | Every new bot `Interaction` requires `AiResponseTrace`: run/model/policy/prompt versions plus citations or an explicit allowed no-source reason. |
| AI-03 | Preserve the evidence used at answer time | Citation includes stable source ID, title, source version, retrieval time and optional chunk/section/page/URI/relevance. A later KB edit does not rewrite the old trace. |
| AI-04 | Do not expose model chain-of-thought | Admin view shows evidence, versions, confidence and escalation reason only. Hidden reasoning is neither stored nor displayed. |
| AI-05 | Restrict detailed trace | `ai:trace_view` is separate from `communication:view`; default access is Admin only. Scoped projections strip `aiTrace` for all other roles. |
| AI-06 | Show bot activation countdown | Incoming supported-channel message creates one versioned `BotActivationSchedule` with `scheduledAt` and `dueAt`. UI derives countdown from `dueAt`; it is not a second timer truth. |
| AI-07 | Human answer cancels pending bot | Human send, takeover, pause, close or AI disable preserves and cancels the schedule with actor/time/reason and audit. |
| AI-08 | Enable/disable AI safely | Per-conversation override takes precedence over clinic/channel policy; disable moves the conversation to `bot_paused`. Only `ai:manage` may change it. |
| AI-09 | Configure general rules | `AiConversationPolicy` contains channel scope, delay, human SLA, non-clinical intended use and explicit handoff rules. Clinic policy overrides global policy. |
| AI-10 | Inform the patient | Bot trace requires `userDisclosureShown=true`; the channel adapter must show a clear AI disclosure from the start of the first AI interaction. |
| AI-11 | Human escalation | Patient request, medical-advice request, emergency language, no source, low confidence or bot-turn limit can require handoff. |
| AI-12 | Audit administrative controls | Policy change, per-thread toggle, timer scheduling/cancellation/activation, handoff and AI answer are typed audit events. |

## 3. Source-of-truth model

- `AiConversationPolicy`: tenant/clinic/channel configuration. Version increments on every accepted edit.
- `ConversationControl`: current conversation owner/mode plus optional per-conversation AI override.
- `BotActivationSchedule`: immutable scheduling history. Superseded and cancelled records remain; no deletion.
- `Interaction.aiTrace`: immutable evidence for exactly one AI answer.
- `AuditEvent`: administrative history, not a duplicate message store.

Precedence for AI availability:

1. explicit conversation override;
2. clinic + channel policy;
3. global + channel policy;
4. disabled when no policy applies.

Timer lifecycle:

1. Supported incoming message creates a pending schedule.
2. A newer incoming message cancels the old pending record and creates a new one.
3. Human answer/takeover, pause, close or disable cancels it.
4. When `dueAt` is reached and AI is still allowed, the conversation can become `bot_active`.
5. Production execution must be a backend job/queue (or n8n orchestration calling a protected backend command). The browser interval in this prototype is only an emulation and cannot be the production scheduler.

## 4. Human handoff policy

These triggers are conservative defaults, not Daniel-approved business SLAs:

- explicit request to talk to a human;
- medical advice, diagnosis, treatment-selection or document-interpretation request;
- emergency/urgent-health language;
- no authoritative KB source;
- confidence below configured threshold;
- configured number of consecutive bot answers reached.

The default prototype values are 120 seconds before bot activation and 300 seconds human-takeover SLA. Both are configuration awaiting business approval; they must not be treated as production commitments.

## 5. AI Act / data-protection assessment

Assessment date: 2026-10-02.

### Confirmed applicable baseline

- EU AI Act Article 50 transparency obligations apply from 2 August 2026. A person directly interacting with a chatbot must be informed clearly and distinguishably from the start of the first interaction that they are interacting with AI, unless it is obvious. The prototype therefore treats disclosure as a send precondition, not optional helper text.
- AI literacy obligations have applied since 2 February 2025. Operators, admins and content owners need role-appropriate training and documented operating rules.
- Health data are special-category/highly sensitive personal data. AI Act compliance does not replace GDPR legal basis, minimisation, retention, processor agreements, security, data-subject rights or DPIA analysis.

Official sources:

- European Commission, AI Act overview and application timeline: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission, Article 50 guidelines: https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems
- European Commission, Article 50 FAQ: https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- Regulation (EU) 2024/1689: https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng
- EDPB health-data overview: https://www.edpb.europa.eu/topics/specific-domains/health-and-research_en
- EDPB DPIA overview: https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en

### Classification boundary requiring legal confirmation

An administrative FAQ/routing assistant is not automatically a high-risk medical AI system. Classification must be reassessed before any feature changes its intended purpose toward diagnosis, clinical triage, treatment recommendation, interpretation of medical data, medical-device functionality or decisions affecting access to healthcare. Provider/deployer roles and upstream model/provider contracts must also be documented.

Before production, PaNa must complete and approve:

1. intended-purpose and prohibited-use statement;
2. provider/deployer and data-controller/processor map;
3. AI Act classification memo with legal counsel/DPO;
4. DPIA and records of processing where required;
5. approved patient-facing AI disclosure for every channel/language;
6. AI literacy/training evidence for admins/operators/KB owners;
7. KB owner, approval, expiry and rollback process;
8. model/vendor data-use, retention, location, subprocessor and security review;
9. incident/complaint/correction workflow and retention schedule;
10. production backend enforcement, logging and tests.

## 6. What the prototype now enforces

- A bot send without source evidence (or an explicit allowed no-source reason) is rejected.
- A bot send without patient-facing disclosure evidence is rejected.
- A human cannot send while the bot owns the thread; a bot cannot send unless it owns it.
- Detailed AI trace is removed from non-authorised scoped data, not merely hidden by CSS.
- Operators may read effective timing/handoff rules needed to understand the countdown; only `ai:manage` can mutate them.
- The demo contains one traceable Instagram AI answer to make the admin flow testable.
- AI control and policy commands require permissions and reasons.
- No real LLM, RAG index, KB retrieval API, background worker or persistence was added.

## 7. Open decisions

| Owner | Decision |
|---|---|
| Daniel | Delay per channel/business hours; human SLA; turn limit; which roles may enable/disable AI. |
| Paweł/medical owner | Exact non-clinical boundaries, emergency wording and mandatory escalation destinations. |
| DPO/legal | Classification, Article 50 disclosure text, DPIA, lawful basis, retention and vendor conditions. |
| Product/engineering | KB approval/versioning backend, model vendor, production scheduler, incident tooling and n8n responsibility boundary. |

## 7.1 Compliance Center boundary

The Admin UI may assemble a patient-facing AI/GDPR notice only from approved, versioned configuration. Runtime bot behaviour stays in `AiConversationPolicy`; the compliance configuration references that policy version and contains controller/DPO, purpose, data-category, retention, processor/transfer, rights and multilingual disclosure statements. Drafts are not patient-facing. Publication requires an approval reference and creates an immutable version. The system may format these fields deterministically on request, but an LLM must not invent or reinterpret legal grounds, vendors, retention or rights. See `PATIENT-APPOINTMENT-COMPLIANCE-UX-SPEC.md`.

## 8. n8n boundary

n8n may orchestrate retrieval, timers and provider calls, but it must not become another source of truth. It receives stable IDs and policy versions, calls authorised backend commands, and returns idempotency/correlation IDs. CRM/backend persists ConversationControl, schedules, Interaction trace and AuditEvent. A workflow edited in n8n cannot bypass RBAC, clinic scope, disclosure, trace validation or handoff rules.
