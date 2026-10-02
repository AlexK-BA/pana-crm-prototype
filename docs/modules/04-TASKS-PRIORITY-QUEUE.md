# Module specification: Tasks and priority queue

## Goal and problem

Give operators an unambiguous next action and prevent due/overdue work from getting lost inside case cards. Cases appear on boards; tasks are separate work entities that influence ordering and also appear in schedule/calendar views.

## Functional requirements

1. A case may have zero, one or several tasks.
2. Each task has type, status, owner/team, priority, due time, SLA, attempts and outcome.
3. Queue ranking uses task urgency, due state, configured business priority and assignment eligibility.
4. Overdue tasks remain visible until completed, cancelled or explicitly superseded.
5. The highest-ranked actionable task determines case ordering within a board column.
6. Calendar displays individual tasks and opens the related case/patient.
7. Completing an action requires an outcome when configured.
8. A call-required task cannot be skipped/completed without a call disposition.
9. `No answer` keeps the task open and requires a new due date/time.
10. System-generated tasks are idempotent by workflow rule/event key.

## Configurable priority policy

Recommended canonical score inputs:

- P0–P4 business priority;
- overdue duration;
- SLA breach proximity;
- task type weight;
- case stage weight;
- unassigned/shared queue eligibility;
- number of unsuccessful attempts;
- manual escalation.

Exact weights belong to versioned queue policy, not UI code.

## Acceptance criteria

1. An overdue task remains visible on start page, task list and calendar.
2. A case with a more urgent task ranks above cases in the same stage.
3. Completing one task does not close unrelated tasks.
4. Failed call requires disposition and rescheduling according to policy.
5. Reprocessing the same workflow event does not create duplicate tasks.

## Needs decision

- task-type weights and SLA values;
- whether manual card priority exists separately from task priority;
- ownership rules for shared queues and reassignments.


## Implemented shared operational ranking

[TASK-CALENDAR-WORKFLOW-SPEC.md](../TASK-CALENDAR-WORKFLOW-SPEC.md) defines overdue mandatory → other overdue → P0 → P1 → due time → undated/priority/age. The same selector drives next Case work, queue and Patient 360. Task metadata/lifecycle, canonical Calendar projections, reasoned reschedule/replacement and analytics-ready audit are implemented without an additional store. Working-hour SLA, clinic timezone and real Appointment association remain backend/configuration dependencies.
