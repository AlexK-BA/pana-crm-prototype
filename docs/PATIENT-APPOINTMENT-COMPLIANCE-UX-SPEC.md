# Patient 360, Appointment Calendar and Compliance Center

Status: target UX and integration contract, 2026-10-02. This document is not legal advice.

## 1. Patient 360 data ownership

The CRM presents one patient workspace, but must not become a competing medical database.

| Data | Canonical source | CRM behaviour |
|---|---|---|
| phone, e-mail and channel identities | `ContactIdentity` | show verified/local status; never duplicate on `Patient` |
| primary clinic | Medical CRM Patient projection | read-only; a case or visit may have another clinic |
| residential address | Medical CRM / Personal Account | read-only projection with source and freshness |
| Personal Account status | Personal Account backend | read-only status, verification and last login; never a manual checkbox |
| allergies | Medical CRM | protected medical data, read-only, visible only with `patient:view_medical` |
| treatment plans and documents | Medical CRM | show current plan and history; download/open requires backend-authorised document endpoint |
| visits | Medical CRM | show past and upcoming visits with clinic, doctor, procedure and status |
| cases, tasks, comments and communication | CRM | operational data, editable according to RBAC |

The prototype contract supports multiple visits and plan versions. Medical data must show unavailable/stale/sync-failed states and must never be silently replaced by chat or AI text.

## 2. Appointment booking target UX

Replace the small six-slot popover with a large responsive booking dialog (or full page on mobile):

1. Select clinic, procedure and optionally doctor.
2. Show a month/week calendar. Days expose availability, closed days and the selected day.
3. Show available times for the selected day in a separate panel, including duration and doctor where known.
4. Show a booking summary before confirmation.
5. Confirm through the Medical CRM availability/booking adapter. A local click is not a confirmed visit until the authoritative provider accepts it.
6. On stale slot or concurrency conflict, retain the selection, refresh availability and present a clear alternative.
7. After success, add the visit to the Patient projection, link it to the case/task and preserve audit/correlation IDs.

Required states: loading, no availability, provider unavailable, stale slot, permission denied, confirmed, cancelled and rescheduled. Cancellation and rescheduling preserve history. The Patient 360 Visits tab may additionally offer calendar/list views; the case quick action opens the same booking flow.

The current session-only slot generator remains an explicit demo. Do not create a second appointment store in a component and do not let n8n own the booking record.

## 3. Stage-transition dialog target UX

The default operator view must describe consequences, not implementation:

- `Przenieś z [current] do [target]`;
- concise next-action proposal with task title, due date and owner;
- explicit choice when an existing active task conflicts: keep, replace, complete or cancel, limited by permission;
- due date and comment fields only when needed;
- one confirmation action and one cancel action.

Hide raw fields such as `requiresCall`, SLA keys, workflow IDs, n8n keys and side-effect names. Admin may open a collapsed “Technical details” section. Manual admin overrides require a reason and remain auditable. Existing workflow guards and task/calendar commands are not changed by this UI simplification.

## 4. Admin Compliance Center

Add an Admin-only section with two deliberately separate configurations:

The canonical prototype contract is implemented in `lib/crm/ai-compliance.ts`. It validates policy-version links, resolves clinic-over-global publication and renders patient text deterministically. The first seed is deliberately a **draft** containing DPO placeholders and therefore cannot be displayed to patients.

### Runtime bot policy

Use the existing versioned `AiConversationPolicy`: enabled channels, activation delay, human takeover SLA, confidence threshold, turn limit, non-clinical intended use and handoff triggers. Do not copy these values into a second settings object.

### Approved transparency and GDPR content

Create a versioned configuration containing:

- controller identity, privacy/DPO contact and privacy notice URL;
- approved purpose, data-category and special-category-data descriptions;
- approved lawful-basis summary and retention statement;
- model/provider, processors, international-transfer and data-use statements;
- data-subject rights, complaint/contact route and human-handoff route;
- approved AI disclosure and privacy text per supported language;
- linked runtime-policy version, owner, approval reference, status (`draft`, `published`, `retired`) and timestamps.

Admin can edit drafts, preview the exact patient-facing notice and publish only with an approval reference. Published versions are immutable; updates create a new version. The response to a patient request is assembled deterministically from the current published version and linked bot policy. An LLM must not invent legal grounds, retention periods, vendors or patient rights.

No API keys, raw prompts, hidden reasoning or provider credentials belong in this UI. Every change/publication/access is permission-checked and audited. Production still requires DPO/legal approval, DPIA/classification review, backend enforcement and retention controls.

## 5. Acceptance criteria for V0 UI work

- Preserve canonical entities, scoped store, RBAC, audit, matching, workflow and provider adapters.
- Medical fields display provenance/freshness and are never editable locally.
- Calendar is keyboard-usable and works at desktop/mobile widths.
- An operator never sees workflow engine internals in the default stage dialog.
- Compliance drafts cannot be mistaken for published patient text.
- AI/GDPR text is previewed from approved fields, not generated freely.
- Add screenshots for linked patient, unlinked lead, booking success/error, operator transition and Admin compliance draft/published states.
- Run `git diff --check`, TypeScript, build and the full test suite.
