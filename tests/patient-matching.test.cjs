// Executes real matching modules and EntityStore commands with an isolated hook host.
// Synthetic Medical CRM fixtures; this is not browser or backend/IdP validation.
const test = require('node:test')
const assert = require('node:assert/strict')

const { harness, patients, identities } = require('./helpers/crm-command-harness.cjs')
const access = (role = 'admin', clinicIds = ['pana-medica'], globalScope = role === 'admin' || role === 'team_leader') => ({ actorId: 'usr-canonical', active: true, globalScope, clinicIds,
  hasPermission: permission => harnessPermissions[role].includes(permission) })
const modules = harness()
const harnessPermissions = modules.load('lib/crm/permissions.ts').ROLE_PERMISSIONS
const engine = modules.load('lib/crm/patient-matching-service.ts')
const assess = (input, ps = patients, ids = identities, ownership) => engine.assessPatientMatch(input, ps, ids, ownership)
const plain = value => JSON.parse(JSON.stringify(value))
function snapshot(h) { return JSON.stringify({ cases: h.store.cases, patients: h.store.patients, identities: h.store.identities, tasks: h.store.tasks, interactions: h.store.interactions, decisions: h.store.matchDecisions, audit: h.store.auditEvents }) }
function rejectWithoutMutation(h, command) { const before = snapshot(h); assert.throws(command, error => error.name === 'AccessCommandError'); h.render(); assert.equal(snapshot(h), before) }
function draft(h, input = {}, role = 'admin') { const created = h.store.createDraftCase({ channel: 'phone', text: 'Synthetic test', clinicId: 'pana-medica', ...input }, access(role)); h.render(); return created.caseId }

test('normalization accepts equivalent PL contacts and rejects malformed identifiers', () => {
  for (const value of ['611924357', '+48 (611) 924-357', '48611924357', '0048 611 924 357']) assert.equal(engine.normalizeMatchingPhone(value), '+48611924357')
  for (const value of ['', '123', '+48 000 000 000', 'abc', '+48 1234567890']) assert.equal(engine.normalizeMatchingPhone(value), undefined)
  assert.equal(engine.normalizeMatchingEmail(' TEST.ONE@EXAMPLE.TEST '), 'test.one@example.test')
  assert.equal(engine.normalizeMatchingEmail('broken@'), undefined)
  assert.equal(engine.normalizeMatchingPesel('111 111 111 11'), '11111111111')
  assert.equal(engine.normalizeMatchingPesel('123'), undefined)
})

test('unique external ID, PESEL, verified phone/email auto-link at configured base confidence', () => {
  for (const [input, confidence] of [[{ externalPatientId: ' EXT-1 ' }, 1], [{ pesel: '11111111111' }, .98], [{ phone: '611924357' }, .95], [{ email: ' TEST.ONE@EXAMPLE.TEST ' }, .95]]) {
    const result = assess(input); assert.equal(result.decision, 'auto_link'); assert.equal(result.candidates[0].confidence, confidence); assert.equal(result.candidates[0].candidatePatientId, 'p1')
  }
  assert.ok(assess({ phone: '611924357', email: 'test.one@example.test', firstName: 'Test', lastName: 'One', clinicId: 'pana-medica' }).candidates[0].confidence > .95)
})

test('name-only/unverified contact cannot auto-link; empty and invalid input stay unlinked', () => {
  assert.equal(assess({ firstName: 'Test', lastName: 'One' }).decision, 'suggested_match')
  assert.equal(assess({ phone: '611924357' }, patients, identities.map(item => ({ ...item, verified: false }))).decision, 'suggested_match')
  for (const input of [{}, { phone: 'bad' }, { email: 'bad' }, { pesel: '123' }]) assert.equal(assess(input).decision, 'no_match')
})

test('shared phone/email and duplicate external ID/PESEL never select the first patient', () => {
  for (const channel of ['phone', 'email']) {
    const contact = identities.find(item => item.channel === channel)
    const result = assess({ [channel]: contact.value }, patients, [...identities, { ...contact, id: 'shared', patientId: 'p2' }])
    assert.equal(result.decision, 'ambiguous'); assert.equal(result.candidates.length, 2)
  }
  for (const key of ['externalPatientId', 'pesel']) {
    const result = assess({ [key]: patients[0][key] }, [patients[0], { ...patients[1], [key]: patients[0][key] }])
    assert.notEqual(result.decision, 'auto_link')
  }
})

