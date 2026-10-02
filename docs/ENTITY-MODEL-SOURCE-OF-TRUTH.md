# Entity model and source-of-truth rules

## Prototype source of truth

The prototype has one canonical operational model:

- domain contracts: `lib/crm/entities.ts`;
- seeded entity records: `lib/crm/entity-data.ts`;
- runtime state and mutations: `lib/crm/entity-store.tsx`;
- clinic-scoped reads: `lib/crm/scoped-entity-store.ts`;
- task priority and SLA calculations: `lib/crm/entity-queue.ts`;
- cross-entity projections: `lib/crm/entity-selectors.ts`;
- user identities, presentation metadata and telephony extensions: `lib/crm/user-catalog.ts`;
- mutable user lifecycle state: `lib/crm/user-directory.tsx`;
- atomic permission definitions and defaults: `lib/crm/permissions.ts`;
- runtime permission bundles: `lib/crm/authorization-context.tsx`.

The former parallel `CrmCase`, `CASES`, `queue.ts`, `Operator` seed and legacy case card have been removed. Active screens must not recreate flat copies of Patient, EngagementCase or Task data.

## Entity ownership

| Fact | Canonical owner |
|---|---|
| Patient identity and medical link | `Patient` |
| Phone, e-mail or social identifier | `ContactIdentity` |
| One treatment/sales/contact intent | `EngagementCase` |
| Required next action, deadline and priority | `Task` |
| Message, SMS, note or call | `Interaction` / `SmsMessage extends Interaction` / `Call` |
| Internal discussion | `Comment` |
| Immutable change history | `AuditEvent` |
| User account, roles and clinic scope | `AppUser` / `UserDirectory` |
| Role capabilities | `Permission` / runtime role bundle |

Derived cards, queue rows, badges and counters are selectors or views. They are never independent mutable business records.

## Production mapping guardrail

The Next.js `EntityStore` is the behavioral source of truth for the prototype, not a replacement production database. Production implementation must map these contracts onto the existing architecture:

- Frappe/MariaDB remains the CRM/operator system of record;
- PaNa Medical CRM remains authoritative for patient and clinical facts;
- FastAPI/Mongo/Redis remains responsible for the existing chat and realtime domains described in the current architecture;
- external telephony, SMS and Medical CRM systems connect through provider adapters;
- every backend mutation repeats tenant/clinic authorization and writes an audit event.

No implementation may introduce a second backend-owned Patient, Case or Task record merely to satisfy one screen. Integration projections must retain the external identifier, provenance, synchronization state and conflict state.

## Change rule

When adding a screen or integration:

1. reuse a canonical entity and store mutation;
2. add a selector when a different presentation is required;
3. add a new entity only when lifecycle, ownership and audit semantics differ;
4. update this document, the relevant module specification and UAT in the same commit;
5. reject UI-local arrays that become independently mutable copies of domain data.


## SMS Stage 1 ownership

Patient-level SMS may omit `caseId`; Calls and non-SMS send commands retain a case. SMS is stored exactly once in `EntityStore.interactions`. Patient history, case timeline and Inbox are projections, not replicated message stores. `sms-service.ts` holds configuration defaults and the stateless adapter contract; delivery transitions and retry writes belong to EntityStore. The scoped store reuses runtime permissions and UserDirectory for SMS action/scope guards. Configuration drafts in the settings form are unsaved form state, not a second configuration source.

## Patient Matching ownership

Contact intake no longer creates or edits a Patient. Medical CRM remains primary. Operator lookup input belongs to `EngagementCase.contactProfile`; additional contacts are canonical `ContactIdentity` references in `contactIdentityIds`. `MatchCandidate` contains Patient IDs, never copied Patient records. `MatchDecision` history belongs to the existing EntityStore; the matching service is a stateless evaluator, not a store.

Safe linking preserves Patient medical fields/provenance/integration state, case attribution and existing task/interaction records. Reused identities are not recreated; pre-existing unlinked intake identities may remain for attribution history. Patient Profile/history projections discover the case through its canonical `patientId`. No other unlinked case is automatically merged. The drawer's local contact editor is now lookup/intake editing, not local Patient creation. Existing explicit Medical CRM synchronization behavior remains separate.

See [PATIENT-MATCHING-SPEC.md](PATIENT-MATCHING-SPEC.md) for thresholds, ownership conflicts, decision lifecycle, scope, audit and backend concurrency requirements.

## Patient 360 projections and ownership

See [PATIENT-360-SPEC.md](PATIENT-360-SPEC.md). Patient is not EngagementCase: one Patient has many cases, and one case has many tasks/messages. Medical CRM remains primary for identity and medical data; local CRM owns operational work and explicitly local tags/notes/contacts. No second Patient, case, task or communication store is introduced.

Patient first-touch is immutable; each new case stores its own caseCreationTouch. Creating a case from a Patient reuses Patient and owned ContactIdentity, creates a workflow starter task, and preserves previous history. Foreign contacts are not transferred: requestedPatientId records review context on an unlinked matching case, never a confirmed Patient link. Interaction.contactIdentityId carries optional canonical recipient metadata; old records are projected without migration or copies.

Existing Comment records now live in EntityStore alongside the other canonical entities. Activity selectors group correlated technical audit rows without changing Audit Log. Scoped medical projections explicitly allowlist basic fields when patient:view_medical is absent. Medical summary absent from the model is shown as missing, not synthesized. Session-only state still requires backend persistence, transactional matching and authorization before production.

AI conversation control follows the same rule: `Interaction.aiTrace` is the immutable answer evidence, `ConversationControl` is current ownership/override, `BotActivationSchedule` is timer history and `AiConversationPolicy` is versioned configuration. None of them duplicate Patient, Case, Task or Interaction. AI text remains communication and is never promoted to a Patient/medical fact. See [AI-GOVERNANCE-KB-TRACEABILITY.md](AI-GOVERNANCE-KB-TRACEABILITY.md).

## Unified Task → Queue / Calendar / workflow

See [TASK-CALENDAR-WORKFLOW-SPEC.md](TASK-CALENDAR-WORKFLOW-SPEC.md). Task remains one canonical EntityStore entity; Calendar events are references/projections, not records or Task copies. Patient → Case → many Tasks remains unchanged. No Appointment entity exists in this prototype: the slot picker remains an emulation, and Task is never a visit. Stage transitions validate then batch stage/task updates and reuse active workflowRuleId + caseId. Production requires real transactions/outbox.

Task optional metadata captures description/type/source, originalDueAt/rescheduleCount, completion and replacement links, actor/reason, plan ID/version and pending/accepted handoff. Existing terminal statuses preserve history; no deletion or new superseded status is needed. Read-only Medical CRM plan data is never copied into a new medical source. First-touch and caseCreationTouch remain untouched. Synchronous refs mirror the same canonical arrays solely to prevent stale consecutive commands; they are not independent stores.

ConversationControl is the canonical per-thread ownership record for bot/operator coordination. Interaction remains the factual message history and carries senderKind; channel/thread lists are projections. ConversationControl does not duplicate messages and must be persisted and enforced by the backend/provider worker in production.
