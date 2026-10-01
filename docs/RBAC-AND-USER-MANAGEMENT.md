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
| Administrator | Users, integrations, configuration and audit | All tenants/clinics, subject to source-system restrictions |

## 4. Permission matrix

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

## 8. Prototype boundaries

Implemented in the prototype:

- canonical permission map;
- route-level access boundary;
- role-aware navigation;
- user list, filters and statuses;
- invitation, role/clinic update, deactivation/reactivation, password-reset request and session revocation emulation;
- no delete action.

Production dependencies:

- Frappe/backend role mapping;
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
