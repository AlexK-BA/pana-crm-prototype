# PaNa CRM prototype — UAT scenario

## Test environment

- Preview: `https://crm-concept-git-codex-entity-s-0605d5-autoversel-4830s-projects.vercel.app/`
- Branch: `codex/entity-store-foundation`
- Test data is reset after a page reload.
- Run the scenarios in the order below when testing state changes in one session.

## Acceptance summary

The build is accepted when all critical scenarios (`P0`) pass and no action causes a blank page, an unclosable state, duplicated task, or loss of an overdue task.

| ID | Area | Priority |
|---|---|---:|
| UAT-01 | Role workspaces | P1 |
| UAT-02 | Operator priority queue | P0 |
| UAT-03 | Kanban task-driven ordering | P0 |
| UAT-04 | Mandatory outgoing call | P0 |
| UAT-05 | No-answer retry | P0 |
| UAT-06 | Shared incoming call | P0 |
| UAT-07 | Fully missed incoming call | P0 |
| UAT-08 | Patient 360 consistency | P0 |
| UAT-09 | Patient comments and audit | P1 |
| UAT-10 | Filters and navigation | P1 |
| UAT-11 | Patient conversations and channels | P0 |
| UAT-12 | RBAC route enforcement | P0 |
| UAT-13 | User lifecycle management | P0 |
| UAT-14 | Clinic data scope | P0 |
| UAT-15 | Provider-neutral SMS history and sending | P0 |
| UAT-16 | Configurable role permission bundles | P0 |

## UAT-01 — role workspaces

1. Open the role switcher in the bottom-left corner.
2. Switch between Operator, Patient Care, Team Leader, Clinic Manager, Marketing and Administrator.
3. Verify that the page title, subtitle, home content and navigation change for the selected role.
4. Return to Operator.

Expected:

- each role has its own start workspace;
- switching roles does not reload to an error page;
- CRM entity state remains available after switching;
- the operator view remains focused on the next required action.

## UAT-02 — operator priority queue

1. On Operator home, verify the `P0`, `P1`, `P2`, `P3`, overdue and unassigned counters.
2. Click each counter and verify that the visible queue is filtered accordingly.
3. Select `Zespół`, then switch between action filters.
4. Open the first overdue task.

Expected:

- overdue tasks remain visible and are not removed because their due date is in the past;
- task order is priority, overdue duration, due date, then queue age;
- the selected task opens the correct engagement case;
- tasks and cases are not presented as the same entity.

## UAT-03 — Kanban task-driven ordering

1. Open `Tablica CRM`.
2. Check Leads, Deals and Patient Care boards.
3. In a column containing several cases, compare the task badges and due dates.
4. Drag a case to another stage and open it.

Expected:

- the Kanban contains cases, not separate task cards;
- each case displays its highest-priority active task;
- cases with actionable tasks are above cases without active tasks;
- moving a case changes its stage but does not delete or complete its tasks;
- the status change is visible in audit history.

## UAT-04 — mandatory outgoing call

1. Open the unknown contact with task `Oddzwoń po nieodebranym połączeniu`.
2. Open the `Zadania` tab.
3. Try to complete or skip the call-required task without calling.
4. Click `Zadzwoń`, then end the call.
5. Try to close the wrap-up without selecting a result.

Expected:

- the task checkbox is disabled;
- there is no skip action for the call-required task;
- the call is linked to the exact task;
- after hang-up, the wrap-up cannot be dismissed;
- `Zapisz i zamknij` stays disabled until a valid result is selected.

## UAT-05 — no-answer retry

1. Continue UAT-04 and select `Brak odpowiedzi`.
2. Verify that a retry date/time field appears.
3. Enter a time in the past.
4. Enter a valid future time and save.
5. Return to the queue and reopen the case.

Expected:

- a past retry date cannot be saved;
- the call attempt and `Brak odpowiedzi` disposition are recorded;
- the task is not completed or lost;
- its attempt counter increases;
- its due date changes to the selected future time;
- it returns to the queue and remains linked to the case and patient.

Repeat with `Zadzwonić później` and `Nie udało się dotrzeć`.

## UAT-06 — shared incoming call

1. As Operator, select `Symuluj połączenie` → `Nierozpoznany numer`.
2. Verify that the call card says it is offered through a shared queue and shows the number of consultants.
3. Click `Odrzuć`.
4. Switch to Patient Care.
5. Verify that the same incoming call is still ringing and the available consultant count is lower.
6. Click `Odbierz`.
7. Switch to another offered role during the active call.

Expected:

- rejecting by one user does not mark the call as missed;
- the call remains available to the other offered consultants;
- the first user to answer claims the call;
- another user cannot answer it and sees who is handling it;
- the call opens the linked patient/case context when available.

## UAT-07 — fully missed incoming call

1. Reload the Preview to reset test data.
2. Start the same simulated incoming call.
3. Reject it as each offered consultant, switching roles between rejections.
4. Open the Operator team queue and the related case.

Expected:

- only the final rejection makes the call missed;
- one P1 callback task is created or the existing callback is reactivated;
- repeated processing does not create duplicate active callback tasks;
- the missed call is present in interactions and audit history.

