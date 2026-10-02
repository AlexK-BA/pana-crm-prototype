# Patient Matching & Contact Linking Flow

## Source of truth and adapter boundary

Medical CRM remains the primary source of Patient and clinical facts. The prototype evaluates the existing canonical `EntityStore.patients` and `identities` as a local emulation of Medical CRM lookup results. `patient-matching-service.ts` is stateless and provider-neutral: input is `PatientMatchInput`, canonical Patient/ContactIdentity references and ownership constraints; output is outcome, ranked ID-only candidates, confidence, named signals, conflicts, reason and revision fingerprint. React components never call PaNa APIs. No Patient is copied into a candidate or created by contact intake.

`EngagementCase.contactProfile` stores operator-entered lookup input, not another Patient. `contactIdentityIds` references its primary and supplementary contacts. `EntityStore.matchDecisions` is part of the existing store. An internal ref points to the same arrays to validate consecutive commands before React renders; it is not another source of truth. No runtime mutation of exported seed arrays is used.

## Policy

All confidence values and the auto-link threshold live in `patient-matching-policy.ts`:

| Signal | Base confidence | Rule |
|---|---|---|
| externalPatientId | 1.0 | Trim, case-sensitive exact match |
| PESEL | 0.98 | Strip whitespace; exact 11 digits; no medical/checksum verification |
| Verified phone/email | 0.95 | Normalize and match the Patient's verified canonical contact |
| Unverified phone/email | 0.85 | Suggestion only |
| Known social/chat ContactIdentity | 0.95 verified / 0.85 unverified | Exact normalized channel/value already owned by Patient |
| Exact first + last name only | 0.35 | Suggestion only; never auto-link |

Phone removes whitespace, brackets and hyphens, accepts Polish 9-digit local numbers, `48`, `+48`, `0048`, and canonical international `+` numbers of 8–15 digits. Polish national numbers beginning with zero and malformed identifiers are excluded. Email is trimmed, lowercased and checked for a basic format. Invalid identifiers contribute no matching evidence; profile editing rejects them with a controlled error.

Each additional independent agreeing identifier adds 0.01; agreeing name and clinic add 0.005 each. Non-external-ID confidence is capped at 0.99. Clinic is context, not an identity signal. A name-only alternative cannot displace unique identifier evidence. All identifier candidates are assessed globally before applying display scope, so a second patient outside the user's clinic cannot be silently dropped to manufacture uniqueness.

The outcomes are `auto_link`, `suggested_match`, `ambiguous`, `conflict`, `no_match`. Auto-link requires exactly one identifier candidate, confidence >= 0.95, consistent external ID/PESEL, no case/contact belonging to another Patient, and Patient within acting user's scope. Scope may downgrade an otherwise exact auto-link to a suggestion. Shared phone/email or duplicated hard ID cannot select the first candidate. Hard-ID disagreement or case/contact ownership disagreement produces conflict.

## Approval and history

`patient:match_approve` defaults to Admin, Team Leader and Clinic Manager. The first two retain existing global scope; Clinic Manager is limited to assigned clinics. Operator receives only a safe verification notice and may continue operational work, edit permitted case-local contact data or rerun search. Marketing receives no candidates. Candidate details require approval capability plus `patient:view_basic`; external Medical CRM ID display additionally requires `patient:view_medical`. Identifiers in the panel are masked.

Commands check current capabilities and scope, including direct calls to the EntityStore without an access capability (rejected). The scoped adapter passes capabilities from the existing AuthorizationContext/UserDirectory, not a second role model. Raw client capabilities are not backend authentication; production must repeat every guard server-side. Rejected commands change neither data nor audit.

Manual approve/reject require confirmation and a reason. Approval rechecks the latest decision, input/result fingerprint, candidate membership, target Patient scope, case ownership and every attached contact owner immediately before mutation. A bound case/contact can never be transferred to another Patient, even by an Admin. Contradictory lookup evidence may be reviewed manually with a reason only when those ownership constraints remain safe. Out-of-scope multi-patient rejection requires a global reviewer.

