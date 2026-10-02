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
    channel: 'email', type: 'email', direction: 'outgoing', text: 'bot', authorId: 'bot-pana', senderKind: 'bot', threadKey }, access())
  h.render()
  assert.equal(h.store.interactions[0].senderKind, 'bot')

  h.store.setConversationMode({ threadKey, caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', mode: 'operator_active', reason: 'Operator takeover' }, access())
  h.render()
  h.store.sendMessage({ caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', type: 'email', direction: 'outgoing', text: 'human', authorId: 'usr-test', senderKind: 'user', threadKey }, access())
  assert.throws(() => h.store.sendMessage({ caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1',
    channel: 'email', type: 'email', direction: 'outgoing', text: 'bot', authorId: 'bot-pana', senderKind: 'bot', threadKey }, access()))
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
