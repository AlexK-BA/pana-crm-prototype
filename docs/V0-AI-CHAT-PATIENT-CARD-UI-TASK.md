# V0 Task — AI Chat Controls, KB Sources and Patient Card Safety UI

Use the current `main` after the AI governance branch is merged. This is a constrained UI implementation/polish task. Do not invent a second state model and do not rewrite the CRM.

## Objective

Make the existing AI governance contracts understandable in the conversation workspace and make Patient/Lead status/provenance impossible to misread. Preserve the current channel-first messenger layout, search, filters, bot/operator handoff, SMS flow, Patient 360 tabs and responsive behaviour.

## Existing contracts to use

- `Interaction.senderKind` and optional `Interaction.aiTrace`
- `ConversationControl.mode`, `aiEnabledOverride`, `aiDisclosureShownAt`
- `BotActivationSchedule` and `activationRemainingMs`
- `AiConversationPolicy`
- permissions `ai:trace_view`, `ai:manage`, `communication:view`, `communication:send`
- existing `useScopedEntityStore`; it already strips AI trace for unauthorised roles
- existing Patient/Case/Task/Interaction entities and Patient 360 selectors

## Required chat UI

1. Keep channels in the left column (WhatsApp, Instagram, Facebook, Telegram, website, SMS, phone, e-mail, etc.), not one row per message.
2. In the active thread header show one compact AI status component:
   - human owner / bot owner / paused / closed;
   - pending countdown formatted `mm:ss` from schedule `dueAt`;
   - clear copy that a human reply cancels the timer;
   - overdue human-handoff SLA warning when available.
3. Admin (`ai:manage`) actions:
   - enable/disable AI for this conversation with confirmation and required reason;
   - takeover / return to bot / pause using existing commands;
   - never mutate policy directly from the chat header.
4. Bot messages:
   - retain visible `AI/Bot` label;
   - show a compact “Źródła (N)” action only with `ai:trace_view`;
   - open a drawer/popover containing source title, version, section/page/chunk, retrieval time, relevance, model/policy/prompt versions, run ID and escalation reason;
   - explicitly state that sources/evidence are shown, not hidden model reasoning;
   - show a warning when the allowed no-source reason was used;
   - do not render a URI as an active external link unless the backend later provides an allowlisted URL.
5. Show a persistent, clear AI disclosure in patient-facing conversation state (“Rozmawiasz z wirtualnym asystentem…”) from the first AI interaction. Do not rely only on the small `Bot` badge.
6. For medical/emergency/no-source/low-confidence handoff, show a high-visibility banner with “Przejmij rozmowę”; do not offer a one-click AI answer.
7. Keep attachment controls marked demo until real upload/storage exists.

## Required Patient / Lead card UI

1. In the sticky/top header make entity state explicit:
   - `Lead / niepowiązany kontakt`, `Matching pending/conflict`, or `Potwierdzony pacjent Medical CRM`;
   - clinic, responsible person, next task and overdue count;
   - source freshness / last Medical CRM sync.
2. Add source badges at section/field level where data may be confused:
   - Medical CRM (authoritative/read-only),
   - verified contact,
   - local CRM,
   - unverified intake,
   - AI communication (not a patient fact).
3. Do not show treatment-plan/medical actions for an unlinked lead.
4. Keep next action and matching/conflict warnings above secondary details.
5. Keep Cases, Tasks, Communications, Activity, Comments and Medical CRM as separate tabs/sections; use progressive disclosure instead of a permanent right sidebar.
6. In Activity, label bot interactions as `AI communication`; never present AI text as an update to patient data.
7. Implement the patient data and source presentation exactly as defined in `PATIENT-APPOINTMENT-COMPLIANCE-UX-SPEC.md`: address, ContactIdentity phone/e-mail, clinic, Personal Account state, allergies, treatment-plan history and visit history.
8. Replace the appointment quick popover with the large calendar/day/time/summary flow from that specification.
9. Simplify the stage-transition dialog to operator consequences. Raw workflow/n8n/SLA fields belong only in collapsed Admin technical details.

## Settings UI

Add an Admin-only AI settings panel backed only by `aiConversationPolicies` and `updateAiConversationPolicy`:

- enabled;
- channels;
- activation delay seconds;
- human takeover SLA seconds;
- low-confidence threshold;
- maximum consecutive bot messages;
- handoff toggles for patient request, medical request, emergency language, missing source and low confidence;
- read-only intended use: `administrative_non_clinical`;
- version, updated time/by;
- save confirmation with required reason.

Do not add model credentials, raw prompts, API keys or KB document editing to the frontend.

Add a separate Admin Compliance Center according to `PATIENT-APPOINTMENT-COMPLIANCE-UX-SPEC.md`. It must reference the canonical runtime policy and use versioned, approved AI transparency/GDPR content. It must not ask an LLM to generate legal policy from scratch.

## States to design/test

- no control / manual;
- countdown pending;
- operator replies before zero;
- bot becomes active at zero;
- admin disables/re-enables AI;
- another operator owns the thread;
- no source / low confidence / medical handoff;
- admin source panel;
- operator without trace access;
- unlinked lead, matching conflict, linked patient, stale/failed Medical CRM sync;
- empty, loading, forbidden and command-error states;
- desktop and mobile list/thread switch.

## Do not touch

- entity definitions and canonical state semantics;
- EntityStore command guards;
- Patient Matching policy;
- workflow/task/calendar rules;
- telephony/SMS provider logic;
- RBAC architecture or role IDs;
- medical-field ownership;
- audit event semantics;
- existing `format.ts`, i18n fixes and call auto-open.

If the UI needs data not present in these contracts, stop and list the missing contract instead of creating local component state as a second source of truth.

## Acceptance checklist

- `pnpm exec tsc --noEmit`, `pnpm build`, `node --test tests/*.test.cjs`, `git diff --check` pass.
- Existing channel/search/filter/SMS/phone/handoff flows regress cleanly.
- Operator cannot access source trace through rendered DOM/props from scoped store.
- Admin source panel uses the demo `int-12` response and renders its versioned citation.
- Countdown is derived from `dueAt`; no independent durable client timer is introduced.
- All toggles use existing commands and display controlled errors.
- Provide screenshots for Admin and Operator in linked Patient and unlinked Lead states.
