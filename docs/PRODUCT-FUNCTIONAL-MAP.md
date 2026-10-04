# PaNa CRM prototype — product and functional map

Status: living source of truth for the current prototype  
Updated: 2026-10-04

## 1. Product goal

The CRM helps Contact Center staff process the correct patient/contact action at the correct time with the fewest safe decisions. The system must identify work, rank it, show context, propose the next action and prevent an invalid result. It must not require an operator to understand technical workflow IDs, provider statuses or integration topology.

The production system remains an evolution of Dantist: Frappe owns CRM business records, FastAPI/Mongo supports chat/KB/admin/realtime capabilities, and providers are connected through adapters. The Next.js application in this repository is a behavior prototype, not a replacement production datastore.

## 2. Global interaction rules

1. The first operator screen answers three questions: **what must I do now, for whom, and why is it first?**
2. A call-required task starts a call directly and cannot be completed/skipped without telephony wrap-up.
3. A non-call task opens the corresponding case workspace with its patient, previous action and required next action.
4. Work assigned to another active user is never suggested as the current operator's next task.
5. Overdue tasks remain visible on their original date and rank ahead of future work.
6. Every active case requires an active next action unless an authorized, audited override exists.
7. The Patient is the canonical person; an Engagement Case is one interaction intent/process; a Task is required work inside a case.
8. Medical CRM is authoritative for clinical patient data. Local CRM fields cannot silently overwrite it.
9. Comments, external communications and system audit events are separate streams.
10. Every mutation checks permission and clinic scope in the domain command; hidden UI alone is not authorization.
11. UI language, patient preferred language and authored content language are separate concepts.
12. Demo/emulated provider behavior must be visibly labelled and must not claim external delivery or Medical CRM persistence.

## 3. Application sections