test('contradictory hard IDs, case ownership and identity ownership block automatic linking', () => {
  assert.equal(assess({ externalPatientId: 'EXT-1', pesel: '22222222222' }).decision, 'conflict')
  assert.equal(assess({ externalPatientId: 'EXT-1' }, patients, identities, { casePatientId: 'p2' }).decision, 'conflict')
  assert.equal(assess({ phone: '611924357' }, patients, identities, { identityPatientIds: ['p2'] }).decision, 'conflict')
})

test('draft auto-link reuses identity and adds one canonical case/profile/history without Patient mutation', () => {
  const h = harness(); const beforePatients = JSON.stringify(h.store.patients); const beforeIds = JSON.stringify(h.store.identities)
  const caseId = draft(h, { phone: '611924357', firstName: 'Different', lastName: 'Local' })
  assert.equal(h.store.cases.find(item => item.id === caseId).patientId, 'p1')
  assert.equal(h.store.cases.find(item => item.id === caseId).contactIdentityId, 'phone1')
  assert.equal(JSON.stringify(h.store.patients), beforePatients); assert.equal(JSON.stringify(h.store.identities), beforeIds)
  assert.equal(h.store.tasks[0].caseId, caseId); assert.equal(h.store.tasks[0].patientId, 'p1'); assert.equal(h.store.tasks[0].status, 'ready')
  assert.equal(h.store.interactions[0].patientId, 'p1')
  assert.ok(h.store.auditEvents.some(event => event.type === 'contact_identity_reused' && event.actorId === 'system'))
  assert.ok(h.store.auditEvents.some(event => event.type === 'patient_auto_linked' && event.actorId === 'system'))
})

test('direct commands without permission/context are rejected with no state or audit mutation', () => {
  const h = harness(); const id = draft(h, { firstName: 'Test', lastName: 'One' }); const decision = h.store.matchDecisions.at(-1)
  for (const command of [
    () => h.store.createDraftCase({ channel: 'phone', text: 'blocked' }),
    () => h.store.matchCaseToPatient(id, 'spoofed'),
    () => h.store.approvePatientMatch(decision.id, 'p1', 'Verified', access('operator')),
    () => h.store.rejectPatientMatch(decision.id, 'Rejected', access('operator')),
    () => h.store.saveCaseContactProfile({ caseId: id, firstName: 'A', lastName: 'B', actorId: 'spoofed' }),
    () => h.store.sendMessage({ caseId: id, direction: 'incoming', type: 'chat', text: 'blocked' }),
  ]) rejectWithoutMutation(h, command)
})

test('manual approval preserves attribution/tasks/other cases and canonical actor, without medical edits', () => {
  const existingCase = { id: 'existing', patientId: 'p1', contactIdentityId: 'phone1', clinicId: 'pana-medica', board: 'leads', status: 'waiting' }
  const h = harness({ cases: [existingCase] }); const id = draft(h, { firstName: 'Test', lastName: 'One' }); const before = plain(h.store.cases.find(item => item.id === id)); const tasks = plain(h.store.tasks); const ps = plain(h.store.patients)
  const decision = h.store.matchDecisions.at(-1)
  h.store.approvePatientMatch(decision.id, 'p1', 'Checked by supervisor', access('team_leader')); h.render()
  assert.deepEqual(plain(h.store.patients), ps); assert.deepEqual(plain(h.store.cases[0]), existingCase)
  assert.deepEqual(plain(h.store.cases.find(item => item.id === id).attribution), before.attribution)
  assert.deepEqual(plain(h.store.tasks.map(item => ({ ...item, patientId: undefined }))), tasks.map(item => { delete item.patientId; return item }))
  assert.equal(h.store.cases.filter(item => item.patientId === 'p1').length, 2)
  assert.equal(h.store.interactions.find(item => item.caseId === id).patientId, 'p1')
  assert.ok(h.store.auditEvents.some(event => event.type === 'patient_match_approved' && event.actorId === 'usr-canonical'))
})

