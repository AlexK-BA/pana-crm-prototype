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
| Message, SMS, note or call | `Interaction` / `Call` |
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