| Route / section | Primary user | Purpose | Main features | Business logic and automation | Current prototype boundary |
|---|---|---|---|---|---|
| Application shell | All authenticated roles | Keep global context and urgent events available on every page | Role-aware navigation, current user/state, language, command search, notifications, new case and incoming-call simulation | Navigation is permission-filtered; direct route access is checked separately. Search opens canonical Patient/Case results. Incoming call routing uses matching and clinic scope | Role switching, notifications and call generator are demo controls rather than authenticated production services |
| `/` Role workspace | All roles | Present role-specific decisions, not a generic dashboard | Operator queue; Patient Care segments; Team Leader workload; Clinic Manager metrics; Marketing attribution; Admin system state | Uses one scoped EntityStore and current role/clinic access. Operator next action is personal first, then unassigned; never another user's assigned task | Metrics and state are session seeds; several secondary labels remain Polish |
| `/board` CRM board | Operator, Patient Care, TL, manager, admin | Manage Engagement Cases by funnel/stage | Leads, Deals and Patient Care boards; filters; drag transition; case cards | Cards are cases, ordered by their active Task. Moving a case invokes workflow rules and requires a valid next action or audited override | Workflow catalog is code-defined; drag remains the main transition trigger |
| Case drawer | Operational roles | Complete work without leaving the current context | Persistent “What to do now” summary, patient/link state, profile, tasks, conversations, comments, timeline, audit, appointment and call/SMS actions | The next Task, deadline, priority and last completed action remain visible before the operator chooses a tab. Same canonical case/task/message objects as queue, calendar and Patient 360 | Large component; provider actions are emulated; some secondary Polish/technical copy remains |
| `/schedule` Task queue | Operational roles | Work and supervise canonical Tasks | Active/history grouping; missing-next-action control; edit/reschedule/replace/cancel/reopen | Task deadline/priority drives ordering. Call-required work requires call wrap-up. Every administrative mutation records reason and audit | Dense action dialogs; no persisted user view preferences |
| `/calendar` Task calendar | Operational roles | See and move dated Tasks | Overdue section; undated section; week grid; task details | Calendar is a projection of Task, not a separate appointment/task copy. Overdue stays on original date | Compact implementation needs further responsive/accessibility polish |
| `/inbox` Inbox | Communication roles | Process incoming conversations across channels | Channel/thread list, filters, search, unread, composer | Messages remain linked to Patient/Case/Contact Identity. AI/human ownership and trace are canonical | Provider connections and attachments are demo-only |
| Patient conversation workspace | Communication roles | See all channels/threads for one Patient | Channel list, last message/status, case thread chips, search, bot indication | One Patient may own many threads; thread identity is case + contact identity + channel | Some labels/filters are duplicated with `/inbox`; unify shared components later |
| `/patients/[id]` Patient 360 | Patient-facing operational roles | Show one person across all cases, work and medical projections | Overview, cases, tasks, threads, activity, comments, Medical CRM, local actions | Matching/linking preserves canonical Patient and first touch. Medical fields are read-only/provenance-aware | Session-only; medical documents and real sync unavailable |
| `/records` Records | Case roles | Search/filter all cases | Search, clinic/status/source/owner filters, table actions | Reads scoped canonical cases; direct access never expands permissions | Table is information-dense; saved views/export are future work |
| `/waitlist` Waitlist | Case/task roles | Manage patients awaiting an acceptable visit | Filters, preferences, actions | Waitlist is a workflow state with a required contact task, not a separate patient copy | Real availability and Medical CRM booking are not connected |
| Appointment dialog | Task/case workers | Select an available visit time | Month calendar, available days, doctor/time slots, confirmation | Current demo records audit, optionally completes a compatible non-call task and adds an emulated outgoing confirmation. Call-required tasks remain open | Slots are generated demo data; no Appointment entity or Medical CRM write |
| Call overlay | Call-capable roles | Handle incoming/outgoing calls and mandatory wrap-up | Shared ringing, answer/decline, timer, disposition, retry date | First answer claims a call. One rejection does not lose a shared call. No-answer reschedules the same task; successful disposition completes compatible work | No real PBX; browser timer/state only |
| SMS composer/history | Authorized communication roles | Send and review SMS in patient/case context | Custom text, clinic defaults, statuses, failure simulation, retry | Provider-neutral adapter; retry creates linked attempt; sending does not complete unrelated task | No real provider/inbound number; templates/two-way flow are future stages |
| `/users` User management | Administrator | Manage access without destroying history | Create, deactivate/reactivate, reset password, revoke sessions, roles, clinic scopes | No delete operation. Self-deactivation/access removal and protected admin-bundle removal are blocked and audited | No IdP/email/session backend |
| Role & Permission matrix | Administrator | Configure role bundles | Permission groups, reset, confirmation | Atomic permissions drive navigation, route access, commands and scoped projections | Persisted backend enforcement is future work |
| `/audit` Audit Log | TL/admin with permission | Investigate changes and administrative actions | Type/user/entity/date/search filters | Audit is append-only conceptually; actor IDs resolve through active/inactive directory | Prototype array, not durable append-only storage |
| `/settings` Settings hub | Administrator | Configure one product area at a time | Processes & clinics; users & access; communication; AI & KB | Settings navigation reduces unrelated controls. Disabled/deactivated configuration preserves history | Most catalogs/settings are frontend state or static seed |
| Processes & clinics settings | Administrator | Review workflow/SLA and organization catalogs | Workflow matrix, clinics/doctors/procedures, boards/stages | Stable IDs and historical snapshots are required when configuration becomes editable | Currently read-only/static; Daniel must approve SLA values |
| Communication settings | Administrator | Configure SMS and bot/channel behavior | Provider selection/emulation, sender/default text, bot/channel controls | Provider calls must remain behind server adapter; no credential in frontend | Bot settings and provider test are session emulations |
| AI & Knowledge settings | AI/admin roles | Govern bot sources, behavior and transparency | KB articles/sources/test; explicitly read-only AI readiness/evidence preview; separate patient-content language | Bot answer needs disclosure and source evidence; operator handoff rules override automation; only an approved published compliance version is patient-facing | KB/config edits are session-only. Versioned compliance editing/approval/publication is a production workflow, not simulated by the read-only center |
| `/docs` Migration/docs view | TL/admin | Explain AS-IS → TO-BE progress | Architecture/migration summaries | Documentation must distinguish implemented prototype, production dependency and future scope | Not a replacement for repository specifications |

