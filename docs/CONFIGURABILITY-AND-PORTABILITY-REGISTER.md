# Configurability and portability register

Status: living architecture document  
Updated: 2026-10-02

## Goal

Keep the CRM reusable for another clinic group without forking the product or rewriting operator workflows. New clinics should be onboarded primarily through tenant configuration, catalog imports and integration adapters.

## Current assessment

The current prototype is a good validation base for operator workflows, Patient 360, cases, tasks, conversations and RBAC. It is not yet a white-label/multi-tenant product. The main limitation is not the UI but static domain configuration embedded in frontend TypeScript.

Estimated adaptation today:

- another clinic inside the PaNa group with the same processes: low–medium complexity;
- another dental network with different funnels, procedures and telephony: medium–high complexity;
- a non-dental clinic: high complexity until catalogs, workflow rules and terminology are moved to configuration.

## Bottleneck register

| ID | Area | Current constraint | Impact on another clinic | Target solution | Priority | Status |
|---|---|---|---|---|---|---|
| CFG-01 | Tenant/clinic model | `ClinicId` is a TypeScript union containing exactly three PaNa clinics. | Every new clinic requires code and rebuild. | Persistent `Tenant` and `Clinic` entities with string/UUID identifiers. | P0 | Open |
| CFG-02 | Clinic catalog | Clinics, doctors and procedures are static arrays in `lib/crm/catalog.ts`. | Catalog updates require development. | Admin-managed catalog or synchronized Medical CRM catalog. | P0 | Open |
| CFG-03 | Workflows | Boards and several stage rules are code-defined. | Different funnels require a fork or code changes. | Versioned workflow definitions: board, stages, transitions, automatic tasks, SLA and validation rules. | P0 | Foundation exists; configuration missing |
| CFG-04 | Telephony | Call domain and documentation are Yeastar-oriented; calls contain `extension`. | Replacement PBX/cloud telco will leak into UI and data model. | `TelephonyProvider` adapter; canonical call/event/status model; provider payload in integration log only. | P0 | Open |
| CFG-05 | SMS | Previously treated as a generic interaction without delivery/provider facts. | Provider replacement would require UI changes. | Provider-neutral SMS service and per-clinic configurations. | P0 | Prototype foundation implemented |
| CFG-06 | Medical CRM | PaNa Medical CRM is assumed as the primary clinical source. | Another clinic may use a different HIS/EMR or none. | `ClinicalSystemAdapter`, provenance policy and field-level source-of-truth configuration. | P0 | Open |
| CFG-07 | Identity matching | Patient match rules are currently simplified around phone/email. | Different data quality and identifiers create false matches. | Configurable match policy with confidence thresholds and manual approval queue. | P0 | Partially implemented |
| CFG-08 | Branding | App title, sidebar label, colors and copy contain PaNa branding. | White-label deployment requires code changes. | Tenant theme, product name, logo, locales and clinic color configuration. | P1 | Open |
| CFG-09 | Languages/content | Many interface and demo strings are inline Polish text. | New locale/market requires component changes. | Complete i18n extraction and tenant-specific content. | P1 | Partial i18n only |
| CFG-10 | Roles | Role profiles exist in code, while permissions are only partly atomic. | Clinics with different teams cannot model access safely. | Permission catalog + configurable roles + backend enforcement. | P0 | Foundation exists |
| CFG-11 | Data scope | Frontend provides prototype clinic filtering, not a security boundary. | Multi-clinic deployment risks data leakage without backend enforcement. | Tenant/clinic row-level authorization on every query, mutation, event and export. | P0 | Prototype only |
| CFG-12 | Communications | Channels share a generic composer but provider accounts and routing are not modeled for each channel. | WhatsApp/social/email onboarding may require custom UI changes. | `CommunicationAccount` + channel adapters + routing by tenant/clinic. | P1 | Open |
| CFG-13 | Forms/sources | Lead source values and several intake defaults are code-defined. | New forms and campaigns require releases. | Source registry, form mapping and configurable normalization rules. | P1 | Open |
| CFG-14 | Reporting | Metrics are derived from demo state and PaNa-specific statuses. | Custom workflows break comparable reports. | Canonical events and semantic metric definitions mapped from workflows. | P1 | Open |
| CFG-15 | Retention/compliance | Retention and consent rules are not tenant-configured. | Different legal/operational policies cannot be applied. | Retention, consent, recording and export policies per tenant/clinic. | P0 for production | Open |

## Rules for all new development

1. React components must call internal domain services, never provider APIs.
2. Provider-specific identifiers and raw statuses must not become workflow statuses.
3. Clinic selection must come from case/tenant configuration, never from a default PaNa clinic hidden in code.
4. New dictionaries must have stable IDs and be editable/synchronizable without changing components.
5. Historical records keep a snapshot of the configuration used at execution time.
6. Disabling a clinic, user, provider, template or workflow version must not destroy history.
7. Authorization is enforced on the backend; frontend filtering is only UX.
8. Every integration requires: capabilities, health state, idempotency, retry policy, audit and provider payload isolation.
9. Tenant branding and terminology must not affect canonical domain entities.
10. Each new feature review must update this register when it introduces or resolves a portability constraint.

## Recommended technical sequence

1. Introduce persistent Tenant/Clinic and replace the closed `ClinicId` union.
2. Move doctors, procedures and communication accounts into configurable catalogs.
3. Complete workflow rules engine and versioned funnel configuration.
4. Extract Yeastar behavior into a TelephonyProvider interface before adding another telco.
5. Introduce ClinicalSystemAdapter and configurable source-of-truth/provenance rules.
6. Complete configurable RBAC roles and backend clinic/tenant scope.
7. Extract branding, terminology and remaining inline strings.

## Definition of portable feature

A feature is considered portable when a new clinic can enable it by configuration and catalog/integration setup, without changing React components, canonical entities or workflow source code, and historical data remains readable after any provider/configuration change.
