# Module specification: Cases and configurable workflows

## Goal and problem

Represent each independent patient intent as an Engagement Case while allowing different clinics and case types to use different funnels. A patient is not a card: the case moves through a workflow; the patient persists across cases.

## Core entities

- Engagement Case;
- Workflow Definition and Version;
- Stage;
- Transition Rule;
- Closure Reason;
- Workflow Assignment by tenant/clinic/case type.

## Functional requirements

1. A patient may have several simultaneous or historical cases.
2. Every case has one active workflow version and stage.
3. Admin may manually move a case to any permitted stage; override requires a reason when bypassing rules.
4. Every transition records before/after, actor, timestamp, reason and generated actions.
5. Workflow version changes do not reinterpret historical transitions.
6. Stage entry may create tasks, set SLA, require data, send notifications or change ownership.
7. Closure requires a configured closure reason and completion/cancellation treatment for remaining tasks.
8. Duplicate cases can be linked/consolidated without losing history.
9. Board cards expose patient, clinic, service, owner, last action, next action and due/priority state.

## Configurable rules

- stages and ordering;
- allowed transitions by permission;
- required fields and closure reasons;
- automatic tasks and SLA;
- assignment strategy;
- re-entry/resurrection behavior;
- visual labels and colors;
- terminal and inactive stages.

## Acceptance criteria

1. A new workflow and stages can be configured without editing React components.
2. Moving a card executes one versioned transition and no duplicate automatic task.
3. Admin override is possible and fully audited.
4. Existing cases retain their workflow version after a new version is published.
5. A closed case does not disappear from patient history or reporting.

## Needs decision

- Daniel/Pasha confirmation of all three workflows, stages and automation rules;
- whether existing cases migrate to a new workflow version or finish on the previous one;
- conflict behavior when an external medical event suggests another stage.

