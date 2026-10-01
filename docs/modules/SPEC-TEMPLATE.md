# Module specification: Name

## Goal and problem

Who is affected, what currently fails, why the module exists and what measurable result is expected.

## Scope

- included capability;
- included capability.

Out of scope: explicitly excluded behavior.

## Roles and actors

| Actor | Need/responsibility |
|---|---|
| Role | Action and data scope |

## Core entities and states

Define stable entities, relationships, ownership and lifecycle. Do not use screen elements as domain entities.

## Functional requirements

1. Actor + condition + system behavior + observable result.
2. Include main flow, alternative flow, failure and missing-data behavior.

## Configurable policy

Specify tenant/clinic inheritance, versioning, effective dates and safe defaults. Explain what remains canonical and must not be configured.

## Integrations and events

Define internal service contract, provider adapter, commands/events, idempotency, retry, health and reconciliation.

## RBAC, audit and data scope

List atomic permissions, tenant/clinic/team scope and mandatory audit events.

## Non-functional requirements

Security, performance, availability, latency, retention, privacy, observability and migration.

## Acceptance criteria

1. Observable and independently testable criterion.
2. No new scope introduced only here.

## Dependencies and migration

State prerequisites, existing-data treatment, backward compatibility and rollout order.

## Confirmed / derived / open

Separate confirmed requirements, derived recommendations, needs decisions and technical dependencies.
