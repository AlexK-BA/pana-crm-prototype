# PaNa CRM — RBAC and user-management specification

## 1. Goal

Protect patient and operational data without making the Contact Center workspace harder to use. Access is evaluated on three independent levels:

1. **Route** — may the role open the module?
2. **Data scope** — which clinics, teams, cases and patients may the user see?
3. **Action** — may the user view, edit, assign, move, configure or administer?

Hiding a menu item is not authorization. The backend must repeat every permission and scope check.

## 2. Confirmed rules

- Application users must not be physically deleted through CRM.
- An administrator can invite, activate and deactivate a user.
- Deactivation blocks future authentication and revokes active sessions.
- An administrator can initiate password reset but cannot see, set or retrieve the user's password.
- An administrator can revoke all user sessions.
- Role and clinic-scope changes must be auditable.
- Password-reset requests, session revocation, activation and deactivation require an explicit confirmation and must be auditable.
- The administrator performing the action is stored as the audit actor; a fixed technical user must never be substituted.
- An administrator cannot deactivate their own account or change their own role/clinic scope from the user-management screen.
- Marketing has no access to medical data or identifiable communication content.
- Manual administrator overrides of cases, stages and assignments must be written to Audit Log.
- PaNa Medical CRM remains the primary source for patient and clinical data; CRM permissions cannot grant more medical access than the source system permits.

## 3. Roles

| Role | Primary purpose | Default data scope |
|---|---|---|
| Operator | Work the Contact Center queue, calls and messages | Assigned cases plus eligible shared queues |
| Patient Care | Appointments, treatment follow-up and returning patients | Assigned clinics and patient-care queues |
| Team Leader | Queue supervision, priorities, assignment and agent status | Contact Center teams under supervision |
| Clinic Manager | Clinic operations, doctors, procedures and results | Assigned clinics only |
| Marketing | Attribution and aggregated funnel analytics | Aggregated/de-identified data |
| Administrator (AIHub Admin) | Users, integrations, configuration and full audit/activity history | All tenants/clinics, subject to source-system restrictions |

## 4. Permission matrix

Roles are permission bundles. The default bundles below are initial tenant configuration, not hard-coded business truth. Authorized administrators may change non-system role bundles; each change is audited and becomes effective consistently across navigation, route checks and protected actions. The system Administrator role remains protected and always retains the full permission catalog.

Legend: `W` view, `E` edit/work, `M` manage/assign, `—` no access.

| Area | Operator | Patient Care | Team Leader | Clinic Manager | Marketing | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Cases and Kanban | W/E | W/E | W/E/M | W/E/M | — | W/E/M |
| Tasks | W/E own/queue | W/E own/queue | W/E/M | W/E/M | — | W/E/M |
| Calls | W/E | W/E | W/E/M | W/E | — | W/E/M |
| Patient basic profile | W/E local | W/E | W/E | W/E | — | W/E/M |
| Treatment/medical data | — | W | W | W | — | W/M |
| Patient communications | W/E | W/E | W/E | W/E | — | W/E/M |
| Operational reports | — | — | W | W | — | W/M |
| Marketing reports | — | — | — | optional aggregate | W | W/M |
| Audit Log | — | — | W | own-clinic subset (future decision) | — | W/M |
| Configuration | — | — | — | — | — | M |
| Users and access | — | — | — | — | — | M |

### Atomic permission catalog

The prototype uses stable IDs grouped by domain:

- cases: `case:view`, `case:edit`, `case:move`;
- tasks: `task:view`, `task:work`, `task:assign`;
- patient: `patient:view_basic`, `patient:view_medical`, `patient:edit_local`;
- communication: `communication:view`, `communication:send`;
- SMS: `sms:send_custom`, `sms:send_template`, `sms:retry`, `sms:match_patient`, `sms:template_manage`, `sms:provider_manage`;
- telephony: `call:handle`, `call:recording_view`;
- reporting: `report:view_operational`, `report:view_marketing`;
- administration: `audit:view`, `configuration:manage`, `users:manage`.

Adding a new permission requires updating the permission catalog, default role bundles, backend policy and relevant acceptance tests. Components must request a permission from the central authorization service rather than import a static role matrix.

## 5. User lifecycle

### Invite

1. Administrator enters business name and email.
2. Administrator chooses role and clinic scope.
3. System creates an immutable user ID and status `invited`.
4. Identity provider sends a one-time password-establishment link.
5. CRM stores no plain-text password.

