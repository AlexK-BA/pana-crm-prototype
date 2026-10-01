# Module specification: Omnichannel communications

## Goal and problem

Provide one patient-level communication workspace while preserving separate conversations by channel and case. Operators should not lose context when one patient contacts the clinic through several channels.

## Channels

Current/target: website chat, SMS, WhatsApp, Telegram, Instagram, Facebook and e-mail. TikTok is potential and must remain disabled until a supported integration is confirmed.

## Core entities

- Communication Account (tenant/clinic/provider credentials and capabilities);
- Conversation (patient/contact, channel identity, case, state, assignment);
- Message (direction, content, delivery state, provider ID);
- Attachment;
- Routing Rule.

## Functional requirements

1. Patient profile lists every conversation separately in the left column.
2. Selecting a conversation changes the thread without changing the patient.
3. Messages preserve channel, account, case, author, direction and status.
4. Reply uses the same conversation/account unless the user explicitly chooses another channel.
5. Unknown sender creates an unlinked conversation and triage task, not an automatic patient.
6. Unread state, assignment and handoff are shared between Inbox and patient profile.
7. Delivery/provider errors remain visible and retry does not overwrite history.
8. Communication channels use adapters and capability checks.
9. Comments/notes are not external messages and cannot accidentally be sent.

## Configuration

- enabled accounts by clinic;
- working hours and auto-replies;
- routing/team assignment;
- bot participation and escalation threshold;
- retention and attachment limits;
- allowed outbound channels/roles.

## Acceptance criteria

1. One patient can have several independent conversations visible together.
2. A reply is attached to the selected case and conversation.
3. Unsupported channels/actions are disabled with explanation.
4. An incoming unknown contact never links to an arbitrary patient.
5. Provider change preserves historical messages.