## UAT-08 — Patient 360 consistency

1. Open `/patients/pat-04`.
2. Verify identity, clinic, Medical CRM ID, integration state, owner and contact channels.
3. Verify that open tasks show priority, due date and owner.
4. Click an open task and confirm that the correct engagement case opens.
5. Close the drawer, open `Sprawy`, and open each case.
6. Create `Wyślij plan leczenia` task.

Expected:

- patient is a persistent entity and can contain multiple engagement cases;
- tasks from every patient case are visible in one profile;
- task and case navigation opens the correct case drawer;
- the treatment-plan task appears without reloading;
- future call/task updates made in the shared store are reflected in Patient 360.

## UAT-09 — comments and audit

1. In Patient 360, open `Komentarze`.
2. Open `Historia zmian`.
3. In a case drawer, compare `Komentarze`, `Historia kontaktu` and `Historia zmian`.

Expected:

- human comments are not mixed with system events;
- interactions contain communication events;
- audit contains status, assignment, task, link and synchronization changes;
- repeated UI rendering does not duplicate a single audit event.

## UAT-10 — filters and navigation

1. On Kanban, filter by clinic, doctor, service and owner.
2. Combine filters, then clear them.
3. Search by patient name, phone and case ID using the command palette.
4. Open Calendar and click a task.

Expected:

- filters change the visible cases and display the active-filter count;
- clearing restores the full board;
- search reads from EntityStore rather than legacy records;
- calendar items are tasks and open their parent engagement case.

## UAT-11 — patient conversations and channels

1. Open a patient profile and select `Czat`.
2. Verify that the left column lists the patient's conversations separately by case and contact channel.
3. Switch between two conversations and verify that the message history changes without changing the patient.
4. Open the send-channel selector.
5. Verify the available options: website chat, SMS, WhatsApp, Telegram, Instagram, Facebook and e-mail.
6. Verify that TikTok is visible as `Potencjalny` and cannot be selected as an active integration.
7. Send an emulated message through Telegram, Instagram or Facebook and wait for the emulated reply.
8. Open any engagement case for the same patient and select `Historia kontaktu`.
9. Verify that the same patient-level conversation list is available inside the case drawer, with the current case selected initially.

Expected:

- one Patient can own several independent conversations;
- selecting a conversation displays only interactions belonging to its engagement case;
- channel identity, address/handle, last message and last activity are visible in the conversation list;
- an outgoing message records both the generic interaction type and the concrete delivery channel;
- TikTok is not represented as an already implemented integration;
- all sending and replies remain simulated and do not call external APIs.
- the operator can switch between all conversations of the linked patient without leaving the case drawer;
- an unlinked contact shows only the current case conversation until a Patient link is created.

## UAT-12 — RBAC route enforcement

1. Switch to Marketing and verify that Inbox, patient records, calls, calendar, audit, settings and users are absent from navigation.
2. While still in Marketing, enter `/inbox`, `/patients/pat-04`, `/settings` and `/users` directly in the address bar.
3. Switch to Team Leader and open `/audit` and `/docs`.
4. Switch to Administrator and open every module.

Expected:

- hiding navigation does not constitute the only protection;
- direct URL access displays `Brak dostępu` for an unauthorized role;
- Marketing remains limited to aggregated marketing workspace data;
- Team Leader can view operational audit/docs but cannot administer users or configuration;
- Administrator can open user management and configuration.

## UAT-13 — user lifecycle management

1. As Administrator, open `Użytkownicy`.
2. Search and filter users by status.
3. Invite a new user with a role and one or more clinics.
4. Edit their role and clinic scope.
5. Initiate password reset and revoke sessions.
6. Deactivate and reactivate the account.
7. Verify that there is no delete action.
8. Open Audit Log and verify each security action.
9. Verify that the current/last Administrator cannot deactivate their own demo account.

Expected:

- a new account starts as `Zaproszony`;
- no password is generated or displayed in CRM;
- deactivation revokes sessions and preserves historical references;
- reactivation does not recreate the user;
- user administration produces audit entries;
- physical deletion is unavailable.

## UAT-14 — clinic data scope

1. As Administrator, assign Weronika only to PaNa Medica.
2. Switch to Operator and open Board, Records, Inbox, Schedule and Calendar.
3. Search by command palette for a PaNa Comfort-only case.
4. Enter the URL of a patient who has no case in PaNa Medica.
5. Verify that a case with no clinic is still available for triage.
6. Switch to Clinic Manager and verify that unassigned-clinic cases are hidden.
7. Deactivate a non-current demo user and open the role switcher.

Expected:

- operational lists expose only cases within the current user's clinic scope;
- dependent tasks, patients, identities and conversations follow the same scope;
- global search and direct links do not bypass the scoped store;
- unassigned cases are visible only to triage-capable roles;
- inactive, locked and invited users cannot be impersonated through the demo role switcher;
- production repeats these rules server-side; client filtering alone is explicitly not treated as security.

## UAT-15 — provider-neutral SMS history and sending