test('clinic manager cannot approve/reject out-of-scope patients; global approver may review', () => {
  const h = harness(); const id = draft(h, { firstName: 'Test', lastName: 'Two' }); const decision = h.store.matchDecisions.at(-1)
  rejectWithoutMutation(h, () => h.store.approvePatientMatch(decision.id, 'p2', 'reason', access('clinic_manager')))
  rejectWithoutMutation(h, () => h.store.rejectPatientMatch(decision.id, 'reason', access('clinic_manager')))
  h.store.approvePatientMatch(decision.id, 'p2', 'Global review', access()); h.render(); assert.equal(h.store.cases.find(item => item.id === id).patientId, 'p2')
})

test('reject preserves candidate/history, rerun creates a new decision and expires only unresolved searches', () => {
  const h = harness(); const id = draft(h, { firstName: 'Test', lastName: 'One' }); const first = h.store.matchDecisions.at(-1)
  h.store.rejectPatientMatch(first.id, 'Not enough evidence', access()); h.render(); assert.equal(h.store.cases.find(item => item.id === id).patientId, undefined)
  h.store.matchCaseToPatient(id, 'spoofed', access()); h.render(); const second = h.store.matchDecisions.at(-1)
  assert.equal(h.store.matchDecisions[0].status, 'rejected'); assert.equal(h.store.matchDecisions[0].candidates[0].candidatePatientId, 'p1')
  h.store.matchCaseToPatient(id, 'spoofed', access()); h.render(); assert.equal(h.store.matchDecisions.find(item => item.id === second.id).status, 'expired')
  rejectWithoutMutation(h, () => h.store.approvePatientMatch(second.id, 'p1', 'Stale', access()))
})

test('local profile edit reruns current matching without creating/overwriting Patient', () => {
  const h = harness(); const id = draft(h, { firstName: 'Unknown', lastName: 'Contact' }); const before = JSON.stringify(h.store.patients)
  h.store.saveCaseContactProfile({ caseId: id, firstName: 'Local', lastName: 'Name', externalPatientId: 'EXT-1', actorId: 'spoofed' }, access()); h.render()
  assert.equal(h.store.cases.find(item => item.id === id).patientId, 'p1'); assert.equal(JSON.stringify(h.store.patients), before)
  rejectWithoutMutation(h, () => h.store.saveCaseContactProfile({ caseId: id, firstName: 'Local', lastName: 'Name', email: 'invalid', actorId: 'spoofed' }, access()))
})

test('approval cannot transfer a bound case/contact, including conflict requiring a new workflow', () => {
  const h = harness({ cases: [{ id: 'bound', patientId: 'p2', contactIdentityId: 'phone2', contactProfile: { externalPatientId: 'EXT-1' }, clinicId: 'pana-medica', board: 'leads', status: 'new' }] })
  h.store.matchCaseToPatient('bound', 'spoofed', access()); h.render(); const decision = h.store.matchDecisions.at(-1); assert.equal(decision.decision, 'conflict')
  rejectWithoutMutation(h, () => h.store.approvePatientMatch(decision.id, 'p1', 'Try transfer', access()))
})

test('incoming message uses canonical known identity and performs system matching before recording', () => {
  const h = harness({ cases: [{ id: 'incoming', contactIdentityId: 'phone1', clinicId: 'pana-medica', board: 'leads', status: 'new' }] })
  h.store.sendMessage({ caseId: 'incoming', direction: 'incoming', type: 'chat', text: 'Synthetic reply' }, access('operator')); h.render()
  assert.equal(h.store.interactions[0].patientId, 'p1'); assert.equal(h.store.cases[0].patientId, 'p1')
  assert.equal(h.store.matchDecisions.at(-1).status, 'auto_linked')
})