### Activate/deactivate

- `active → inactive`: deny new login, revoke sessions, preserve ownership, history, comments, calls and audit references.
- `inactive → active`: restore login after access validation; do not silently restore expired sessions.
- The only active administrator cannot deactivate their own account.
- Work owned by an inactive user remains visible and must be reassigned explicitly or by an approved queue rule.

### Password reset

- Generates a short-lived, single-use reset token in the identity provider.
- Sends the link only to the verified business address.
- Does not display the token or new password to an administrator.
- Revoking current sessions after successful password reset is recommended.

### No deletion

No UI or public API exposes `DELETE User`. Regulatory erasure requests are handled as a separate controlled anonymization process and must not break audit references.

## 6. Data scope

Role grants capabilities; scope limits the objects on which they apply.

- `clinicIds`: clinics visible to the user.
- `teamIds`: shared queues and agents visible to the user.
- `assignedTo`: direct ownership does not override clinic restrictions.
- Administrator scope is global in the prototype.
- Marketing receives a dedicated aggregated projection, not masked fields from the operational record.

Prototype behavior:

- Administrator and Team Leader see all clinics.
- Operator, Patient Care and Clinic Manager see only cases belonging to clinics assigned to their user account.
- Cases without a clinic remain visible to Operator, Patient Care and Team Leader so they can be triaged; Clinic Manager does not receive them.
- Tasks, patients, identities, interactions, audit rows and SMS broadcasts are derived from the visible case set.
- Command search, drawers and direct patient routes use the same scoped store as lists and boards.
- An inactive/locked/invited demo user cannot be selected in the role switcher.
- Marketing dashboard is a UI simulation of an aggregate projection. Production must calculate and return aggregates server-side without returning patient/contact rows.
- `audit:view` controls both the global Audit Log route and the case-level Audit/Activity history. Users without it do not receive audit entries in the combined case timeline.
- AIHub Admin (`admin`) has `audit:view` in the protected full-access bundle and can inspect case activity as well as the central log.

## 7. Enforcement points

| Layer | Required behavior |
|---|---|
| Navigation | Hide inaccessible modules |
| Route/UI | Display `Brak dostępu` for direct URL attempts |
| API | Re-evaluate permission and scope on every request |
| Query | Filter by clinic/team before returning rows |
| Command | Validate action permission before mutation |
| Audit | Record user administration, access changes and administrator overrides |
| Realtime | Filter incoming calls/messages by the same scope |

Telephony commands use `call:handle` as an action-level guard. Audit and call records store the canonical user ID rather than a mutable display name; the user directory resolves the visible name and extension.

## 8. Prototype boundaries

Implemented in the prototype:

- canonical atomic permission catalog;
- one runtime Authorization Provider used by route, navigation and action checks;
- administrator UI for changing non-system role permission bundles;
- immediate permission enforcement during the current session;
- protected full-access Administrator role and reset-to-default for other roles;
- route-level access boundary;
- role-aware navigation;
- user list, filters and statuses;
- invitation, role/clinic update, deactivation/reactivation, password-reset request and session revocation emulation;
- confirmation dialogs for password reset, session revocation and account activation/deactivation;
- current-user attribution for permission and user-lifecycle audit events;
- self-account protection for role/scope changes and deactivation;
- case-level Audit/Activity visibility enforced through `audit:view`;
- no delete action.

Production dependencies:

- persistent versioned role definitions and Frappe/backend policy mapping;
- identity-provider password and session APIs;
- server-side policy checks;
- clinic/team scope stored in the authoritative user directory;
- immutable security audit events;
- concurrency and last-admin protection enforced transactionally.

## 9. Open decisions

1. May a Clinic Manager view clinic-scoped Audit Log, or only operational reports?
2. Can one user hold several roles simultaneously in production?
3. Should Team Leaders be scoped by clinic, team, or both?
4. Who may view call recordings: Team Leader, Clinic Manager, Administrator, or a separate permission?
5. Who may resolve Medical CRM data conflicts?
6. What is the required inactive-account retention period?
7. May tenant administrators create entirely new roles, or only clone/edit approved role templates?
8. Should permission changes apply immediately to active sessions or require re-authentication?
9. Which role may edit permission bundles below Administrator level?