1. As Administrator, open Settings and locate `SMS · dostawcy i nadawcy`.
2. Verify that PaNa Medica, PaNa Comfort and the global fallback may use different providers.
3. Change a clinic provider between Emulator, SMSAPI and SuperVoIP and run `Testuj`.
4. Open a patient with a phone identity and select SMS in the conversation composer.
5. Verify recipient, selected clinic provider, character count and calculated SMS parts.
6. Send a custom SMS and verify that it first appears as `W kolejce`.
7. With Emulator or SMSAPI, wait for `Wysłano` and then `Dostarczono`.
8. With SuperVoIP, verify that the terminal demo status is `Przyjęto przez operatora`, not `Dostarczono`.
9. Open a contact without a phone identity and verify that sending is blocked with an instruction to complete the profile.
10. Verify that the sent SMS is visible both in the patient conversation and in the current case history.

Expected:

- no real external API is called;
- provider credentials are not present in frontend state;
- provider selection is based on the case clinic, then the global default;
- changing the active provider does not change historical SMS metadata;
- sending an SMS records an audit event but does not complete the linked task automatically.

## UAT-16 — configurable role permission bundles

1. As Administrator, open `Użytkownicy` and scroll to `Role i uprawnienia`.
2. Select Operator and disable `sms:send_custom`.
3. Switch to Operator, open a patient conversation and select SMS.
4. Verify that custom SMS composition/sending is disabled while message history remains readable.
5. Return as Administrator and disable `communication:view` for Operator.
6. Switch to Operator and verify Inbox disappears and direct `/inbox` shows `Brak dostępu`.
7. Re-enable the permission or use `Domyślne` and verify access returns.
8. Select Administrator and verify its permission switches are protected.
9. Open Audit Log and verify permission bundle changes were recorded.

Expected:

- navigation, direct routes and actions use the same runtime permission bundle;
- clinic scope remains an additional restriction and is not widened by a role permission;
- changes to non-system roles apply immediately in the current prototype session;
- Administrator retains full access and cannot be edited;
- page reload restores prototype defaults until persistent backend role storage is implemented.

## UAT-17 — merged delivery states for chat and SMS

1. Open a patient conversation and send a website-chat message with `Symuluj błąd wysyłki` disabled.
2. Verify the message moves deterministically from `Wysyłanie` to `Dostarczono` and receives one simulated patient reply.
3. Enable `Symuluj błąd wysyłki`, send another chat message and use `Spróbuj ponownie`.
4. Select SMS and send a message to a patient with a phone identity and active clinic provider.
5. Verify the SMS uses the provider-neutral SMS status (`W kolejce`, `Wysłano`, `Dostarczono` or provider-specific terminal state), not the generic chat-delivery state.
6. Verify sending one SMS creates exactly one interaction and does not generate a simulated patient reply.
7. Disable `sms:send_custom` for the current role and verify SMS sending is blocked while non-SMS channels still follow `communication:send`.

Expected:

- generic channel emulation and SMS-provider emulation remain separate;
- delivery failures are deterministic and only occur when explicitly enabled for UAT;
- retry is available for a simulated generic-channel failure and does not replace the SMS provider retry workflow;
- the merge preserves patient-channel history, runtime RBAC and provider metadata without duplicate messages.

## UAT-18 — canonical entities and user identifiers

1. Open Home, Board, Records, Inbox, Schedule, Calendar, Waitlist and a Patient profile.
2. Locate the same case and verify status, responsible user, next task and patient identity remain consistent between views.
3. Reassign a task and verify the owner changes everywhere that task or its queue projection is displayed.
4. Complete or reschedule the task and verify queue counters and due-date views update without editing the case itself.
5. Switch roles and verify the current user, audit actor and telephony extension resolve through the same `usr-*` identity.
6. Search the repository for imports of `lib/crm/data`, `lib/crm/types`, `lib/crm/queue`, `CrmCase`, `CASES` and old `op-*` identifiers.

Expected:

- all operational views read Patient, EngagementCase, Task and Interaction data from EntityStore projections;
- task mutations are visible across views without synchronizing a second card model;
- user ownership and audit references use canonical `usr-*` identifiers;
- no active source file imports the removed flat CRM model or approximate queue;
- historical migration documentation may name `CrmCase`, but no executable dependency remains.

## Known prototype boundaries

- Telephony, SMS and Medical CRM are simulated; no real external API call is made.
- Telegram, Instagram, Facebook, WhatsApp, website chat and e-mail sending are also simulated in the prototype.
- TikTok is displayed only as a potential future channel and is disabled for sending.
- State is client-side and resets after reload.
- Role permission changes are session-local; production requires persistent versioned roles and backend enforcement.
- Shared incoming-call ownership demonstrates business behavior in one browser by switching roles; production requires backend realtime events and an atomic claim operation.
- Automatic workflow tasks for every funnel stage are not included until funnel stages and rules are confirmed by Daniel and the clinic team.
- Prototype RBAC blocks client routes and actions demonstrationally; production authorization must be repeated by Frappe/FastAPI and the identity provider.
- Password reset, invitation and session revocation are emulated; the production identity-provider API is not connected.
