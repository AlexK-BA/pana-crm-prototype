# PaNa CRM — traceability and architecture alignment

Status: living control document  
Updated: 2026-10-02

## 1. Purpose

Ensure that prototype and target requirements extend the existing Dantist/PaNa architecture instead of creating an unrelated parallel CRM. Every material requirement must trace to a stakeholder need, a target module, an owner in the current architecture and a known implementation gap.

## 2. Sources used

| Source | Authority | What it controls |
|---|---|---|
| `architecture_detailed_modules_and_connections_2026-04-06.ru.md` | Current technical architecture prepared by Vova/team | Existing services, storage, module ownership, Frappe/FastAPI integration and Yeastar flows |
| Daniel’s operational requests | Contact Center owner/lead | Agent experience, statuses, telephony, breaks, no-skip rules and minimum launch priorities |
| Pasha’s process requirements | Clinic/business owner | Tasks, next actions, appointment flow, Medical CRM integration, clinics/doctors/procedures and patient follow-up |
| Marketing requirements | Marketing stakeholders | Immutable first touch, per-case attribution, UTM/client IDs, sources and conversion reporting |
| Current CRM screens and prototype code | Existing behavior/evidence | AS-IS behavior, UX gaps and implementation constraints |
| Modular specifications under `docs/modules` | Target functional baseline | Normalized requirements and acceptance boundaries |

## 3. Architecture guardrails

The following existing decisions remain authoritative unless a separate architecture decision changes them:

1. Frappe/MariaDB is the principal operator and CRM business-document contour.
2. `Engagement Case` remains the central interaction/case document and is not replaced by a frontend-only entity.
3. `Call`, `Engagement Activity`, case linkage and Frappe realtime remain in the Frappe contour.
4. FastAPI/Mongo/Redis continues to own chat/admin/knowledge runtime where it does today.
5. Frappe socket.io and backend `/ws/*` are separate realtime systems and must not be merged accidentally.
6. The existing Frappe↔FastAPI authentication/user-link bridge remains necessary until intentionally replaced.
7. Yeastar `30011` realtime event and `30012` final CDR are different facts; final analytics must use the CDR.
8. External systems are integrated through existing module boundaries; the Next.js prototype is a behavior/reference UI, not a replacement production backend.

## 4. Target placement by module

| Target capability | Existing architecture anchor | Target production placement | Change type |
|---|---|---|---|
| Engagement cases/workflows | Frappe `Engagement Case`, `backend.engagement`, kanban/list overrides | Extend Frappe DocTypes and domain service; keep UI as consumer | Evolution |
| Business tasks and priority queue | Frappe scheduler has due/overdue jobs, but no complete business Task model is documented | New Frappe DocType/service plus scheduler; expose canonical API/events | New domain layer inside existing contour |
| Patient 360 | PaNa CRM integration, Personal Account User and case contact data | Frappe patient projection/link entity referencing Medical CRM source ID; clinical source remains external | Evolution/new projection |
| Telephony abstraction | `backend.engagement.telephony`, `Call`, Yeastar handlers | Keep current Yeastar adapter; introduce canonical Telephony Service/adapter boundary inside the same Frappe module | Refactor, not replacement |
| Call recordings | Frappe `File`, async recordings worker | Preserve existing async download/storage flow behind provider capability | Preserve/abstract |
| Chat/social Inbox | FastAPI `backend/chats`, Mongo, Redis, frontend_chat/admin | Preserve FastAPI runtime; synchronize canonical messages/case links with Frappe | Preserve/extend |
| SMS | No complete provider-neutral module documented | Outbound command/history in CRM contour; provider adapter can live in Frappe integration module; inbound routing must create canonical Interaction/Case | New integration module |
| Users/RBAC | Frappe User + MongoAdmin synchronization + backend JWT bridge | Persistent role/permission definitions in authoritative backend; checks in Frappe and FastAPI | Extend both contours |
| Audit | `Engagement Activity`, Frappe documents, analytics sync | Canonical business audit in Frappe; integration diagnostics separate; analytics consumes events | Normalize/extend |
| Medical CRM integration | PaNa CRM synchronization and backend↔Frappe client | Adapter/reconciliation layer; Medical CRM remains authoritative for clinical fields | Preserve/abstract |
| Lead intake | Google Sheets bridge, backend→Frappe case creation | Replace/augment bridge with configurable form/e-mail/webhook adapters that create Frappe cases idempotently | Evolution |
| Reporting | Frappe analytics module and activity sync; planned Postgres/Looker collector | Canonical events from Frappe/FastAPI into analytics store; documented metric semantics | Extend |
| Tenant/clinic catalogs | Clinic values/config in Frappe/site config and frontend constants | Frappe-managed Tenant/Clinic/Doctor/Procedure catalogs synchronized from Medical CRM where authoritative | Refactor/configuration |

