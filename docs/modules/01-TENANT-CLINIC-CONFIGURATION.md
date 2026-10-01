# Module specification: Tenant and clinic configuration

## Goal and problem

Allow one CRM product to serve PaNa Medica, PaNa Comfort, International and future clinic networks without source-code forks. Today clinics, colors, doctors and procedures are largely static frontend data, so onboarding a clinic requires development.

## Scope

- tenant and clinic lifecycle;
- branding, language, timezone and business hours;
- doctors, procedures and clinic-specific availability catalogs;
- assignment of workflows, channels and integration accounts;
- configuration inheritance and version history.

Out of scope: billing/subscription management and cross-tenant patient sharing.

## Core entities

| Entity | Key data |
|---|---|
| Tenant | ID, name, status, default locale/timezone, branding, policies |
| Clinic | ID, tenant, name, status, address, timezone, business hours, color |
| Doctor | ID, external IDs, clinics, procedures, active period |
| Procedure | ID, clinics, duration, category, active period |
| Integration Account | provider type, clinic/tenant scope, capabilities, health state |
| Configuration Version | subject, version, effective dates, author, change reason |

## Functional requirements

1. Administrator can create, edit and deactivate a clinic without a deployment.
2. A clinic cannot be physically deleted when historical records reference it.
3. Doctors and procedures support multiple clinics and external-system IDs.
4. UI colors and labels are configuration values, not business identifiers.
5. Every case and operational event belongs to one tenant; clinic may initially be unassigned during triage.
6. Configuration changes are versioned and audited.
7. Provider accounts expose capabilities; screens enable only supported actions.
8. A clinic can inherit tenant defaults and override approved settings.

## Configuration points

- locales, timezone, business hours and holidays;
- clinic color/label and sender identities;
- enabled channels and provider accounts;
- workflows by case type;
- SLA calendars;
- doctor/procedure synchronization source;
- retention and consent policies.

## RBAC and audit

- tenant administrator: all configuration;
- clinic administrator: own-clinic catalog and approved settings;
- operator: read effective operational configuration;
- every activation, deactivation and configuration change records before/after, actor and effective time.

## Acceptance criteria

1. A fourth clinic can be added and displayed without changing TypeScript unions or React components.
2. Deactivating a clinic blocks new cases but preserves existing history.
3. A clinic-specific provider overrides the tenant default and the source is visible.
4. Catalog changes appear in filters and case forms without rebuilding the frontend.

## Open decisions

- whether PaNa brands are one tenant with several clinics or separate tenants sharing selected resources;
- who may edit doctor/procedure catalogs when Medical CRM is authoritative;
- whether branding is clinic-specific or tenant-only.

