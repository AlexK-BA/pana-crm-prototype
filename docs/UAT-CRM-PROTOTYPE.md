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

## Known prototype boundaries

- Telephony, SMS and Medical CRM are simulated; no real external API call is made.
- Telegram, Instagram, Facebook, WhatsApp, website chat and e-mail sending are also simulated in the prototype.
- TikTok is displayed only as a potential future channel and is disabled for sending.
- State is client-side and resets after reload.
- Shared incoming-call ownership demonstrates business behavior in one browser by switching roles; production requires backend realtime events and an atomic claim operation.
- RBAC enforcement is not part of this UAT yet; role screens are demonstrational until the permission matrix is approved.
- Automatic workflow tasks for every funnel stage are not included until funnel stages and rules are confirmed by Daniel and the clinic team.
