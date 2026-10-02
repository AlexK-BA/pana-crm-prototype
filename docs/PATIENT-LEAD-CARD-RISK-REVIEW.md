# Patient / Lead Card Risk Review

Review date: 2026-10-02. Scope: current Patient 360, case drawer, matching, tasks, communications, Medical CRM projection and AI controls.

## 1. What is already structurally correct

- Patient and Engagement Case are separate canonical entities; one Patient may have many cases.
- Medical CRM remains the primary source for identity/clinical data; medical fields are read-only in CRM.
- Matching has confidence/conflict/approval flows and clinic scope.
- Tasks, communications, comments and audit remain separate entities.
- Medical permission is separated from basic Patient access; Marketing receives no Patient PII.
- AI response remains communication history and is not copied into medical fields.

## 2. Risk register

| Priority | Risk | Current mitigation | Required production action |
|---|---|---|---|
| P0 | Frontend/session state is not a security or persistence boundary | Prototype command guards and scoped projections | Repeat RBAC, clinic scope, matching and AI trace controls in backend/API; persistent transactional store. |
| P0 | AI text may be mistaken for verified patient/medical fact | `aiTrace`; AI is an Interaction only | Visually label AI content everywhere; never use it to populate Patient/medical fields without explicit human verification and provenance. |
| P0 | Health/identity data can be sent to a model/vendor | Intended-use restriction only | DPIA/vendor review; strict minimisation; configurable redaction; prohibit unnecessary PESEL/treatment-plan transfer. |
| P0 | Bot gives clinical/emergency advice | Non-clinical policy and handoff rules | Server-side classifier/rules, approved emergency copy, immediate human routing; red-team tests. |
| P0 | Wrong Patient link contaminates history | Matching conflict/approval and immutable medical fields | Backend uniqueness/transactions; prominent unresolved-match state; never let AI approve matching. |
| P1 | Local/basic/medical/AI-derived values are visually conflated | Medical CRM tab and provenance list | Add persistent source badges per field/section: Medical CRM, verified contact, local CRM, unverified intake, AI communication. |
| P1 | `contactable` is too coarse for real channel consent/preferences | Send guard exists for SMS | Model per-channel purpose/consent/opt-out and effective date; enforce before every provider call. |
| P1 | Admin source trace could reveal sensitive KB material | Dedicated `ai:trace_view` | Backend redaction/download policy; do not put secrets or patient data in KB citations. |
| P1 | Stale medical data may look current | Integration/sync status shown | Add last-sync freshness threshold and blocking warning on time-sensitive actions. |
| P1 | Patient and unlinked lead UI can look identical | Integration badges and matching warnings | Explicit header state: Lead/unlinked contact vs confirmed Patient; suppress clinical actions for unlinked lead. |
| P2 | Dense Patient 360 can hide next action and risk state | Header shows next task and warnings | V0 visual hierarchy task: sticky identity/risk/next-action strip; progressive disclosure for secondary data. |

## 3. Non-negotiable invariants

1. AI output never changes Patient identity, PESEL, treatment plan, medical summary, clinic-of-record or matching decision automatically.
2. Unlinked lead/contact never receives a synthetic Patient profile or Medical CRM data.
3. Medical CRM conflict is visible and cannot be resolved by a local overwrite.
4. Every action belongs to a specific Case/Task/Interaction and remains attributable.
5. Patient-facing send checks contactability and, in production, channel consent/preferences.
6. All privileged AI source/setting access is server-authorised and audited.
7. A failed/superseded task, match decision, timer or AI answer stays in history.

## 4. Refactoring decision

Do not create another Patient Card store. Patient Profile and case drawer remain projections of EntityStore. New AI metadata is attached to canonical Interaction; timer/policy state is canonical configuration/control data. V0 may reorganise components but must not duplicate Patient, Case, Task, Interaction, ConversationControl, AI policy or schedule state.

## 5. Acceptance scenarios

- Admin opens a bot answer and sees the exact KB document/version/chunk used; Operator sees the bot label but not privileged trace.
- Patient asks a clinical question: bot does not answer clinically, timer/autonomy stops and a human handoff is shown.
- Patient sends a second message before activation: old timer remains as cancelled audit history and the new timer becomes canonical.
- Operator replies before countdown ends: timer is cancelled and bot cannot send afterward.
- Admin disables AI for one thread: policy stays unchanged for other threads; override and reason are audited.
- Unlinked lead card shows only intake/case data; no Medical CRM plan or Patient claim appears.
- A bot message appears in Patient activity as AI communication, never as a medical-field update.
