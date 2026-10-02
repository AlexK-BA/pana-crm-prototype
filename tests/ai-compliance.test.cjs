const test = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/crm-command-harness.cjs')

const runtime = harness()
const compliance = runtime.load('lib/crm/ai-compliance.ts')
const governance = runtime.load('lib/crm/ai-governance.ts')

function published() {
  const draft = structuredClone(compliance.INITIAL_AI_COMPLIANCE_CONFIGURATIONS[0])
  return { ...draft, status: 'published', approvalReference: 'DPO-2026-10', approvedBy: 'admin-01', publishedAt: '2026-10-03T00:00:00.000Z' }
}

test('draft validates but cannot be rendered as patient-facing policy', () => {
  const draft = structuredClone(compliance.INITIAL_AI_COMPLIANCE_CONFIGURATIONS[0])
  assert.doesNotThrow(() => compliance.validateAiComplianceConfiguration(draft, governance.INITIAL_AI_CONVERSATION_POLICIES))
  assert.throws(() => compliance.renderPatientTransparencyNotice(draft, governance.INITIAL_AI_CONVERSATION_POLICIES[0], 'pl'), /opublikowaną/)
})

test('published notice is deterministic and tied to an exact runtime policy version', () => {
  const config = published()
  const policy = governance.INITIAL_AI_CONVERSATION_POLICIES[0]
  compliance.validateAiComplianceConfiguration(config, [policy])
  const first = compliance.renderPatientTransparencyNotice(config, policy, 'pl')
  const second = compliance.renderPatientTransparencyNotice(config, policy, 'pl')
  assert.equal(first, second)
  assert.match(first, /Administrator danych/)
  assert.match(first, /polityka ai-policy-global-v1 v1/)
  assert.throws(() => compliance.renderPatientTransparencyNotice(config, { ...policy, version: 2 }, 'pl'), /aktywnej wersji/)
})

test('clinic publication overrides global and publication requires approval evidence', () => {
  const global = published()
  const clinic = { ...published(), id: 'clinic-v2', clinicId: 'pana-medica', version: 2 }
  assert.equal(compliance.resolvePublishedAiCompliance([global, clinic], 'pana-medica').id, 'clinic-v2')
  assert.equal(compliance.resolvePublishedAiCompliance([global, clinic], 'pana-comfort').id, global.id)
  assert.throws(() => compliance.validateAiComplianceConfiguration({ ...global, approvalReference: '' }, governance.INITIAL_AI_CONVERSATION_POLICIES), /referencji/)
})