test('incoming routing never selects ambiguous Patient or silently creates/selects a case', () => {
  const empty = engine.routeIncomingPatientContact({ phone: '611924357' }, patients, identities, [])
  assert.equal(empty.patientId, 'p1'); assert.equal(empty.requiresCaseSelection, true); assert.equal(empty.caseIds.length, 0)
  const cases = ['one', 'two'].map(id => ({ id, patientId: 'p1', status: 'new', clinicId: 'pana-medica' }))
  const many = engine.routeIncomingPatientContact({ phone: '611924357' }, patients, identities, cases)
  assert.equal(many.caseIds.length, 2); assert.equal(many.requiresCaseSelection, true)
  const ambiguous = engine.routeIncomingPatientContact({ phone: '611924357' }, patients, [...identities, { ...identities[0], id: 'shared', patientId: 'p2' }], cases)
  assert.equal(ambiguous.patientId, undefined); assert.equal(ambiguous.caseIds.length, 0)
  const one = engine.routeIncomingPatientContact({ phone: '611924357' }, patients, identities, [{ ...cases[0], status: 'completed' }, cases[1]])
  assert.equal(one.caseIds[0], 'two'); assert.equal(one.requiresCaseSelection, false)
})

test('audit summaries and reason fields redact direct identifiers and keep structured decision correlation', () => {
  const h = harness(); draft(h, { firstName: 'Test', lastName: 'One' }); const decision = h.store.matchDecisions.at(-1)
  h.store.approvePatientMatch(decision.id, 'p1', 'Checked +48 (611) 924-357, 11111111111 and test.one@example.test', access()); h.render()
  const audit = JSON.stringify(h.store.auditEvents)
  for (const sensitive of ['611924357', '611) 924-357', '11111111111', 'test.one@example.test']) assert.equal(audit.includes(sensitive), false)
  assert.ok(h.store.auditEvents.some(item => item.matchDecisionId === decision.id && item.correlationId === decision.id))
})

test('ScopedEntityStore hides candidates from Operator/Marketing and out-of-clinic reviewer', () => {
  const h = harness(); draft(h, { firstName: 'Test', lastName: 'Two' })
  const operator = h.scoped('operator'); assert.equal(operator.matchDecisions[0].candidates.length, 0); assert.equal(operator.patients.some(item => item.id === 'p2'), false)
  const marketing = h.scoped('marketing'); assert.equal(marketing.matchDecisions.length, 0); assert.equal(marketing.patients.length, 0)
  const manager = h.scoped('clinic_manager'); assert.equal(manager.matchDecisions[0].candidates.length, 0); assert.equal(manager.patients.some(item => item.id === 'p2'), false)
  const leader = h.scoped('team_leader'); assert.equal(leader.matchDecisions[0].candidates[0].candidatePatientId, 'p2')
})


test('known verified chat identity links and reuses contact without a draft duplicate', () => {
  const h = harness({ identities: [...structuredClone(identities), { id: 'chat1', patientId: 'p1', channel: 'website', value: 'verified-session-1', verified: true, isPrimary: false }] })
  const before = h.store.identities.length
  const id = draft(h, { channel: 'website', value: 'verified-session-1' })
  assert.equal(h.store.cases.find(item => item.id === id).patientId, 'p1')
  assert.equal(h.store.cases.find(item => item.id === id).contactIdentityId, 'chat1')
  assert.equal(h.store.identities.length, before)
})

test('retained scoped approval command checks the newly selected role before mutation', () => {
  const h = harness(); draft(h, { firstName: 'Test', lastName: 'One' }); const decision = h.store.matchDecisions.at(-1)
  const oldAdmin = h.scoped('admin'); h.scoped('operator')
  rejectWithoutMutation(h, () => oldAdmin.approvePatientMatch(decision.id, 'p1', 'Cannot retain admin access'))
})

test('missing targets, inactive capability and invalid reasons reject without mutations', () => {
  const h = harness(); const id = draft(h, { firstName: 'Test', lastName: 'One' }); const decision = h.store.matchDecisions.at(-1)
  for (const command of [
    () => h.store.matchCaseToPatient('missing', 'spoofed', access()),
    () => h.store.approvePatientMatch('missing', 'p1', 'reason', access()),
    () => h.store.approvePatientMatch(decision.id, 'missing', 'reason', access()),
    () => h.store.approvePatientMatch(decision.id, 'p1', '', access()),
    () => h.store.rejectPatientMatch(decision.id, '', access()),
    () => h.store.matchCaseToPatient(id, 'spoofed', { ...access(), active: false }),
  ]) rejectWithoutMutation(h, command)
})
