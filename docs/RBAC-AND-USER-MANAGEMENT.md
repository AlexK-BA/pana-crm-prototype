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
- case-workspace actions react to the runtime permission matrix: call handling, communication history, local patient editing, patient matching, appointment entry and task work are disabled when their atomic permission is removed;
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

## 10. User/RBAC command hardening (2026-10-02)

Canonical sources remain AuthorizationContext, UserDirectory and EntityStore. Components: `components/crm/user-management-view.tsx` (Users), `components/crm/role-permission-matrix.tsx` (Role & Permissions), `components/crm/audit-log-view.tsx` (existing shared log). No parallel users, roles, permissions or audit store is introduced.

### Command contract

- `createUser`, `setActive`, `requestPasswordReset`, `revokeSessions`, `updateAccess` require `users:manage`. The executing demo account must be active and still assigned the selected role.
- `toggleRolePermission`, `resetRolePermissions` require `configuration:manage`, including direct invocation outside the UI. Unknown roles/permissions and edits/resets of the protected admin bundle throw `AccessCommandError`.
- Rejection is a safe, user-readable controlled error. Validation precedes state mutation and audit creation. Rejected operations create **no** event (including no `access_denied`); the type is reserved for a future safe security logging boundary. No recursive logging path exists.
- A command snapshot points to the same React state arrays, serializing consecutive commands before the next render. It is not another directory/store. This prevents duplicate-email creation within one batched event and lets permission revocation affect subsequent commands immediately.
- Non-system roles retain runtime-editable bundles. Admin queries always retain the full permission catalog, including `users:manage`, `configuration:manage`, `audit:view`. Admin reset is explicitly rejected and cannot weaken the bundle.

### Validation and lifecycle

Names are trimmed and must be nonempty. Emails are trimmed, lowercased, checked with a basic format rule and compared case-insensitively against all accounts, including inactive/invited accounts. IDs are generated only after validation. Creation accepts only explicit public user fields; no arbitrary secret fields are copied.

Roles must be a nonempty subset of `ROLE_ORDER`; clinic IDs must exist in `CLINICS`. Operator, Patient Care and Clinic Manager are clinic-scoped and require at least one clinic. Admin and Team Leader have global prototype scope; Marketing uses aggregates. Mixed assignments containing a clinic-scoped role still require a clinic. Role/clinic arrays are copied and deduplicated. The editor preserves multiple roles rather than silently replacing them with the first role.

Every targeted command verifies the user exists. Self-deactivation and self role/clinic changes throw. Deactivation sets `inactive`, `deactivatedAt` and `sessionsRevokedAt`, without deleting or reassigning any case/task/history. Reactivation validates access, sets `active`, clears only `deactivatedAt` and preserves the last `sessionsRevokedAt`. Repeating an already-effective activation status or unchanged access is a no-op after permission and target validation. Delete User remains absent.

The existing role switcher excludes inactive/invited/locked accounts and no longer offers a role removed from its mapped demo user. It remains a fixed role-to-seed-user simulator, not a real login/user-session model; newly created users can be activated and audited but are not new impersonation entries.

### Confirmation and error UI

Existing confirmation dialog is reused for deactivation, activation, session revocation and password-reset request. Access editing opens that same confirmation dialog with proposed roles/clinics; cancellation performs no mutation. Role reset has an explicit confirmation. Command errors remain in the relevant dialog as `role=alert`, and role toggles show errors inline. Prototype copy states explicitly that reset/invitation emails and actual session operations are not sent/performed.

### Administrative audit

The shared `AuditEventType` now includes `user_invited`, `user_activated`, `user_deactivated`, `user_password_reset_requested`, `user_sessions_revoked`, `user_access_changed`, `role_permissions_changed`, `role_permissions_reset`, `access_denied`. Successful commands use canonical actor IDs, `targetUserId` or `targetRole`, correlation IDs, safe summaries and before/after where meaningful. No password, token, reset link or credential is recorded.

Audit Log labels and filters cover these types. Actor and target display/search resolves against the live UserDirectory, preserving inactive users and showing users created this session. `audit:view` guards both the route and log component. Default Operator has no Audit Log; AIHub Admin retains central administrative events and case Audit/Activity. Old `assignment_change` entries remain readable.

### Boundaries

No IdP/backend/authentication API is added. Invitation/reset/revoke are timestamps and audit emulation. User and permission mutations reset after reload. The current actor in AuthorizationContext is the canonical seed user mapped to the demo role (UserDirectory is nested below it; no circular context dependency is added). Production requires authenticated actor resolution, durable user/session state, server-side enforcement, transactional last-admin protection and an immutable audit service. These client checks are demonstrational, not a production security boundary.

### Verification evidence

`node --test tests/rbac-user-hardening.test.cjs` executes the actual TypeScript command source in an isolated minimal hook host. It covers denied commands with unchanged state/audit, batched duplicate email, invalid inputs/targets, self-protection, lifecycle timestamps, typed audit, protected admin, immediate permission revocation, inactive/removed-role actors and live actor/target name resolution. It does not verify React rendering, DOM confirmation behavior or actual IdP sessions. Browser UAT remains unexecuted: local Chromium was absent and the attempted browser download was not a valid ZIP. No test harness route is retained.
