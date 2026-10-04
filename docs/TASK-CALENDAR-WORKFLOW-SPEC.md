# Task, Calendar and workflow actions

## Operator assistance rule

The operator workspace selects the next personal active Task. When none exists, it may propose an unassigned Task, but it must not present a Task assigned to another active user as the operator's own next action. A call-required next action starts the call command directly; all other actions open the parent case. Skip, cancel and reschedule controls are labelled as such only when they execute that command and collect every required reason/result.

The system infers Patient, case, clinic, owner, task type and default SLA from context. It asks the user only for missing business information or a privileged override reason.

Base: `022e10371a9750320b6d94662ddfbb315c006598`, after Patient 360 PR #13.

## Ownership and operational chain

Patient → many EngagementCases → many Tasks and Interactions. Patient is a person; Case is one operational intent; Task is employee work. Task ≠ Appointment ≠ system reminder. The current entities contract has no Appointment entity: the existing slot picker is booking emulation, not persisted Appointment. This change does not invent Appointment records or dates.

EntityStore remains the sole canonical Task source. ScopedEntityStore supplies live permissions and clinic scope. Queue, Kanban, Calendar, Case Drawer and Patient 360 project the same Task IDs. React form state stores inputs/selection only. A synchronous ref mirrors canonical state for consecutive commands/idempotency before React re-render; it is not a separate store. No physical Task deletion command exists.

Medical CRM remains primary for Patient and clinical data. First-touch and caseCreationTouch are preserved by stage/task mutations.

## Compatible Task contract

Existing fields/statuses are reused. Added optional fields: description, type, source, originalDueAt, completedAt, rescheduleCount, previousTaskId/replacementTaskId, createdBy/updatedBy, lastChangeReason, channel, mandatory, treatmentPlanId/version and handoffState. Clinic is derived from Case rather than duplicated. Legacy type defaults to call when requiresCall, otherwise custom; missing counters default to zero. Existing completed/cancelled/failed statuses suffice: replacements use cancelled plus explicit bidirectional links, without a new superseded status.

Supported types: call, message, sms, email, qualification, appointment_confirmation, appointment_booking, post_visit_follow_up, waitlist_contact, patient_care_handoff, treatment_plan_review, send_treatment_plan, custom. Sources: workflow/manual/call/appointment/medical_crm.

## Task lifecycle

- Create requires an accessible nonterminal Case, title, description, valid type/priority, dueAt and active actor. Patient and clinic come from Case. Owner defaults to actor; assigning another owner requires task:assign and an active eligible owner.
- Edit allowlists title/description/type. Changing requiresCall into a non-call type, or changing a treatment-plan type into another type, is rejected; use explicit replacement.
- Reschedule requires new due, reason and actor; originalDueAt remains immutable, rescheduleCount increments, queue/calendar ranking changes, Case stage does not. Invalid calendar dates and nonexistent local DST times reject. Past dates require explicit consent in the shared dialog.
- Reassign/reprioritize require task:assign, valid owner/priority and reason. An assignee must be active and eligible for the Case clinic; supervisory global users retain their existing scope.
- Replace prepares/validates the new Task before mutation, cancels the old, links both, records reason and one correlation. Creating an additional Task instead leaves both active.
- Cancel retains the Task and reason. Call-required cancellation/replacement requires supervisor task:assign; it does not pretend a call occurred.
- Complete records a permitted result/timestamp. Call-required completion/reschedule uses existing CallContext wrap-up and a matching logged call/disposition/actor/task/case, never a manual admin completion.
- Reopen is explicit, audited and only allowed after resolution in a nonterminal Case. It preserves reschedule/replacement history. Closed tasks cannot be silently edited.

The existing booking emulator leaves requiresCall work open: choosing a slot is not a logged call disposition. Treatment-plan and handoff work also remain open; slot booking is not dispatch or acceptance. For other tasks it records the existing appointment_scheduled result. No Appointment persistence is added.

### Treatment-plan task

Create manually through Case/Patient 360 task forms, the existing plan button, or stage suggestions. It requires patient:view_medical and a real read-only Medical CRM treatmentPlan. It snapshots plan ID/version, stores selected channel, due, priority, owner and description; creation does not complete it or send a provider API call.

Results: sent, failed, patient_declined, no_valid_channel; rescheduled is recorded by reschedule. sent is an explicitly recorded emulated dispatch result. failed/no_valid_channel completion requires a valid next Task in the same atomic command, or explicit cancellation with reason and outcome. Missing plan/channel rejects before Task/audit mutation. The plan is never invented or edited locally.

### Patient Care handoff

