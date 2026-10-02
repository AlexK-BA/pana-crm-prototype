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
11. Every call command enforces `call:handle` at the action boundary, not only by hiding UI controls.
12. `Call.authorId` and related audit events store the canonical immutable `usr-*` user ID; display name and extension are resolved from the user directory.
13. Retry outcomes keep the same task active and require a new future due date; a terminal disposition closes the related task.

## Provider-neutral call model

Keep direction, lifecycle status, timestamps, duration, disposition and recording state canonical. Extension, trunk, PBX event type and raw payload live in provider metadata/integration log.

## Current prototype behavior

- The incoming-call simulator resolves the live Case, Patient and primary Contact Identity rather than rendering a fixed caller placeholder.
- Starting or answering a call opens the related case workspace immediately. An unknown identity remains visibly unresolved for operator triage.
- The shared offer, individual rejection and winning claim use canonical `usr-*` identifiers. Human names are resolved only for display.
- Only active users with an eligible operational role and matching clinic scope are included in the shared offer.
- Users outside that offer do not receive the call card and cannot claim or reject the call.
- A second call cannot be started while another call is ringing, active or awaiting mandatory wrap-up.
- Retry dispositions are validated again at the call action boundary. A missing, invalid or past retry time creates neither a Call nor a duplicate audit event.
- A successfully finalized call is linked back to the exact Task through `Task.callId`; the same actor closes or reschedules the task, and the attempt counter increases.
- Fully missed incoming calls create or reactivate one P1 callback task. The demonstration remains client-local; production atomic claim and idempotency require a backend/Redis transaction and final CDR reconciliation.

## Acceptance criteria

1. Replacing Yeastar does not require changes to case/task UI.
2. Realtime and final events create one call record.
3. Two agents cannot claim the same incoming call.
4. Missed calls produce visible callback work.
5. Provider failure is visible and does not fabricate a successful call.
6. A call result and its task mutation share one call identifier and one canonical actor.
7. Invalid retry input cannot create a partial call-history record.

## Technical dependencies

- chosen provider webhook/realtime/call-control capabilities;
- multi-tenant number-to-clinic routing;
- recording storage, retention and access;
- migration from current Yeastar CDR identifiers.
