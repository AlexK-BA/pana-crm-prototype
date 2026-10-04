# Refactoring boundaries after behavior stabilization

Status: approved technical direction; extraction not started  
Updated: 2026-10-04

## Goal

Reduce component size, merge conflicts and regression risk without creating a second source of truth. Refactoring must preserve observable behavior, command authorization, clinic scope, audit and stable entity IDs.

## Non-negotiable invariants

1. There is one `EntityStoreProvider` and one canonical state graph for Patient, Engagement Case, Task, Interaction and AuditEvent.
2. Queue, board, calendar, Patient 360 and case drawer remain projections of the same entities.
3. No domain module owns a private copy of records from another module.
4. Every mutation continues through an authorized command and appends the same audit facts.
5. Extraction commits must not combine UI redesign with state-model migration.
6. Existing command tests are contract tests and must pass unchanged before and after each extraction.

## Target code boundaries

| Boundary | Owns | May read | Must not own |
|---|---|---|---|
| `task-commands` | create, assign, start, complete, reschedule, replace, cancel and reopen Task | Case, Patient, user scope, workflow rule | Queue/calendar copies |
| `workflow-commands` | atomic stage transition and next-action resolution | Case, active Tasks, versioned workflow configuration | UI dialog state |
| `patient-matching-commands` | confidence decision, approve/reject/link history | Patient, identities, case intake facts | Medical CRM patient master |
| `communication-commands` | messages, SMS attempts, thread ownership and handoff | Patient, Case, Identity, provider adapter result | Separate Inbox/Patient message stores |
| `telephony-commands` | call start/claim/wrap-up and retry Task lifecycle | Case, Task, Patient/Identity matching | PBX credentials or browser-only call truth |
| `user-commands` | create, deactivate/reactivate, reset, revoke and access changes | User directory, permissions and clinic scope | Authentication provider secrets |
| selectors | pure projections and rankings | canonical state only | mutations or local persistence |

The Provider composes these command modules by passing a controlled `getState` and `commit` interface. It remains the only React entry point; modules are not additional stores.

## UI component extraction

| Current area | Safe extraction | Reason |
|---|---|---|
| Engagement Case drawer | `CaseHeader`, `CaseNowPanel`, `CaseProfileTab`, `CaseTimelineTab`, `CaseTasksTab` | Tabs can be tested independently while the drawer owns navigation/context |
| Inbox + Patient conversations | Shared `ChannelSummary`, `ThreadStatus`, `MessageSearch`, `MessageComposer`; keep separate containers | Scopes are intentionally different: all people versus one Patient |
| Settings | One section component per product area | Prevent unrelated configuration changes from colliding |
| Patient 360 | One tab component per longitudinal projection | Preserve Patient page as the composition root |
| Task/calendar | Shared task summary and action sheet | Keep both as projections of the same Task |

## Execution order

1. Freeze current behavior with browser UAT evidence.
2. Extract pure selectors and shared presentational components first.
3. Extract one command domain at a time, beginning with Tasks/Workflow.
4. Run command tests, TypeScript, build and role-based UAT after every boundary.
5. Introduce backend repositories/adapters only after frontend extraction is stable.

## Stop conditions

Stop the refactor if it requires a second Provider, new entity IDs, duplicated seeded arrays, changed audit meaning, weakened permission checks or simultaneous production-backend design. Those are architecture changes and require a separate approved specification.
