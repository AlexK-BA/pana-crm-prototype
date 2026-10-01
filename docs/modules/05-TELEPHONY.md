# Module specification: Telephony

## Goal and problem

Provide reliable call handling inside CRM without tying product workflows to Yeastar. Operators must receive/open the relevant patient context, initiate calls from CRM and finish every call-required action with a disposition or reschedule.

## Architecture

UI and workflow call `Telephony Service`; Yeastar, SuperVoIP or another PBX implements a `TelephonyProvider` adapter.

Canonical operations:

```text
start_outgoing_call
receive_realtime_event
claim_incoming_call
receive_final_cdr
fetch_recording
map_provider_status
health_check
```

## Functional requirements

1. Incoming call normalizes caller number and searches contact identities.
2. Unique match opens patient/case; ambiguity shows candidates; unknown caller opens a temporary contact context.
3. One incoming call may ring several eligible agents until atomically claimed.
4. Dismissing the overlay by one agent does not remove it for others.
5. Fully missed incoming call creates/reactivates a prioritized callback task.
6. Outgoing click-to-call records actor, case, task, clinic and provider identifiers.
7. Realtime event and final CDR are correlated/idempotent; final CDR is authoritative for duration/result.
8. Call-required tasks enforce disposition.
9. `No answer` preserves work and requires next due time.
10. Recording access follows separate permission and retention policy.

## Provider-neutral call model

Keep direction, lifecycle status, timestamps, duration, disposition and recording state canonical. Extension, trunk, PBX event type and raw payload live in provider metadata/integration log.

## Acceptance criteria

1. Replacing Yeastar does not require changes to case/task UI.
2. Realtime and final events create one call record.
3. Two agents cannot claim the same incoming call.
4. Missed calls produce visible callback work.
5. Provider failure is visible and does not fabricate a successful call.

## Technical dependencies

- chosen provider webhook/realtime/call-control capabilities;
- multi-tenant number-to-clinic routing;
- recording storage, retention and access;
- migration from current Yeastar CDR identifiers.

