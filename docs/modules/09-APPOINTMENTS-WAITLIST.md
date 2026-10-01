# Module specification: Appointments and waitlist

## Goal and problem

Let operators book and manage appointments from CRM using clinic-specific doctors/procedures and preserve work when a slot is unavailable, cancelled, rescheduled or missed.

## Core entities

- Appointment;
- Availability Slot;
- Waitlist Entry;
- Appointment Event (booked, confirmed, rescheduled, cancelled, no-show, completed);
- Confirmation Policy.

## Functional requirements

1. Availability search filters by clinic, procedure, doctor and date.
2. Slot booking is confirmed by the authoritative scheduling/medical system.
3. Successful booking updates the case and task according to workflow rules.
4. Confirmation messages are created as communication events, not hidden side effects.
5. Reschedule preserves the original appointment event and reason.
6. Cancellation/no-show can return the case to a configured follow-up stage and create a task.
7. Waitlist entry stores desired clinic/procedure/doctor/date window, urgency, contact preference and status.
8. New availability can generate prioritized contact tasks; it must not reserve/send automatically unless policy allows.
9. One slot cannot be double-booked through concurrent CRM actions.

## Configuration

- booking provider per clinic;
- procedure durations and doctor eligibility;
- confirmation/reminder schedule and channel;
- cancellation/no-show rules;
- waitlist ranking and expiry;
- self-service versus operator confirmation.

## Acceptance criteria

1. Booking is not shown as confirmed until the scheduling source accepts it.
2. Concurrent attempts cannot confirm the same slot twice.
3. Reschedule/cancel/no-show remain visible in history and reports.
4. Waitlisted patients remain actionable and ranked by policy.
5. Provider replacement does not change case/task UI contracts.