## 5. Stakeholder traceability matrix

| Requirement | Source | Module/specification | Current anchor | Prototype status | Production gap |
|---|---|---|---|---|---|
| Minimal agent workspace with clear next action | Daniel | Tasks/priority queue; role workspaces | Frappe Desk/list/kanban | Implemented as role home/queue | Production UI and backend task API |
| Record requiring a call cannot be skipped without calling | Daniel | Tasks + Telephony | `Engagement Case`, `Call`, activity | Demonstrated with `requiresCall` | Server-side transition validation |
| Call result or reschedule after no answer | Daniel/Pasha | Tasks + Telephony | Call CDR/activity | Demonstrated | Persisted task/disposition transaction |
| Incoming call shown to several available agents | Daniel/Pasha | Telephony | Frappe realtime from `30011` | Demonstrated in one browser | Shared realtime routing and atomic claim in Redis/backend |
| Agent states Available/In work/Break/Offline | Daniel | Telephony/role workspace | Partial runtime/realtime capabilities | Demonstrated | Authoritative presence service and routing policy |
| Statuses, telco, breaks and agent view are launch priority | Daniel | Telephony + RBAC + role workspace | Frappe telephony/UI extensions | Partially covered | End-to-end integration/UAT on real PBX |
| Separate patient from interaction case | Pasha/product analysis | Patient 360 + Cases | Current architecture centers on Engagement Case; Medical CRM has patient facts | Implemented in prototype model | Frappe patient projection/link DocType and migration |
| Tasks are entities inside cases; deadlines prioritize cards | Pasha | Tasks/priority queue | Scheduler processes due work but complete business Task model is not documented | Implemented | New Frappe Task DocType/service and migration |
| Overdue work never disappears | Pasha | Tasks/priority queue | Frappe scheduler | Implemented | Backend query/state rules |
| Medical CRM is primary patient source | Pasha | Medical-system integration | Existing PaNa CRM sync | Reflected in provenance/UI | Confirm API, reconciliation and field ownership |
| Treatment plan visible/downloadable from CRM | Pasha | Medical-system integration/Patient 360 | Medical CRM integration | Demo data/action | Secure document proxy/storage and RBAC |
| Clinic-specific doctors/procedures | Pasha | Tenant/clinic configuration | Existing Frappe/Medical CRM data paths; frontend currently static | Displayed statically | Configurable/synchronized catalogs |
| SMS from patient/case and history | Pasha/Nikolay context | SMS specification | No complete provider-neutral service | Stage 1 emulated | Backend adapter, credentials and persistence |
| Configurable funnels, stages and automatic tasks | Pasha/Daniel | Cases/workflows | `Engagement Case`, kanban, engagement hooks | Foundation only | Versioned Frappe workflow/rules configuration |
| Immutable patient first touch | Marketing | Lead intake/attribution | Case sources and analytics integration | Modeled | Persisted patient-level attribution snapshot/migration |
| Separate attribution for every new case | Marketing | Lead intake/attribution | Engagement Case data | Modeled | Intake mappings and canonical fields in Frappe |
| UTM Source/Medium/Campaign/Content/Term and client ID | Marketing | Lead intake/attribution | Forms/Sheets/backend payloads vary | Modeled in target | Field mapping, validation and migration |
| Reports by source, clinic, service and conversion | Marketing/management | Audit/analytics | Frappe analytics and activity sync | UI concepts only | Metric contracts, collector and Looker/data mart |
| Users cannot be deleted; deactivate/reset/revoke | Product/admin request | RBAC/user management | Frappe User + MongoAdmin sync | Implemented as emulation | Identity-provider/Frappe transactions |
| AIHub Admin can see card Activity history | AIHub request | RBAC + Audit | Engagement Activity/Audit | Permission available | Map real AIHub Admin role and backend scope |

