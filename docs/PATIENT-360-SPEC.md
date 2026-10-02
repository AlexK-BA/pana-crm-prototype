# Patient 360 workspace

Base: `0201bb28fde9d226f4bdc87a96caf657135aa4cb`, after Patient Matching PR #12.

## Ownership and implementation

Patient ≠ EngagementCase. One Patient can have many cases; each case can have many tasks and communications. Medical CRM owns Patient identity and medical facts. Local CRM owns operational cases, tasks, interactions, local contacts/tags/notes, assignments, comments and audit. Medical fields remain read-only even for Admin.

The existing `/patients/[id]` route and PatientProfile are extended. `patient-360-selectors.ts` projects canonical records from ScopedEntityStore; it does not persist copies. EntityStore remains the only operational store. Comments use the existing Comment entity, now initialized and mutated in EntityStore rather than read directly from seed data. Legacy CASES/CrmCase and fallback sources remain removed.

## Sections

- Header: basic identity, external ID, clinic, integration state, contacts, language, local tags, responsible employee, latest activity, next task and overdue count. New/existing is derived from the external link; it is not a new clinical status field.
- Overview: scoped operational doctor/procedure, immutable first-touch, active cases, overdue/next tasks, last action/incoming message and matching warnings. Treatment details require medical permission.
- Cases: all accessible Patient cases, funnel/stage, status, clinic/service/doctor, attribution, owner, timing, next task, unread count and matching state. Existing drawer and communication views are reused.
- Tasks: overdue, today, upcoming, completed, cancelled and failed. Overdue precedes P0/P1 and due time. Terminal tasks remain visible. Call-required tasks use existing call/disposition/wrap-up; the workspace cannot complete them directly.
- Communications: Inbox layout, separate case/contact/channel threads, factual messages only, date grouping, author, direction, delivery and existing failed-SMS retry. Aggregate Patient SMS history includes unbound messages without duplicating records. Phone and SMS have separate threads; TikTok is Potential, not an activated adapter. Channels without a case cannot send non-SMS messages. Responsive views retain contact actions.
- Activity: interactions and audit grouped by correlationId; message audit rows fold into the factual message. The immutable Audit Log is not modified or deleted by presentation grouping.
- Comments: employee comments only, canonical author/time/case; comment audit metadata does not become a second comment.
- Medical CRM: existing external ID, state/sync, treatment plan, provenance and case documents. Missing summary/documents remain explicitly absent; no medical data is invented.

## Mutations and authorization

Commands re-check live permissions, active user and clinic scope before mutation/audit. Creating a case requires case:edit and patient:view_basic, owned contact, valid scoped clinic/service/channel and a supported initial funnel. It reuses Patient, preserves previous cases and Patient firstTouch, creates separate caseCreationTouch and a starter task through existing workflow rules.

Creating a task requires case:edit and task:work. Completion requires task:work; requiresCall completion is rejected in favor of existing wrap-up. Local contact/tags/note require patient:edit_local; local edits allowlist fields and cannot overwrite Medical CRM facts. Adding comments requires case:edit. Medical reads require patient:view_medical; emulated sync additionally requires patient:edit_local. Sending uses existing communication:send / sms:send_custom; calls use call:handle.

An existing own contact is reused without overwriting verified values. A foreign contact is never transferred or automatically merged. With case:edit, the existing matching intake creates an unlinked review case with requestedPatientId as review context, not ownership; otherwise the command is denied. This also works when the requested Patient has no external ID. Approval remains in the existing Patient Matching flow.

## Compatibility and limitations

Matching service/policy, SMS service, AuthorizationContext, UserDirectory and workflow rules are not rewritten. CallContext only accepts optional canonical recipient metadata and guards that recipient; shared incoming ownership and mandatory wrap-up are preserved. Interaction contactIdentityId is optional for existing records; selectors derive legacy routing conservatively. Runtime interaction/audit/read timestamps allow new activity to be ordered and marked read correctly.

Loading skeleton, inaccessible/not-found Patient, empty sections, missing/unavailable Medical CRM, pending/conflicting matching, unlinked contact, failed SMS and overdue states are represented. Desktop and narrow layouts are implemented; browser visual UAT remains required when Chromium is available.

This is session-only emulation: reload resets state, no backend persistence/IdP/real Medical CRM or messaging adapters are added. Production must repeat authorization server-side, enforce transactional uniqueness/ownership, persist immutable attribution and audit, and implement provider adapters and inbound routing. Frontend guards are prototype controls, not a production security boundary.
