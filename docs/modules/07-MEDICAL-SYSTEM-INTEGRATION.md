# Module specification: Medical system integration

## Goal and problem

Use the clinic medical system as the primary source for patient and clinical data while CRM remains the source for engagement cases, tasks and communication. The contract must also support clinics using another HIS/EMR.

## Architecture

CRM uses a `ClinicalSystemAdapter`; `PaNa CRM Adapter` is the first implementation.

Canonical capabilities:

- patient search/read/create/update where permitted;
- doctor/procedure catalog synchronization;
- appointment availability and booking;
- treatment-plan metadata/document retrieval;
- change/event synchronization;
- health and reconciliation.

## Source-of-truth policy

| Data | Recommended owner |
|---|---|
| Clinical patient ID, medical demographics, treatment plan | Medical system |
| Contact identities discovered by channels | CRM, synchronized when allowed |
| Cases, tasks, dispositions, marketing attribution | CRM |
| Doctors, procedures, appointment slots | Medical system or configured catalog owner |
| Field conflict/provenance | CRM integration layer |

## Functional requirements

1. New medical-system patients can create/link CRM patient profiles.
2. Existing contact cases attach to a patient after safe matching.
3. Synchronization is incremental, idempotent and observable.
4. Each synchronized field stores source and update time.
5. Conflicts do not silently overwrite data; policy or review determines resolution.
6. Treatment plan can be viewed/downloaded from CRM when permissions permit.
7. Adapter outage does not block local case/task work.
8. Reconciliation detects missing/out-of-sync records.

## Acceptance criteria

1. A different medical provider can implement the canonical adapter without changing Patient Profile UI.
2. Sync retry does not duplicate a patient or case.
3. Clinical fields show source and conflict state.
4. Integration outage is visible and local work remains available.
5. Treatment documents are permission-controlled and audited.

## Needs decision

- exact PaNa CRM APIs/events and writable fields;
- auto-link threshold and manual approval role;
- document storage versus on-demand proxying;
- data retention after external deletion/inactivation.

