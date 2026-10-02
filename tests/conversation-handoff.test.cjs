const test = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/crm-command-harness.cjs')

const makeCase = () => ({
  id: 'c1', patientId: 'p1', contactIdentityId: 'email1', contactIdentityIds: ['email1'],
  clinicId: 'pana-medica', board: 'leads', status: 'new', responsibleTeamId: 'team-1',
  createdAt: new Date().toISOString(), attribution: { firstTouch: {}, caseCreationTouch: {} },
})

function access(actorId = 'usr-test', role = 'admin') {
  const h = harness()
  const permissions = h.load('lib/crm/permissions.ts').ROLE_PERMISSIONS[role]
  return { actorId, actorRole: role, active: true, globalScope: role === 'admin' || role === 'team_leader',
    clinicIds: ['pana-medica'], hasPermission: permission => permissions.includes(permission) }
}

const aiTrace = () => ({
  runId: 'run-1', modelProvider: 'test', modelName: 'kb-bot', policyId: 'ai-policy-global-v1', policyVersion: 1,
  promptTemplateId: 'administrative-chat', promptTemplateVersion: 1, generatedAt: new Date().toISOString(),
  inputInteractionIds: ['incoming-1'], citations: [{ sourceId: 'kb-1', sourceTitle: 'FAQ', sourceVersion: '1', retrievedAt: new Date().toISOString() }],
  userDisclosureShown: true,
})

test('bot/operator ownership is canonical, audited and enforced when sending', () => {
  const h = harness({ cases: [makeCase()] })
  const threadKey = 'c1/email1/email'
  h.store.setConversationMode({ threadKey, caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', mode: 'bot_active', botId: 'bot-pana', reason: 'Automation enabled' }, access())
  h.render()
  assert.equal(h.store.conversationControls[0].mode, 'bot_active')
  assert.equal(h.store.auditEvents.at(-1).type, 'conversation_handoff')
  assert.throws(() => h.store.sendMessage({ caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', type: 'email', direction: 'outgoing', text: 'human', authorId: 'usr-test', senderKind: 'user', threadKey }, access()))
  h.store.sendMessage({ caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', type: 'email', direction: 'outgoing', text: 'bot', authorId: 'bot-pana', senderKind: 'bot', threadKey, aiTrace: aiTrace() }, access())
  h.render()
  assert.equal(h.store.interactions[0].senderKind, 'bot')

  h.store.setConversationMode({ threadKey, caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', mode: 'operator_active', reason: 'Operator takeover' }, access())
  h.render()
  h.store.sendMessage({ caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', type: 'email', direction: 'outgoing', text: 'human', authorId: 'usr-test', senderKind: 'user', threadKey }, access())
  assert.throws(() => h.store.sendMessage({ caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', type: 'email', direction: 'outgoing', text: 'bot', authorId: 'bot-pana', senderKind: 'bot', threadKey, aiTrace: aiTrace() }, access()))
})

test('bot answers require disclosure and immutable source evidence', () => {
  const h = harness({ cases: [makeCase()] })
  const threadKey = 'c1/email1/email'
  h.store.setConversationMode({ threadKey, caseId: 'c1', contactIdentityId: 'email1', channel: 'email', mode: 'bot_active', reason: 'test' }, access())
  h.render()
  const input = { caseId: 'c1', contactIdentityId: 'email1', channel: 'email', type: 'email', direction: 'outgoing', text: 'bot', authorId: 'bot-pana', senderKind: 'bot', threadKey }
  assert.throws(() => h.store.sendMessage(input, access()), /AI trace/)
  assert.throws(() => h.store.sendMessage({ ...input, aiTrace: { ...aiTrace(), citations: [], noSourceReason: undefined } }, access()), /źródła/)
  assert.throws(() => h.store.sendMessage({ ...input, aiTrace: { ...aiTrace(), userDisclosureShown: false } }, access()), /oznaczenia/)
  h.store.sendMessage({ ...input, aiTrace: aiTrace() }, access())
  h.render()
  assert.equal(h.store.interactions[0].aiTrace.citations[0].sourceVersion, '1')
  assert.equal(h.store.auditEvents.at(-1).type, 'ai_response_recorded')
})

test('incoming message creates one auditable activation timer and operator reply cancels it', () => {
  const h = harness({ cases: [makeCase()] })
  const threadKey = 'c1/email1/email'
  h.store.sendMessage({ caseId: 'c1', contactIdentityId: 'phone1', channel: 'phone', type: 'chat', direction: 'incoming', text: 'hello', senderKind: 'patient', threadKey: 'c1/phone1/phone' }, access())
  h.render()
  assert.equal(h.store.botActivationSchedules.length, 0, 'default policy deliberately excludes phone')
  h.store.sendMessage({ caseId: 'c1', channel: 'instagram', type: 'social', direction: 'incoming', text: 'hello', senderKind: 'patient', threadKey: 'c1/social/instagram' }, access())
  h.render()
  assert.equal(h.store.botActivationSchedules[0].status, 'pending')
  const control = h.store.setConversationMode({ threadKey: 'c1/social/instagram', caseId: 'c1', channel: 'instagram', mode: 'operator_active', reason: 'human takeover' }, access())
  assert.equal(control.mode, 'operator_active')
  h.render()
  assert.equal(h.store.botActivationSchedules[0].status, 'cancelled')
  assert.ok(h.store.auditEvents.some(event => event.type === 'ai_activation_cancelled'))
})

test('another operator cannot steal an owned conversation; supervisor can override with audit', () => {
  const h = harness({ cases: [makeCase()] })
  const threadKey = 'c1/email1/email'
  h.store.setConversationMode({ threadKey, caseId: 'c1', contactIdentityId: 'email1', channel: 'email',
    mode: 'operator_active', reason: 'First owner' }, access('operator-a'))
  h.render()
  assert.throws(() => h.store.setConversationMode({ threadKey, caseId: 'c1', contactIdentityId: 'email1',
    channel: 'email', mode: 'operator_active', reason: 'Steal' }, access('operator-b', 'operator')))
  h.store.setConversationMode({ threadKey, caseId: 'c1', contactIdentityId: 'email1', channel: 'email',
    mode: 'operator_active', reason: 'Supervisor override' }, access('supervisor', 'team_leader'))
  h.render()
  assert.equal(h.store.conversationControls[0].ownerId, 'supervisor')
  assert.equal(h.store.auditEvents.at(-1).reason, 'Supervisor override')
})

test('central conversation selectors classify legacy bot data without UI heuristics', () => {
  const h = harness()
  const selectors = h.load('lib/crm/conversation-control.ts')
  assert.equal(selectors.interactionSenderKind({ direction: 'outgoing', authorId: 'bot-pana' }), 'bot')
  assert.equal(selectors.conversationReplyState(0, { direction: 'outgoing', senderKind: 'bot' }), 'bot')
  assert.equal(selectors.worstConversationReplyState(['answered', 'awaiting']), 'awaiting')
})
