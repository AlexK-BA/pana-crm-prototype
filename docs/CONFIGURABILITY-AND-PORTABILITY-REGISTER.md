# Configurability and portability register

Status: living architecture document  
Updated: 2026-10-02

See also: [TRACEABILITY-AND-ARCHITECTURE-ALIGNMENT.md](TRACEABILITY-AND-ARCHITECTURE-ALIGNMENT.md) for mapping to the current Frappe/FastAPI/Yeastar architecture and stakeholder sources.

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
| CFG-10 | Roles | Atomic permissions and runtime-editable role bundles exist only in prototype state. | Clinics cannot persist or centrally enforce their own access model yet. | Persist versioned permission bundles and enforce them in Frappe/FastAPI. | P0 | Prototype foundation implemented |
| CFG-11 | Data scope | Frontend provides prototype clinic filtering, not a security boundary. | Multi-clinic deployment risks data leakage without backend enforcement. | Tenant/clinic row-level authorization on every query, mutation, event and export. | P0 | Prototype only |
| CFG-12 | Communications | Channels share a generic composer but provider accounts and routing are not modeled for each channel. | WhatsApp/social/email onboarding may require custom UI changes. | `CommunicationAccount` + channel adapters + routing by tenant/clinic. | P1 | Open |
| CFG-13 | Forms/sources | Lead source values and several intake defaults are code-defined. | New forms and campaigns require releases. | Source registry, form mapping and configurable normalization rules. | P1 | Open |
| CFG-14 | Reporting | Metrics are derived from demo state and PaNa-specific statuses. | Custom workflows break comparable reports. | Canonical events and semantic metric definitions mapped from workflows. | P1 | Open |
| CFG-15 | Retention/compliance | Retention and consent rules are not tenant-configured. | Different legal/operational policies cannot be applied. | Retention, consent, recording and export policies per tenant/clinic. | P0 for production | Open |
| CFG-16 | User directory | Prototype users and telephony extensions now have one canonical catalog, but it is still a frontend seed. | Adding users/extensions in production cannot rely on a deployment artifact. | Identity-service/Frappe user API with stable IDs, clinic scope, roles and provider extension mappings. | P0 | Duplicate seeds removed; backend persistence open |

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

## SMS Stage 1 portability assessment (2026-10-02)

- SMS uses the existing `SmsMessage extends Interaction` and `EntityStore.interactions`, with no additional message store. Patient, case and task references remain canonical IDs.
- No provider API or PaNa brand is required by the adapter contract. `providerType` is an extensible provider ID; `name` is the configuration display name. Stage 1 routes all provider selections through the same emulator. Future SMSAPI, SuperVoIP or custom adapters belong behind the internal service on the backend.
- Clinic configuration is selected by case clinic, or patient primary clinic for unbound SMS, then enabled global fallback. Sender and working text are editable by authorized administrators; messages retain execution metadata.
- Remaining hardcode: `lib/crm/sms-service.ts` seeds PaNa clinic IDs, names, senders and Polish working texts; fallback text, emulator timings and the approximate parts calculator are code-defined. Provider capability examples are demo assumptions, not verified production capabilities. `components/crm/sms-provider-settings.tsx` lists known provider choices; the contract supports additional IDs, but the prototype has no provider-registration UI.
- `lib/crm/entities.ts` still has the closed PaNa `ClinicId` union; `lib/crm/catalog.ts`, branding and inline Polish labels remain existing portability constraints. The SMS change does not claim to make the whole CRM white-label.
- For another clinic: replace tenant/catalog seeds, configure clinic/global senders and working texts, complete i18n, introduce persisted provider registrations/configurations and server-side scope/permissions/audit. Preserve `SmsMessage` and UI commands when connecting an adapter; credentials must stay in a backend secret manager.
- Client state resets on reload. Production requires durable message IDs, atomic/idempotent dispatch, authenticated delivery receipts and retry policy. Stage 2 templates/workflow automation and Stage 3 inbound routing remain separate increments.

## Patient matching portability assessment (2026-10-02)

- The stateless `patient-matching-service.ts` evaluates provider-neutral canonical references; no PaNa API dependency, additional Patient/React store or duplicate Medical CRM record is introduced. Future adapters supply canonical Patient/contact results behind the same contract.
- Confidence and country-code settings are centralized in `patient-matching-policy.ts`. Matching considers clinic context and uses existing clinic scope; clinic is never sufficient identity evidence. Review permission is configurable in the existing Role & Permissions matrix.
- Remaining hardcode: Polish default country code/local-number length, code-defined confidence values/boosts, 11-digit PESEL format, terminal case-status IDs, inline Polish UI labels, existing PaNa `ClinicId` union/catalog and seeded Medical CRM IDs. `createDraftCase` retains the pre-existing `pana-medica` attribution clinic-intent fallback when no clinic is selected; it does not assign that clinic to the case. This remains a portability risk to remove with tenant attribution configuration.
- For another clinic: configure numbering/identifier policies and verification provenance, catalog clinics and role scopes, external clinical adapter mapping and branding/i18n. Do not change UI/business logic to embed a provider API. Clinical data continues to come from that clinic's designated primary medical system.
- Production work: persisted decisions/contacts, transactional link/audit, authenticated scope enforcement, concurrency/versioning, idempotency, robust reason redaction, privacy/retention policies and asynchronous Medical CRM result handling. Session-local fingerprints, frontend scope/masking and emulated verification are prototype-only.

## Patient 360 portability review

Patient 360 consumes canonical scoped projections, existing clinic/procedure catalogs and workflow rules. Its commands do not depend on a PaNa-specific provider or Medical CRM implementation. New cases use configured clinic/service choices and retain separate attribution. Existing SMS/telephony adapters remain intact.

Remaining hardcode: clinic/procedure catalogs and initial funnel stages (leads:new, deals:scheduled, patients:new_patient), fixed channel list including TikTok Potential, and Polish workspace labels. No medical summary field exists; no synthetic replacement is introduced. These choices need tenant catalogs, workflow entry configuration, channel activation and translation resources for another clinic. Medical CRM contract, credentials, persistence and server authorization belong to future backend adapters, not frontend mock data. Patient 360 itself adds no credentials or external API calls.
