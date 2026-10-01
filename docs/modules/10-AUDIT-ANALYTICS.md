# Module specification: Audit and analytics

## Goal and problem

Provide trustworthy operational accountability and management reporting without mixing human comments with system history or counting repeated low-level events as separate business actions.

## Audit requirements

1. Record actor, tenant, clinic, entity, action, before/after, timestamp, correlation ID and source.
2. Human comments are separate entities and may be edited only with edit history.
3. Audit records are append-only for ordinary users.
4. Repeated technical events may be grouped in UI but raw evidence remains available to authorized admins.
5. AIHub Admin can view card Activity history according to data scope.
6. Sensitive payloads, credentials and recordings are excluded or separately permissioned.
7. Manual workflow override, merge, assignment, permission and integration configuration changes are always auditable.

## Analytics model

Reports consume canonical business events rather than UI state or provider-specific statuses.

Required metric families:

- new cases/leads by source and clinic;
- speed to first action and SLA breaches;
- contact attempts, calls and answered/missed outcomes;
- appointments, conversion, cancellation, reschedule and no-show;
- overdue/unprocessed work;
- operator availability and working time;
- repeat patients and case lifecycle;
- campaign attribution and conversion.

## Metric definition contract

Each metric specifies event source, formula, time boundary, timezone/business calendar, exclusions, dimensions, freshness and late-event behavior. Workflow-specific stages map to canonical semantic events.

## RBAC

- operator: own/assigned operational history where required;
- team leader: team operational reports and scoped audit;
- clinic manager: clinic aggregates;
- marketing: attribution/marketing data without unnecessary medical detail;
- administrator/AIHub Admin: full audit subject to sensitive-data permissions.

## Acceptance criteria

1. A status change and comment appear as different history types.
2. Repeated provider callbacks do not inflate business metrics.
3. Every displayed KPI has a documented formula and filters.
4. Clinic/tenant scope applies to reports, exports and audit APIs.
5. Late final CDR or medical events update metrics deterministically.

## Needs decision

- retention periods per audit/event type;
- scope of AIHub Admin versus clinic administrators;
- final KPI formulas, business hours and targets;
- data warehouse/Looker Studio refresh cadence.
