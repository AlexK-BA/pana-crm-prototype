# Final prototype acceptance boundary

Updated: 2026-10-04

## Purpose

This document defines when the PaNa CRM prototype is ready for stakeholder UAT. It does not claim production readiness. The acceptance target is a coherent, testable TO-BE workflow that can be used as the implementation baseline for the Frappe/backend, telephony and Medical CRM integrations.

## Accepted prototype capabilities

- One canonical Patient, Contact Identity, Engagement Case, Task, Interaction/Call/SMS, Comment and Audit model.
- Role-specific start workspaces for Operator, Patient Care, Team Leader, Clinic Manager, Marketing and Admin.
- Task-driven queue, Kanban ordering and Calendar projection with persistent overdue history.
- Mandatory call lifecycle: a call-required Task cannot be completed or postponed without the call/wrap-up flow.
- Incoming-call routing, safe patient/case matching and shared-call claim behavior are emulated and auditable.
- Patient Matching uses deterministic confidence/conflict rules and explicit approval where required.
- Patient 360 combines cases, tasks, communications, comments, activity and read-only Medical CRM projection.
- SMS Stage 1 supports custom messages, history, delivery-state emulation, failure and retry without silently closing a Task.
- Stage transitions use one workflow catalog and propose/require the appropriate next Task; supervisor overrides require a reason and remain in audit.
- AI conversations distinguish bot/operator ownership, activation timer, handoff, response evidence and Knowledge Base citations.
- Admin/AIHub Admin has central activity/audit access; user accounts are deactivated rather than deleted.
- Polish is the primary stakeholder language. Russian interface support covers primary navigation and critical operational dialogs; seed/business content remains source-language data and is not translated as UI.

## Explicit emulations and production dependencies

- Telephony has no real PBX/SIP/WebRTC provider connection, realtime event bus or atomic server-side claim.
- SMS has no real SMSAPI/SuperVoIP call, inbound number or durable provider webhook processing.
- Medical CRM synchronization, treatment-plan documents, visits and availability are read-only/demo projections.
- Appointment booking does not reserve a real slot and has no canonical backend Appointment transaction.
- Attachments store a demo filename only; production requires object storage, authorization and malware scanning.
- State, RBAC changes and audit are browser-session state. Production enforcement and persistence must be server-side.
- AI/GDPR screens are readiness/evidence contracts, not a legal declaration of conformity.
- n8n may orchestrate approved events, but it must not become the source of truth for Patient, Case, Task, Appointment or Audit.

## Release gate

The prototype release candidate passes when:

1. `git diff --check` is clean.
2. TypeScript passes with `pnpm exec tsc --noEmit`.
3. All command/regression tests pass.
4. `pnpm build` completes.
5. Role-route tests confirm least-privilege defaults and Admin audit access.
6. The published Vercel production alias points to the tested `main` commit.
7. Daniel's manual UAT covers statuses, telephony flow, breaks/agent view and the simplified Operator workspace.
8. Final stabilization UAT confirms mobile navigation, exact custom SMS content, one Patient Link state and human-readable task audit entries.

## Deferred backlog after acceptance

- Real provider adapters and backend persistence.
- Approved production workflow/SLA configuration per clinic.
- Complete content localization beyond critical operational UI.
- Reporting formula contracts and production analytics pipeline.
- Final accessibility, responsive and browser compatibility certification.

## Final UAT findings resolved in the stabilization branch

- Mobile now exposes an application menu, search and call simulation instead of trapping the user on the current page.
- SMS clinic defaults are inserted only by an explicit action; context changes cannot overwrite a human draft.
- A local Patient grouping remains `unlinked` until the Medical CRM relationship is actually resolved. Case drawer, Patient Link and Patient 360 use the same resolver.
- Task audit renders operational before/after values and localized action names instead of raw serialized Task objects.
- Engagement Case is an operator workspace: profile details are globally accessible, desktop comments remain persistent, quick call/message actions provide feedback, booking captures clinic/service/doctor/date, and new Tasks are proposed from the current workflow stage.
- Manual ordering is a per-user presentation layer in Schedule, Task Calendar, Waitlist and CRM Board. It never changes priority, due date or stage and cannot bypass the workflow transition dialog.
