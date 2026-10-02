# Messenger UI and channel workspace

Status: implemented prototype UI, merged after Task/Calendar/Workflow integration.

## Purpose

The contact-history tab is a patient-level communication workspace. The left column groups communication by channel rather than by individual message. One patient can have many Engagement Cases and multiple threads inside the same channel; the channel row is only a projection and does not replace Interaction, ContactIdentity or EngagementCase.

## Implemented behavior

- Channels are grouped as WhatsApp, Instagram, Facebook, Telegram, website chat, email, SMS, phone and other supported identities.
- Each channel shows the latest message, time, unread total and an aggregate reply state.
- Multiple threads within one channel remain separate and are selected with case/contact chips.
- Each thread has its own state. Channel state uses the most urgent thread state: new, awaiting reply, bot replied, answered.
- Search filters messages by content and highlights matching text with React-rendered mark elements.
- Filters cover all, unread, awaiting response and bot-participated conversations.
- The composer supports emoji and a demo attachment affordance.
- In an existing thread the channel selector is locked so channel and ContactIdentity cannot diverge.
- The compact patient details action is located in the Engagement Case drawer header and is available on every drawer tab.
- Phone uses the existing call workflow; SMS uses the existing emulated SMS Stage 1 flow.

## Data ownership

EntityStore remains the source of truth. Messages are existing Interaction records; calls remain Call records; threads and channel groups are derived projections. The messenger UI does not introduce another message store or alter Patient, Case, Task, SMS provider or workflow entities.

Unread state continues to use the existing thread read keys. Search/filter state, selected channel/thread, emoji picker and selected demo filenames are local UI state only.

## Explicit limitations

- Bot participation is detected from the current prototype author convention. There is no canonical conversation owner or bot/operator handoff state.
- Sending an operator message does not pause a bot and must not be presented as a production takeover.
- Attachments are demo-only: the filename is inserted into message text; no binary upload, storage, scanning or download exists.
- Search is client-side over the currently available scoped interactions.
- Real WhatsApp, Telegram, Instagram, Facebook and email providers are not connected.
- The prototype remains session-only and resets after reload.
- Browser UAT and mobile regression are required after merge.

## Future bot handoff contract

Production implementation must add an explicit conversation ownership state such as bot_active, operator_active, bot_paused and closed. Commands must include take over, return to bot and pause bot, with permission checks, timestamp, actor and Audit event. Provider/bot orchestration must honor that state to prevent simultaneous bot and operator replies.

## Required browser UAT

1. Open a patient with multiple cases and confirm channels are grouped once.
2. Switch between two threads in one channel and verify messages, identity and case remain correct.
3. Verify aggregate channel state follows the most urgent thread.
4. Send a regular message and confirm it stays in the selected thread.
5. Send an emulated SMS and verify patient/case/task linkage and delivery state.
6. Verify unread counts and mark-read behavior per thread.
7. Exercise all, unread, awaiting-response and bot filters.
8. Search mixed-case text and verify result counts, chronological preview selection and highlighted matches.
9. Confirm the channel selector is locked inside an existing thread.
10. Confirm bot wording says the bot participated and does not claim takeover.
11. Add/remove emoji and demo attachments; verify the demo warning remains visible.
12. Verify phone disables attachments and launches the existing call workflow.
13. Verify patient details are available from every Case Drawer tab.
14. Verify mobile list/detail/back navigation.
15. Regress Patient 360, Task actions, Calendar, mandatory call wrap-up and SMS retry.