Decisions retain ID-only candidates and statuses `pending`, `approved`, `rejected`, `auto_linked`, `conflict`, `expired`, timestamps, resolver, outcome, confidence, signals, conflicts, reason and revision. Rerun expires only earlier unresolved decisions; approved/rejected/auto-linked records and original search reasons remain. Stale approvals are rejected. Rejection does not delete candidates, link a Patient or block a subsequent search.

## Linking invariants

Link sets only the target case's Patient/contact references, allowed ContactIdentity ownership, and missing Patient references on that case's tasks/interactions. Patient fields, synchronization state, attribution snapshots, task IDs/status/deadlines/attempts, workflow, other cases and their assignments remain untouched. Patient 360 and communication history project the newly associated case from the existing store.

An identical normalized channel/value already owned by the selected Patient is reused; draft intake avoids creating a duplicate identity. During manual resolution a pre-existing unlinked source contact is retained for historical attribution, while the target case references the canonical reused contact. Supplementary contact edits are conservative: old case-contact evidence remains available and can expose conflicts rather than silently hiding a former identity. No automatic cross-case merge occurs.

## Incoming contacts and call lifecycle

Manual case creation and `createDraftCase` run the same engine, as do known-identity incoming messages, known-case incoming calls and drawer rerun. Incoming messages receive the case's canonical Patient reference, never a caller-supplied competing Patient ID. Demo reply errors surface in the composer.

Topbar **Simulate call → Sprawdź znany numer (Patient Matching)** resolves a normalized number. Only a safe Patient and exactly one accessible active case open automatically. Zero or several cases ask the operator to consciously create/select a case; no case is created by routing. Ambiguous/conflicting contacts return a safe notice without opening a candidate's profile. Closed/converted/completed/complete/archived cases are excluded. The existing answer/decline/hangup/mandatory wrap-up and task workflow are unchanged; no new call bypass is introduced. Explicit demo case selection still opens that chosen case, not the first matching Patient.

## Audit and privacy

The shared Audit Log supports `patient_match_searched`, `patient_match_suggested`, `patient_auto_linked`, `patient_match_approved`, `patient_match_rejected`, `patient_match_conflict`, `contact_identity_linked`, `contact_identity_reused`. Decision-related records carry case/Patient IDs where applicable, decision/correlation ID, confidence, signal names, reason and before/after references. Automated assessment/link uses `system`; manual search/approval/rejection uses the canonical current user. Routing before case selection has no case decision ID and records only outcome/signal names and a routing correlation ID.

Audit never includes submitted lookup values. Free-text approval/rejection reasons are redacted for email and long numeric identifiers before audit storage. Case-local input and full decision reasons are sensitive session data; production needs encryption, retention, authorized retrieval, robust PII redaction and durable audit. Frontend masking is not a security boundary.

## Future backend and portability

Persist decisions, canonical contacts and audit atomically with optimistic concurrency or row locking, idempotency, tenant/clinic authorization, authenticated actor identity and revision tokens stronger than the session-local noncryptographic fingerprint. Medical CRM adapters should return canonical references/verification provenance through this contract; provider payloads remain outside the UI. Handle upstream changes, multiple numbers, stale verification and cross-clinic identity explicitly. The PL country-code convention and confidence settings must become tenant configuration; replace the closed ClinicId/catalog seeds, branding and inline text for other clinics. No PaNa API, real provider, credentials, backend or new identity-verification claim is introduced in this increment.

## Validation

`node --test tests/patient-matching.test.cjs tests/rbac-user-hardening.test.cjs` executes real TypeScript service and provider commands with synthetic fixtures and an isolated hook host. It checks behavior/state/audit invariants, not React rendering, browser interactions or backend authorization. Browser UAT is documented separately and remains unperformed when Chromium is unavailable.