Handoff tasks start pending, with an owner (current user by default, or a selected eligible receiving user). Only the receiving owner can confirm completion, recording accepted. Production team routing/acceptance notifications are future work.

## Stage rule matrix

Current Board/stage IDs are preserved. automaticTask and suggestedTasks extend the existing workflow-rules.ts catalog; nextActionMandatory, duePolicy, allowedOutcomes, enabled, clinic configurability marker and optional automationWorkflowKey describe intent. No second workflow engine or visual builder is added.

All numeric SLA values below are **calendar-time prototype defaults requiring Daniel's confirmation**. Clinical/Appointment policies require explicit input; their old numeric values remain historical catalog defaults, not an invented appointment or recommendation.

| Board/stage | Automatic / mandatory work | Due / priority | Suggested work / special rule |
|---|---|---|---|
| leads/new | First contact; matching, clinic/service/language review | 15 min, P2 | qualification, message; phone intake requiresCall, existing text intake remains message-ready |
| leads/qualification | Complete qualification and next step | 240 min, P2 | appointment_booking, call, message |
| leads/waiting | Check waiting/offer a slot | 1440 min, P2 | waitlist_contact, appointment_booking; future Waitlist association |
| leads/call_later | Explicit selected action or retained valid callback | Manual due required | call/message/sms/email; call requiresCall; active matching rule Task reused |
| leads/failed | Reason and retry/alternative decision | Explicit due for new retry | call/message/email; no infinite automatic retry chain; retain an active next action or explicit supervisor override |
| leads/closed | Terminal, reason required | No new Task | Active Tasks require completion beforehand or explicit supervisor cancellation |
| leads/converted | Terminal | No new Task | Suggested Deal booking; no automatic Deal creation mechanism exists, so no duplicate Deal is invented |
| deals/scheduled | appointment_confirmation | Explicit due, P2 | Appointment absent → controlled prompt; SMS/email suggestions; T−24h/T−2h reminders are future system side effects |
| deals/post_visit | post_visit_follow_up | 1440 min, P2 | follow-up, send_treatment_plan |
| deals/recall | appointment_booking | Clinical/manual due, P3 | recommended date required; 43200 min is historical prototype catalog value, not silently applied |
| deals/care | patient_care_handoff | 1440 min, P2 | owner/recipient, pending until accepted |
| deals/no_show | call, requiresCall | 15 min, P1 | rescheduled/no_answer/refused/wrong_number/contact_failed intent; actual results continue using existing disposition mapping and mandatory retry due |
| deals/completed | Terminal | No new Task | handoff/recall suggestions; active work explicitly resolved |
| patients/appt_scheduled | appointment_confirmation | Explicit due, P2 | no Appointment → controlled prompt; SMS reminder suggestion |
| patients/new_patient | Welcome/first contact | 1440 min, P2 | treatment_plan_review/message; check preferred channel |
| patients/returning | Determine next step | Clinical/manual due, P3 | appointment_booking; historical 10080 min not silently applied |
| patients/in_treatment | treatment_plan_review | Clinical/manual due, P3 | send_treatment_plan; historical 10080 min not silently applied |
| patients/control | Plan control appointment | Clinical/manual due, P3 | appointment_booking; historical 10080 min not silently applied |
| patients/complete | Terminal | No automatic active Task | feedback/recall suggestions only; explicit operational reopening/date required |

Creating a new Deal from Patient 360 likewise requires an explicit confirmation Task deadline. Existing intake/starter tasks are built using the same workflow helper; existing inbound matching/text-ready behavior is retained.

### Transition preview and atomic command

Existing Kanban confirmation shows old/new stage, active tasks, retained/cancelled decisions, automatic/suggested Task, priority/due/requiresCall and future side-effect key. Normal transitions retain active work and create the rule Task if needed. Supervisors can cancel active work, skip automatic creation or choose another supported Task (including custom title/description) only with reason. Terminal transition rejects unresolved active work unless explicitly cancelled by a supervisor.

Core validates permissions, stage, reason, scope, due, task choice and owner before updating stage/Tasks. React batches validated canonical state updates; this is prototype atomicity, not a backend transaction. Active caseId + workflowRuleId guards duplicate tasks, including consecutive retained commands. A resolved rule task permits an intentional future task after leaving/re-entering its stage. Duplicate same-stage calls are no-ops.

## Effective Next Task, Queue and Kanban

One shared getNextTaskForCase/compareQueueOrder policy ranks active tasks:

1. overdue mandatory/workflow;
2. other overdue;
3. future P0;
4. future P1;
5. remaining future/undated work;
6. within each operational bucket: P0 → P1 → P2 → P3 → P4;
7. within the same priority: closest dueAt, then creation age.

