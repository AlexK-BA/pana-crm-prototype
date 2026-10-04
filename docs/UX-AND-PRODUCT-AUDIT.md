# CRM critical UX and product audit

Status: pre-UAT product and UX audit  
Updated: 2026-10-04

## Executive conclusion

The prototype has a coherent canonical model and strong command-level safety, but the UI still exposes too much implementation language and too many parallel ways to reach the same work. The largest remaining risk is not missing screens; it is divergence between an operator's simple mental model and the system's technical model.

Target interaction: **event → prioritized task → prepared context → one primary action → mandatory result → automatically proposed next action**.

## Findings

| ID | Severity | Finding | User/business impact | Action/status |
|---|---:|---|---|---|
| UX-01 | P0 | Operator start previously showed another user's team task as fallback. | Accidental work stealing and unclear accountability. | Fixed: only personal, then unassigned work can be proposed. |
| UX-02 | P0 | “Skip with reason” on the start page only opened the case. | Misleading action and extra click; user cannot predict result. | Fixed: removed. Call-required next action starts call directly; other work opens the case. |
| UX-03 | P0 | Call-required task has several generic task controls in some detailed views. | Risk that staff search for a bypass rather than complete mandatory call wrap-up. | Domain blocks bypass; continue simplifying TaskActions presentation. |
| UX-04 | P0 | Appointment UI is a demo availability calendar but no canonical Appointment/Medical CRM write exists. | Users may confuse “saved in CRM” with a real reserved visit. | Explicit DEMO copy exists. Production requires adapter, structured appointment and conflict/idempotency handling. |
| UX-05 | P1 | Settings were one long page mixing workflows, users, clinics, SMS, bot, KB and compliance. | High cognitive load and risk of editing the wrong area. | Fixed: task-oriented four-section settings hub. |
| UX-06 | P1 | Kanban stage transition exposes technical terms (`override`, workflow IDs, SLA internals). | Ordinary managers must understand implementation concepts. | Primary form is simplified; technical block remains permission-gated. Replace terminology before production. |
| UX-07 | P1 | Case drawer is large and combines profile, work, communication, medical link and admin actions. | Important next action competes with secondary information. | Keep persistent header and tabs; next refactor should create a fixed “Now” action area and lazy-load secondary panels. |
| UX-08 | P1 | Patient 360 and case drawer partially duplicate profile/actions. | Users may not know which screen is authoritative. | Rule: drawer is case execution; Patient 360 is longitudinal patient view. Reflect in labels/navigation. |
| UX-09 | P1 | `/inbox` and Patient conversation workspace implement similar lists independently. | UI drift and duplicate fixes. | Extract shared channel/thread list, status and search primitives. |
| UX-10 | P1 | Calendar and schedule expose technical task type/status text and dense controls. | Higher training cost; mobile operation is difficult. | Keep canonical Task projection; redesign cards/action sheet after UAT observation. |
| UX-11 | P1 | PL/RU i18n is partial; many older screens contain inline Polish. | Mixed-language experience and harder reuse. | Continue dictionary extraction by route; do not translate patient/authored content automatically. |
| UX-12 | P1 | AI Compliance Center looks like configuration but is read-only/static. | Admin may assume changes can be published. | Keep readiness/preview wording; production editor needs draft/version/approval/publish/audit. |
| UX-13 | P1 | AI/KB settings are session-only and allow destructive-looking article deletion. | False confidence and no governed publication lifecycle. | Replace with draft/archive/version semantics in backend phase; never physically delete published evidence. |
| UX-14 | P2 | Case cards displayed a dense technical sentence with active counts and `requiresCall`. | Poor scanability. | Fixed: explicit “Last”, “Now/Next”, current worker and exception state. |
| UX-15 | P2 | Task type Polish labels existed in two source files. | Translation/business copy drift. | Fixed: one canonical label catalog. |
| UX-16 | P2 | Several components exceed 300–500 lines; EntityStore exceeds 1,300 lines. | Review and regression risk; unrelated changes collide. | Split by bounded command/query modules after behavior freeze; do not create parallel stores. |
| UX-17 | P2 | Metrics/report screens derive values from demo state without formula contracts. | Stakeholders may approve visuals without agreeing definitions. | Document metric formulas/source/freshness before production analytics. |
| UX-18 | P2 | Role switching is mixed into Settings and acts as demo impersonation. | Could be mistaken for real account/role administration. | Clearly label as prototype preview; production must use authenticated user roles. |

## Simplification principles for subsequent development

1. One prominent primary action per work item.
2. Show exceptions and missing data before optional metadata.
3. Ask only for information the system cannot infer safely.
4. Prefill clinic, Patient, case, channel, owner and suggested deadline from context.
5. Hide provider IDs, workflow IDs and technical flags from ordinary roles.
6. Prevent invalid action before submission; error messages are the fallback, not the normal flow.
7. Preserve one canonical entity and project it into queue/calendar/board/profile.
8. Use progressive disclosure for supervisor overrides and audit details.
9. Never present an emulation as externally delivered or persisted.
10. Measure clicks from queue item to valid outcome, not page count.

## Recommended next refactor order

1. Case drawer “Now” panel and contextual default tab.
2. Shared Inbox/Patient conversation primitives.
3. Task/calendar action-sheet redesign and mobile layout.
4. Complete route-by-route PL/RU UI extraction.
5. Split EntityStore into domain command modules while preserving one provider/state graph.
6. Replace static settings with versioned backend configuration only after contracts are approved.
