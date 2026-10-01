# Module specification: Lead intake and attribution

## Goal and problem

Create cases reliably from forms, e-mail, chat, calls and imports while preserving original marketing attribution for the patient lifetime and separate attribution for each new case.

## Intake sources

- website forms;
- configured mailboxes;
- website/social chat;
- incoming calls;
- API/webhook integrations;
- controlled import/migration, including existing Google Sheets bridge.

## Functional requirements

1. Every intake event receives a source event ID/idempotency key.
2. The system normalizes phone/e-mail and searches existing identities.
3. A new event creates a new case when it represents a new intent; it does not overwrite an older case.
4. Patient first-touch attribution is immutable after initial confirmation.
5. Every case stores its own creation-touch snapshot.
6. Store source, channel, campaign, UTM fields, GA/client ID, service/clinic intent and timestamp when supplied.
7. Missing clinic enters triage rather than defaulting silently to PaNa Medica.
8. Duplicate events are rejected or linked without creating duplicate work.
9. Failed intake is retried and visible in an integration/error queue.

## Configurable mapping

- endpoint/mailbox/form to tenant, clinic intent and source;
- external field mappings;
- normalization rules;
- case type/workflow assignment;
- automatic task and routing;
- deduplication window and policy.

## Acceptance criteria

1. Forms and e-mails can be enabled independently or together.
2. Replayed webhook/import row creates no duplicate case.
3. Returning patient keeps first-touch history and receives a separate new case touch.
4. Unknown clinic remains visibly unassigned.
5. Source mappings can be changed without component code.

## Needs decision

- final strategy for three PaNa mailboxes versus direct forms;
- exact meaning of a new intent/case for repeated submissions;
- International routing and campaign mappings.