This prevents an older overdue P3 new-lead task from hiding a P1 missed-call
callback. The mandatory/workflow bucket still remains above other overdue work.

getCaseWorkState exposes effectiveNextTask, activeTaskCount, overdueTaskCount, previousCompletedTask and missingNextAction. A nonterminal Case without active work stays visible, carries “Brak następnego działania”, and appears in the Schedule control queue. It is never hidden or automatically moved to another stage due to priority.

Kanban remains a Case board, sorted within each stage by the shared policy. Cards use live scoped Patient/contact and UserDirectory data, clinic color, service/owner, next task/deadline/priority/overdue/requiresCall, last completed work, active count and current worker when present.

Schedule is the detailed Task Queue: overdue/today/upcoming/undated/history, with clinic, owner, responsible team, priority, effective status, type, requiresCall, board/stage and date filters. Operators/Patient Care use own or unassigned shared work; supervisors see scoped team/all work. Case/Patient history retains the accessible clinic's task records; working another assigned employee's task requires task:assign. My Work points to this detailed queue/control/history, while its existing shared queue uses the same ranking.

## Calendar and timezone

selectTaskCalendar returns references to canonical dated/undated/overdue tasks, not event copies. Each dated Task is an individual event with patient/case/clinic/type/priority/status/owner/deadline/requiresCall; terminal history is optionally visible. Click reveals details/actions and Case/Patient navigation. Drag of non-call active work opens the same reschedule dialog with a required reason/explicit past-date consent. Call tasks use wrap-up, not Calendar dragging.

Overdue work stays on its actual date plus the overdue list, never silently moved to today. Undated work has a separate list, no fabricated time slot. Appointment is absent and therefore is not merged into or edited by these Task operations.

Dates persist as ISO UTC. Calendar day boundaries and task displays use browser local time after mount, avoiding an initial server/client timezone mismatch. Existing formatDateTime is extended with an optional timezone; its old UTC default remains compatible. datetime-local is validated and converted to ISO, with impossible calendar/DST hours rejected. Production must configure an explicit clinic IANA timezone, working days/hours, holidays and SLA pause outside working hours. No scheduling engine is added here.

## RBAC and audit/analytics

Existing permissions only: task:view/work/assign, case:view/edit/move, patient:view_basic/medical, call:handle and audit:view. Active actor, capability, clinic/Case, Task existence/current status and ownership are checked inside every task mutation. Marketing gets no Tasks/Patient PII. Clinic Manager mutations stay inside clinic scope. Existing wrapper APIs forward live capabilities and canonical actor rather than caller-supplied actor strings. No RBAC/UserDirectory rewrite.

Audit uses existing task_change/status_change with structured action, task/case/patient/clinic, actor/role, reason, source/workflowRuleId, timestamp, before/after JSON and correlationId. Rejections do not write false success events. Actions include task_created/edit/reschedule/reassign/reprioritize/replace/cancel/complete/reopen, workflow_task_created/skipped, stage_transition and override. No second log is added.

selectTaskAnalytics provides reschedule/replacement/cancellation totals, unique correlated overrides, overdue-after-reschedule, manual/workflow creation, open/completed/failed, missing-next-action counts (when cases provided), and actor activity. Existing historical rows without metadata remain historical and are not fabricated/migrated. No Reports module is introduced.

## CRM / future n8n boundary

CRM owns stage, Task, dueAt, authorization, audit and atomic transition. automationWorkflowKey is a provider-neutral optional identifier only. n8n is not connected and stage changes never depend on its availability.

A future automation event envelope must contain eventId, tenant/clinic, eventType, caseId, patientId, taskId, workflowRuleId, automationWorkflowKey, occurredAt, correlationId and payloadVersion. External workers may send SMS/email/webhooks, sync Medical CRM or retry provider calls. Production requires idempotency keys, signed webhooks, retry/backoff, dead-letter/error state, explicit success/failure callbacks and a transactional outbox. n8n cannot make unsupervised direct stage mutations.

## Validation and limitations

Session-only emulation resets on reload. Backend authorization, transactions/persistence, tenant/clinic timezone/working calendars, real Appointment linkage, external dispatch and worker routing remain production requirements. No credentials, real APIs, n8n engine or Task deletion are added. Browser UAT is deferred per current user instruction; scripted command/provider regressions and build/typecheck are executed separately.

Daniel must approve all SLA numbers, working hours/timezone, stage entry tasks, call requirements, outcomes/retries, clinic/service variations, handoff recipient policy, terminal active-task resolution and recall/control medical date ownership before production.