## 6. Confirmed extensions versus architectural deviations

### Confirmed extensions

- business Task entity and priority policy;
- patient projection/identity linkage around existing Engagement Cases;
- configurable workflow rules;
- provider-neutral interfaces around Yeastar/SMS/Medical CRM;
- atomic permission catalog and clinic scope;
- immutable marketing attribution and canonical audit events.

These additions fit the existing Frappe/FastAPI boundaries and do not require replacing the deployed architecture.

### Deviations that are not allowed without an architecture decision

- moving authoritative Engagement Cases into frontend state or a new standalone database;
- treating Mongo chat records as the only CRM truth;
- merging Frappe socket.io with FastAPI websocket behavior;
- bypassing Frappe document hooks by writing MariaDB directly;
- replacing final CDR facts with realtime `30011` data;
- storing secrets or real provider calls in React components;
- duplicating users independently in Frappe and FastAPI without the existing link/sync contract.

## 7. Identified gaps and risks

| ID | Gap/risk | Consequence | Required action |
|---|---|---|---|
| ALG-01 | Prototype EntityStore is not the production Frappe model. | UI may appear complete while backend contracts are absent. | For every implemented prototype entity, define Frappe DocType/API/event mapping before development estimate. |
| ALG-02 | Patient entity is not clearly represented as a dedicated current DocType. | Duplicate contacts and inconsistent clinical identity. | Decide Patient projection/link DocType and migration from Engagement Case/contact fields. |
| ALG-03 | Business Task model is not documented in current architecture. | Queue/workflow requirements cannot be persisted safely. | Design Task DocType, indexes, scheduler jobs and transition transaction. |
| ALG-04 | Existing user synchronization spans Frappe and Mongo. | Frontend-only RBAC would be insecure/inconsistent. | Choose authoritative role store and enforce equivalent policy in both services. |
| ALG-05 | Yeastar clinic routing uses extension→clinic site config. | Hardcoded scale bottleneck and incorrect routing for shared agents. | Move routing to configurable DID/extension/account rules with explicit priority. |
| ALG-06 | Marketing fields may arrive differently from forms, Sheets, chat and e-mail. | Attribution loss or overwritten first touch. | Canonical intake envelope and mappings before channel migration. |
| ALG-07 | Engagement Activity and target Audit Event overlap. | Duplicate/noisy timeline and metrics. | Define canonical event types and migration/display grouping. |
| ALG-08 | SMS service ownership between Frappe and FastAPI is not yet final. | Duplicate history or mismatched webhook handling. | Choose command/history owner; recommended: Frappe business record with adapter/webhook integration service. |

## 8. Required change workflow

For every source-code increment:

1. identify stakeholder requirement and module;
2. identify current architecture anchor and target production owner;
3. update the module specification;
4. update this traceability file if mapping/status/gap changes;
5. update UAT with observable behavior;
6. implement prototype or production change;
7. validate type/build and relevant scenario;
8. commit code and documentation together.

## 9. Current conclusion

The target CRM is not being designed from scratch. It is a structured evolution of the current Dantist architecture:

- Frappe remains the business/CRM core;
- FastAPI/Mongo/Redis remain the chat/admin/realtime support contour;
- existing Yeastar flows are preserved as the first telephony adapter;
- new Patient, Task, workflow, RBAC and attribution layers close confirmed business gaps;
- the Next.js prototype validates behavior and contracts but does not redefine production data ownership.

Before production implementation, the two largest design tasks are the Frappe mapping for Patient/Task and the cross-service authorization contract.