## 4. Role behavior

| Role | Start decision | May act on | Must not see/do |
|---|---|---|---|
| Operator | Next personal or unassigned operational task | Cases, assigned/shared tasks, calls and allowed messages in clinic scope | Medical details, audit/configuration, other-clinic data, another user's assigned work as own next action |
| Patient Care | Patients requiring follow-up/treatment support | Patient cases, medical projection and care tasks in scope | User/configuration administration |
| Team Leader | Overdue queues, assignment and team workload | Operational work, assignment/priority/override and audit | User/configuration administration unless separately granted |
| Clinic Manager | Clinic performance and workload | Scoped clinical/operational cases, tasks and assignments | Other-clinic personal/medical data; global audit by default |
| Marketing | Attribution and aggregate conversion | Aggregated campaign/source metrics | Patient, case, task, message and medical record details |
| Administrator / AIHub Admin | System health, users, integrations and exceptions | Full configured scope, audit and protected settings | Editing Medical CRM-owned clinical fields directly |

## 5. Cross-cutting feature contracts

### Priority and next action

- Priority belongs to Task; the case inherits effective urgency from its highest-ranked active task.
- Ranking: overdue mandatory → other overdue → future P0/P1 → remaining due work → undated controls.
- Queue, calendar, case card and Patient 360 must show the same Task ID/state.
- A past due date never hides or silently moves a Task.

### Stage transition

- Moving a case is one atomic operation: validate transition, resolve active tasks, create/reuse next Task, update case, append audit.
- Ordinary users see the proposed next action and only required inputs.
- Technical override controls are available only with `task:assign`, require a reason and remain audit-visible.
- Custom next task requires title, description and explicit deadline.

### Calling

- Incoming routing attempts patient/contact matching before creating anything.
- Unique accessible match opens the existing case; ambiguity requires selection/review and does not create silent duplicates.
- Outgoing call from a call-required Task binds the Call to that exact Task.
- Hang-up enters mandatory wrap-up; failed contact keeps/reschedules work instead of losing it.

### Communication and AI

- Each message records direction, concrete channel, Patient/Case/Identity and delivery/author facts.
- Human and bot authors are distinguishable; operator may take over.
- AI answers require policy version, disclosure and KB citation or explicit no-source reason.
- Medical/emergency/low-confidence/patient-request conditions force human handoff.

### Patient and matching

- Verified unique identifiers may auto-link according to confidence policy.
- Shared or contradictory identifiers never choose the first candidate.
- Manual decisions require authorized scope, reason and retained history.
- Merging/linking never silently transfers a contact already owned by another Patient.

## 6. Current product limitations

- Session-only state; reload is not persistence.
- No production backend authorization/persistence/idempotency.
- No real PBX, SMS, social, email, Medical CRM scheduling or document storage.
- Static PaNa clinics/doctors/procedures/workflows/branding.
- Partial PL/RU extraction; authored content must not be translated as UI.
- Appointment is an explicit emulator rather than a canonical persisted Appointment.
- Settings and KB edits are not durable/versioned.
- Reporting is calculated from demo state and lacks approved metric contracts.

## 7. Documentation ownership

Detailed domain rules live under `docs/modules/` and linked specifications. This map owns navigation/page responsibilities and cross-module user behavior. A feature is undocumented if it has no entry here or in a domain specification with role, trigger, state change, error behavior and production boundary.
