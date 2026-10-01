# PaNa CRM — modular specifications

These files are the functional source of truth for product development. They describe business responsibilities and stable domain contracts rather than individual screens or current provider APIs.

## Documentation rules

- Product logic belongs to a domain module; UI is one consumer of that logic.
- Tenant, clinic, catalog, workflow and integration differences should be configuration, not branches in React components.
- External systems are connected through adapters using canonical internal entities and statuses.
- Historical records preserve the configuration/version used at the time of action.
- Roles are configurable permission bundles; authorization is enforced server-side and scoped by tenant/clinic/team.
- Confirmed requirements, derived recommendations and unresolved decisions must remain distinguishable.

## Module map

| Module | Responsibility | Specification |
|---|---|---|
| Tenant and clinic configuration | Product boundaries, clinics, branding, catalogs and integration accounts | [01-TENANT-CLINIC-CONFIGURATION.md](01-TENANT-CLINIC-CONFIGURATION.md) |
| Patient 360 and identity | One patient, contact identities, matching, merging and provenance | [02-PATIENT-360-IDENTITY.md](02-PATIENT-360-IDENTITY.md) |
| Cases and workflows | Separate interaction intents, funnels, stages and transitions | [03-CASES-WORKFLOWS.md](03-CASES-WORKFLOWS.md) |
| Tasks and priority queue | Required work, deadlines, SLA, priority and operator workspace | [04-TASKS-PRIORITY-QUEUE.md](04-TASKS-PRIORITY-QUEUE.md) |
| Telephony | Incoming/outgoing calls, shared ringing, disposition and recordings | [05-TELEPHONY.md](05-TELEPHONY.md) |
| Omnichannel communications | Inbox and patient threads across chat/social/e-mail | [06-OMNICHANNEL-COMMUNICATIONS.md](06-OMNICHANNEL-COMMUNICATIONS.md) |
| Medical system integration | Patient/clinical source of truth and treatment-plan exchange | [07-MEDICAL-SYSTEM-INTEGRATION.md](07-MEDICAL-SYSTEM-INTEGRATION.md) |
| Lead intake and attribution | Forms, e-mail, chat, calls, deduplication and marketing source history | [08-LEAD-INTAKE-ATTRIBUTION.md](08-LEAD-INTAKE-ATTRIBUTION.md) |
| Appointments and waitlist | Slot selection, confirmation, rescheduling, no-show and waiting list | [09-APPOINTMENTS-WAITLIST.md](09-APPOINTMENTS-WAITLIST.md) |
| Audit and analytics | Immutable change history, operational metrics and reporting contracts | [10-AUDIT-ANALYTICS.md](10-AUDIT-ANALYTICS.md) |
| Users and RBAC | User lifecycle, permissions and data scope | [../RBAC-AND-USER-MANAGEMENT.md](../RBAC-AND-USER-MANAGEMENT.md) |
| SMS | Provider-neutral sending, templates and two-way messaging | [../SMS-INTEGRATION-SPEC.md](../SMS-INTEGRATION-SPEC.md) |

## Shared entities

```text
Tenant → Clinic → Catalog / Integration Account / Workflow Assignment
Patient → Contact Identity → Engagement Case → Task
Engagement Case → Interaction / Call / Message / Comment / Audit Event
Patient → Appointment / Treatment Plan / Medical System Link
```

## Shared configuration hierarchy

The effective setting is resolved in this order:

1. case-specific override, where explicitly permitted;
2. clinic configuration;
3. tenant configuration;
4. product default.

Every resolved configuration must expose its source. Silent hidden defaults are prohibited for production actions.

## What must not become arbitrary configuration

Configurability is not permission to turn the product into an untyped form builder. These concepts remain canonical and stable:

- Patient, Contact Identity, Engagement Case, Task, Interaction, Appointment and Audit Event;
- tenant isolation, provenance, idempotency and audit rules;
- distinction between a patient and a case, between a task and a case, and between a comment and an external message;
- canonical communication/call lifecycle states;
- server-side authorization and immutable historical references.

Configuration controls catalogs, workflows, policies, mappings, labels and provider selection. It must not change the meaning of core entities.

## Dependency order

| Foundation | Depends on it |
|---|---|
| Tenant/clinic configuration | all modules |
| Patient identity and matching | cases, communications, telephony, Medical CRM |
| Cases/workflow engine | tasks, appointments, reporting |
| Tasks/queue policy | operator workspace, calls, waitlist |
| Provider adapter contracts | telephony, SMS, channels, Medical CRM |
| RBAC/data scope | every API, event, screen and export |
| Canonical audit events | analytics, compliance, debugging |

## Shared non-functional requirements

- Every mutation is tenant-scoped and auditable.
- External events and commands are idempotent.
- Provider outages do not destroy locally accepted work.
- Deactivation preserves history; physical deletion is exceptional and policy-driven.
- Times are stored in UTC and displayed in the clinic timezone.
- Phone and e-mail normalization uses tenant/market policy.
- UI filtering is not an authorization boundary.
- Integration secrets never enter frontend state or ordinary audit payloads.

## Requirement status vocabulary

| Status | Meaning |
|---|---|
| Confirmed | Explicitly requested or already accepted. |
| Derived | Recommended from the agreed business process. |
| Needs decision | Product owner/stakeholder choice is required. |
| Technical dependency | API or infrastructure verification is required. |
| Future | Deliberately excluded from the current increment. |
