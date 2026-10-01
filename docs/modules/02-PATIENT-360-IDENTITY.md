# Module specification: Patient 360 and identity

## Goal and problem

Maintain one durable patient profile while preserving every contact identity and interaction case. Current contact cards may describe the same person and require a reliable merge/link process. Medical CRM remains the primary source for clinical identity facts where connected.

## Core entities

| Entity | Purpose |
|---|---|
| Patient | Persistent person profile, not a funnel card |
| Contact Identity | Phone, e-mail, social handle, website/personal-account ID |
| Patient Link Candidate | Suggested match with evidence and confidence |
| Merge Decision | Approved/rejected merge, survivor and audit evidence |
| Field Provenance | Source, value, update time and conflict state per field |

## Functional requirements

1. One patient can own multiple contact identities and multiple cases.
2. Profile shows demographics, identifiers, clinics, owners, cases, tasks, appointments, treatment plan and all communication threads.
3. Authorized users can fill missing local data directly from a case/chat.
4. Medical fields synchronized from the source system cannot be silently overwritten locally.
5. Exact unique match by normalized phone, e-mail or external patient ID may link automatically according to tenant policy.
6. Ambiguous or conflicting matches require manual approval.
7. Unknown contacts remain workable without forcing creation of a patient.
8. Merge selects one survivor, moves relationships and preserves aliases and audit history.
9. Unmerge is an administrator-controlled corrective operation when technically possible.

## Matching policy

- exact external patient ID: strongest evidence;
- exact verified phone/e-mail: eligible for automatic link only when unique;
- name/partial number/free text: suggestion only;
- multiple candidates: manual review queue;
- no candidate: keep unlinked contact and case.

Matching thresholds and auto-link permissions are configuration, not component logic.

## RBAC and sensitive data

- basic contact data and medical data use separate permissions;
- PESEL and clinical documents require field-level access and masking where appropriate;
- merge/resolve-conflict permissions are independent from ordinary profile editing.

## Acceptance criteria

1. Opening any linked case shows the same patient-level data and complete case list.
2. Two contacts with one unique verified phone link according to configured policy.
3. Two candidate patients never merge automatically.
4. Updating a local field records provenance and does not overwrite authoritative medical data.
5. Merge keeps all cases, tasks, messages and source attribution accessible.

## Open decisions

- exact auto-link policy and approval role;
- ownership of non-medical profile fields;
- retention/unmerge window after an incorrect merge.

