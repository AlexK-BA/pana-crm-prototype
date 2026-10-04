# Final UAT and regression checklist

Use this checklist after all feature branches are merged into `main`. A successful build or component-level test is not a substitute for these end-to-end checks.

## Release gate

- Test one clean browser session and one session containing earlier prototype data.
- Run every P0 scenario for Administrator, Operator and the explicitly named restricted role.
- Record the tested commit SHA, deployment URL, browser, role and evidence for every failure.
- Do not publish when a P0 scenario fails, protected data is visible outside its scope, or the UI describes a side effect that differs from stored data.
- Remember that the current prototype is session-only. A reload resetting data is an accepted prototype limitation only when it is stated clearly; it is not acceptable production behaviour.

## Automated baseline

```bash
git diff --check
pnpm exec tsc --noEmit
node --test tests/*.test.cjs
pnpm build
pnpm audit --prod
```

Expected baseline: all commands succeed and the production dependency audit has no critical or high findings.

## P0 scenarios

| ID | Area | Test | Expected result |
|---|---|---|---|
| REG-01 | Authentication and RBAC | Open every route as Operator, Patient Care, Team Leader, Clinic Manager, AIHub Admin, Marketing and Administrator, including direct URLs. | Navigation, route, command and scoped data access agree. Hidden controls are not the only protection. |
| REG-02 | Clinic scope | As a clinic-scoped role, search and open patients, cases, tasks, messages, audit and users from another clinic. | Foreign-clinic personal and medical data are absent from both UI and scoped store. |
| REG-03 | Patient 360 | Open a linked patient with multiple cases and identities. Create a case, task, local contact and comment. | One canonical Patient remains; cases/tasks/threads update in every view; medical-source fields are not overwritten locally. |
| REG-04 | Patient matching | Test unique verified contact, ambiguous shared contact, conflicting PESEL/external ID and manual approval/rejection. | Only high-confidence unique evidence auto-links. Ambiguous/conflicting records require authorized review and retain decision history. |
| REG-05 | Task priority | Compare queue, case card, Patient 360 and Calendar for overdue, P0/P1, future and completed tasks. | All views project the same canonical Task. Overdue work remains visible and ranks ahead of future work. |
| REG-06 | Stage transition | Move a case between each configured stage; choose a suggested task, custom task and authorized no-task override. | Confirmation describes the actual transition and next action. One transition creates at most one active rule task and a typed audit event. |
| REG-07 | Call-required task | Attempt to skip or complete without a call; call, hang up and select every disposition. | Call-required work cannot be bypassed. Wrap-up is mandatory. Failed contact reschedules the same task; successful outcome follows configured workflow. |
| REG-08 | Incoming call | Offer one call to several eligible agents; reject as one, answer as another, then exhaust all offers. | First answer claims the call. A single rejection does not lose it. A fully missed call creates/reuses one callback task. |
| REG-09 | SMS | Send from Patient 360 and a case, link to a task, simulate failure and retry. | History, status, sender, case/task correlation and retry lineage are visible; sending alone does not complete the task. No real provider call occurs. |
| REG-10 | Omnichannel | For SMS, e-mail, WhatsApp, Telegram, Instagram and Facebook, switch channels/threads, search, filter, mark read and reply. | Left navigation represents channels with last message/status; thread identity does not drift; search/filter/read state is consistent. Attachments remain explicitly marked demo until storage exists. |
| REG-11 | AI ownership | Test pending countdown, operator takeover, bot activation, AI disable/enable and supervisor override. | Timer and owner come from canonical state; operator reply cancels pending activation; bot cannot answer while a human owns the thread. |
| REG-12 | AI evidence | Open an AI answer as Administrator/AIHub Admin and as Operator. | Authorized roles can inspect exact KB source/version/chunk and model/policy metadata. Operator sees the bot label but not restricted trace details. No chain-of-thought is exposed. |
| REG-13 | AI compliance | Create/edit draft policy, validate, approve/publish and render the patient notice for global and clinic scope. | Runtime uses an exact published version. Draft is not patient-facing. Publication and overrides are audited. GDPR/AI policy text is content, not UI localization. |
| REG-14 | Appointment | Select a clinic/provider/date/available slot and confirm; test unavailable/past slot and cancellation. | UI shows a real date-based availability selection. Confirmation text exactly matches effects on appointment, task, audit and patient communication. No silent task completion or invented confirmation message. |
| REG-15 | User lifecycle | Create, deactivate/reactivate, reset password, revoke sessions and change access. Try self-deactivation and removal of the protected admin bundle. | Users are never deleted; protected operations are rejected before mutation; successful operations use confirmations and typed audit events. |
| REG-16 | Audit | Perform stage, task, call, SMS, AI, matching, access and manual admin actions. | Actor, time, entity, previous/new value, reason and correlation are available where applicable; rerendering creates no duplicate event. |
| REG-17 | Operator assistance | Give the operator personal, unassigned and other-user tasks with different priorities. | The suggested next action is personal first, then unassigned; another user's assigned task is not proposed. A call-required action starts the call directly; no misleading skip control is shown. |
| REG-18 | Settings complexity | Open Settings and switch among all four areas. | Only controls related to the selected administrator task are visible; state is retained while switching; unauthorized roles cannot access the route. |

## Language and content separation

Run once with Polish UI and once with Russian UI.

- All interface controls, validation, navigation, dates and system statuses use the selected UI language.
- No corrupted characters, untranslated hard-coded labels or mixed-language dialog fragments remain.
- Clinic-authored SMS templates, AI/GDPR notices, comments and patient messages keep their configured content language when UI language changes.
- Patient preferred language affects outbound content selection, not the operator's interface.
- Workflow stage/task display names come from localization/configuration; stored stable IDs do not change with language.

## Responsive and failure checks

- Test desktop and narrow/mobile layouts for Kanban, case drawer, Patient 360, Calendar and Inbox.
- Refresh and navigate back/forward while dialogs and drawers are open.
- Test empty states, long names, long messages, missing phone/e-mail, many cases, many tasks and many channels.
- Test double-click/repeated submit and delayed emulated responses; no duplicate case, task, message or audit event may appear.
- Test provider/configuration failure states without exposing credentials or internal stack traces.

## Evidence template

| Field | Value |
|---|---|
| Commit SHA | |
| Deployment URL | |
| Role / clinic | |
| Scenario ID | |
| Result | Pass / Fail / Blocked |
| Evidence | Screenshot/video/log reference |
| Defect | Link and severity |
