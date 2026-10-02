const test = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/crm-command-harness.cjs')

const ai = harness().load('lib/crm/ai-governance.ts')

test('clinic policy overrides global policy and explicit conversation override wins', () => {
  const globalPolicy = structuredClone(ai.INITIAL_AI_CONVERSATION_POLICIES[0])
  const clinicPolicy = { ...structuredClone(globalPolicy), id: 'clinic', clinicId: 'pana-medica', enabled: false }
  assert.equal(ai.resolveAiConversationPolicy([globalPolicy, clinicPolicy], 'pana-medica', 'instagram').id, 'clinic')
  assert.equal(ai.isAiEnabledForConversation(undefined, clinicPolicy), false)
  assert.equal(ai.isAiEnabledForConversation({ aiEnabledOverride: true }, clinicPolicy), true)
})

test('activation schedule derives deadline from versioned policy', () => {
  const policy = { ...structuredClone(ai.INITIAL_AI_CONVERSATION_POLICIES[0]), activationDelaySeconds: 90 }
  const schedule = ai.makeBotActivationSchedule({ id: 's1', threadKey: 't1', caseId: 'c1', triggerInteractionId: 'i1', policy, scheduledAt: '2026-10-02T10:00:00.000Z' })
  assert.equal(schedule.dueAt, '2026-10-02T10:01:30.000Z')
  assert.equal(ai.activationRemainingMs(schedule, Date.parse('2026-10-02T10:00:30.000Z')), 60_000)
})

test('medical, emergency, source and confidence rules force human handoff', () => {
  const policy = ai.INITIAL_AI_CONVERSATION_POLICIES[0]
  assert.equal(ai.requiresHumanHandoff(policy, { medicalAdviceRequested: true }), 'medical_advice_request')
  assert.equal(ai.requiresHumanHandoff(policy, { emergencyLanguageDetected: true }), 'emergency_language')
  assert.equal(ai.requiresHumanHandoff(policy, { hasKnowledgeSource: false }), 'no_knowledge_source')
  assert.equal(ai.requiresHumanHandoff(policy, { confidence: 0.2 }), 'low_confidence')
})
