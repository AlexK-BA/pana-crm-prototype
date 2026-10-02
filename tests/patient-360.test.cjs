const test = require('node:test')
const assert = require('node:assert/strict')
const { harness, patients, identities } = require('./helpers/crm-command-harness.cjs')
const plain = value => JSON.parse(JSON.stringify(value))
const now = Date.parse('2026-10-02T12:00:00Z')
const touch = { type: 'first_touch', source: 'Original campaign', channel: 'phone', language: 'pl', clinicIntentId: 'pana-medica', at: '2025-01-01T00:00:00Z', sourceRecordId: 'original' }
const caseFor = (id, patientId = 'p1', clinicId = 'pana-medica') => ({ id, patientId, clinicId, contactIdentityId: patientId === 'p1' ? 'phone1' : 'phone2', contactIdentityIds: patientId === 'p1' ? ['phone1', 'email1'] : ['phone2'], board: 'leads', status: 'new', responsibleTeamId: 'usr-test', createdAt: '2026-01-01T00:00:00Z', attribution: { firstTouch: structuredClone(touch), caseCreationTouch: { ...touch, type: 'case_creation' } } })
const patientFixtures = () => patients.map(item => ({ ...structuredClone(item), preferredLanguage: 'pl', contactable: true, provenance: [{ field: 'medicalSummary', value: 'Sensitive fixture', source: 'PaNa CRM' }], treatmentPlan: { id: 'plan-' + item.id, version: 1, status: 'draft', date: '2026-01-01', items: [{ id: 't1', name: 'Synthetic treatment' }] } }))
const create = seed => harness({ patients: patientFixtures(), cases: [caseFor('c1'), caseFor('c2'), caseFor('other', 'p2', 'pana-comfort')], ...seed })
const permissions = create().load('lib/crm/permissions.ts').ROLE_PERMISSIONS
const access = (role = 'admin', overrides = {}) => ({ actorId: 'usr-canonical', active: true, globalScope: ['admin', 'team_leader'].includes(role), clinicIds: ['pana-medica'], hasPermission: permission => permissions[role].includes(permission), ...overrides })
const selectors = create().load('lib/crm/patient-360-selectors.ts')
const snapshot = h => JSON.stringify({ patients: h.store.patients, cases: h.store.cases, tasks: h.store.tasks, identities: h.store.identities, messages: h.store.interactions, comments: h.store.comments, audit: h.store.auditEvents, decisions: h.store.matchDecisions })
function rejects(h, command) { const before = snapshot(h); assert.throws(command, error => error.name === 'AccessCommandError'); h.render(); assert.equal(snapshot(h), before) }

test('Patient 360 projects all and only canonical cases/tasks/history of one Patient', () => {
  const h = create({ tasks: [{ id: 't1', caseId: 'c1', patientId: 'p1', status: 'completed', priority: 'P2' }, { id: 't2', caseId: 'c2', status: 'ready', priority: 'P1' }, { id: 'foreign', caseId: 'other', patientId: 'p1', status: 'ready', priority: 'P0' }] })
  const view = selectors.selectPatient360('p1', h.store, now)
  assert.deepEqual(plain(view.cases.map(item => item.id)), ['c1', 'c2'])
  assert.deepEqual(new Set(view.tasks.map(item => item.id)), new Set(['t1', 't2']))
  assert.equal(view.tasks.some(item => item.status === 'completed'), true)
  assert.equal(view.patient, h.store.patients[0])
})

test('clinic projection excludes foreign cases/patients; Marketing receives no Patient 360 PII', () => {
  const h = create(); const manager = h.scoped('clinic_manager')
  assert.equal(manager.cases.some(item => item.id === 'other'), false); assert.equal(manager.patients.some(item => item.id === 'p2'), false)
  const marketing = h.scoped('marketing')
  for (const key of ['patients', 'identities', 'cases', 'tasks', 'interactions', 'comments', 'auditEvents', 'matchDecisions']) assert.equal(marketing[key].length, 0, key)
})

test('basic-only Operator projection removes PESEL, treatment plan, conflicts and medical provenance', () => {
  const h = create(); const operator = h.scoped('operator').patients.find(item => item.id === 'p1')
  assert.equal(operator.pesel, undefined); assert.equal(operator.treatmentPlan, undefined); assert.equal(operator.medicalSummary, undefined); assert.equal(operator.conflicts, undefined); assert.equal(operator.provenance.length, 0)
  assert.equal(h.scoped('patient_care').patients[0].treatmentPlan.id, 'plan-p1')
})

test('Patient without any case is accessible in own clinic, with empty operational sections', () => {
  const h = create({ cases: [] }); const source = h.scoped('operator'); const view = selectors.selectPatient360('p1', source, now)
  assert.equal(view.patient.id, 'p1'); assert.equal(view.cases.length, 0); assert.equal(view.tasks.length, 0); assert.equal(view.nextTask, undefined)
})

test('new case preserves Patient, original case and immutable first touch; creates separate caseCreationTouch and real workflow task', () => {
  const h = create(); const beforePatients = JSON.stringify(h.store.patients); const original = JSON.stringify(h.store.cases[0])
  const created = h.store.createPatientCase({ patientId: 'p1', contactIdentityId: 'email1', channel: 'email', clinicId: 'pana-medica', board: 'leads' }, access('operator')); h.render()
  assert.equal(JSON.stringify(h.store.patients), beforePatients); assert.equal(JSON.stringify(h.store.cases[0]), original)
  assert.equal(created.patientId, 'p1'); assert.deepEqual(plain(created.attribution.firstTouch), touch)
  assert.equal(created.attribution.caseCreationTouch.type, 'case_creation'); assert.equal(created.attribution.caseCreationTouch.sourceRecordId, created.id)
  assert.notEqual(created.attribution.caseCreationTouch.at, touch.at)
  const task = h.store.tasks.find(item => item.caseId === created.id)
  assert.equal(task.workflowRuleId, 'leads.new.first-contact'); assert.equal(task.status, 'planned'); assert.equal(task.patientId, 'p1')
  assert.ok(h.store.auditEvents.some(item => item.type === 'case_created' && item.actorId === 'usr-canonical'))
})

test('new case validates clinic, contact ownership/channel and workflow before mutation', () => {
  const h = create(); const input = { patientId: 'p1', contactIdentityId: 'phone1', channel: 'phone', clinicId: 'pana-medica', board: 'leads' }
  for (const patch of [{ clinicId: 'pana-comfort' }, { contactIdentityId: 'phone2' }, { channel: 'email' }, { board: 'unknown' }, { serviceInterest: 'missing' }]) rejects(h, () => h.store.createPatientCase({ ...input, ...patch }, access('clinic_manager')))
})

test('new task stays in its case; call-required completion cannot bypass disposition/wrap-up', () => {
  const h = create(); const task = h.store.createPatientTask({ caseId: 'c2', title: 'Call required', dueAt: new Date(now + 86400000).toISOString(), priority: 'P1', requiresCall: true }, access()); h.render()
  assert.equal(task.caseId, 'c2'); assert.equal(task.patientId, 'p1'); assert.equal(task.ownerId, 'usr-canonical')
  rejects(h, () => h.store.completePatientTask(task.id, access()))
  assert.equal(h.store.tasks.find(item => item.id === task.id).status, 'planned')
  const simple = h.store.createPatientTask({ caseId: 'c1', title: 'Operational follow-up', dueAt: new Date(now).toISOString(), priority: 'P2' }, access()); h.render()
  h.store.completePatientTask(simple.id, access()); h.render(); assert.equal(h.store.tasks.find(item => item.id === simple.id).status, 'completed')
})

test('Patient 360 sorts overdue first, then P0/P1 and due time; keeps completed/cancelled history', () => {
  const tasks = [
    { id: 'future-p0', caseId: 'c1', status: 'ready', priority: 'P0', dueAt: new Date(now + 10000).toISOString() },
    { id: 'overdue-p4', caseId: 'c1', status: 'ready', priority: 'P4', dueAt: new Date(now - 10000).toISOString() },
    { id: 'future-p1', caseId: 'c1', status: 'ready', priority: 'P1', dueAt: new Date(now + 5000).toISOString() },
    { id: 'done', caseId: 'c1', status: 'completed', priority: 'P3' }, { id: 'cancelled', caseId: 'c2', status: 'cancelled', priority: 'P3' },
  ]
  const h = create({ tasks }); const view = selectors.selectPatient360('p1', h.store, now)
  assert.equal(view.tasks[0].id, 'overdue-p4'); assert.equal(view.tasks[1].id, 'future-p0'); assert.equal(view.tasks[2].id, 'future-p1')
  assert.equal(view.tasks.length, 5); assert.equal(selectors.patientTaskGroup(tasks[3], now), 'completed'); assert.equal(selectors.patientTaskGroup(tasks[4], now), 'cancelled')
})

test('communication threads split case/channel/identity, with each factual message represented once', () => {
  const h = create({ interactions: [
    { id: 'sms1', caseId: 'c1', patientId: 'p1', contactIdentityId: 'phone1', type: 'sms', channel: 'phone', recipient: '+48611924357', direction: 'incoming', at: '2026-10-01T10:00:00Z', deliveryStatus: 'received' },
    { id: 'email1-msg', caseId: 'c1', patientId: 'p1', contactIdentityId: 'email1', type: 'email', channel: 'email', direction: 'incoming', at: '2026-10-01T11:00:00Z', text: 'email' },
    { id: 'c2-sms', caseId: 'c2', patientId: 'p1', type: 'sms', recipient: '+48611924357', direction: 'outgoing', at: '2026-10-01T12:00:00Z' },
    { id: 'unbound-sms', patientId: 'p1', type: 'sms', recipient: '+48611924357', direction: 'outgoing', at: '2026-10-01T13:00:00Z' },
    { id: 'note', caseId: 'c1', type: 'note', at: '2026-10-01T14:00:00Z' },
  ] })
  const view = selectors.selectPatient360('p1', h.store, now)
  assert.equal(view.threads.flatMap(item => item.messages).length, 4)
  assert.equal(new Set(view.threads.flatMap(item => item.messages.map(message => message.id))).size, 4)
  assert.equal(view.threads.find(item => item.messages.some(message => message.id === 'email1-msg')).channel, 'email')
  assert.equal(view.threads.find(item => item.messages.some(message => message.id === 'c2-sms')).caseId, 'c2')
  assert.equal(view.threads.find(item => item.messages.some(message => message.id === 'unbound-sms')).caseId, undefined)
})

test('thread read marking affects one thread and uses a runtime timestamp', () => {
  const h = create({ interactions: [{ id: 'msg', caseId: 'c1', contactIdentityId: 'email1', type: 'email', channel: 'email', direction: 'incoming', at: new Date(Date.now() - 1000).toISOString() }] })
  const key = 'c1/email1/email'; h.store.markRead('thread:' + key); h.render()
  assert.ok(Date.parse(h.store.readAt['thread:' + key]) >= Date.now() - 2000)
  const thread = selectors.selectPatient360('p1', h.store).threads.find(item => item.id === key); assert.equal(thread.unread, 0); assert.equal(h.store.readAt.c1, undefined)
})

test('comments stay human-only; correlated audit rows fold into one message activity without deleting audit', () => {
  const h = create({ interactions: [{ id: 'msg', patientId: 'p1', caseId: 'c1', type: 'sms', at: '2026-10-01', text: 'hello', recipient: '+48611924357' }], auditEvents: [{ id: 'a1', patientId: 'p1', caseId: 'c1', type: 'sms_send', correlationId: 'msg', at: '2026-10-01', summary: 'sent' }, { id: 'a2', caseId: 'c1', type: 'sms_retry', correlationId: 'msg', at: '2026-10-01', summary: 'retry' }] })
  h.store.addCaseComment('c1', 'Human comment', access()); h.render()
  const view = selectors.selectPatient360('p1', h.store, now)
  assert.equal(view.comments.length, 1); assert.equal(view.comments[0].text, 'Human comment')
  const activity = view.activity.find(item => item.id === 'msg'); assert.equal(activity.events.length, 2)
  assert.equal(view.activity.filter(item => item.interaction?.id === 'msg').length, 1); assert.equal(h.store.auditEvents.length, 3)
  assert.equal(view.activity.some(item => item.interaction?.text === 'Human comment'), false)
})

test('local contact adds/reuses canonical identity, preserving verified contact and Medical CRM fields', () => {
  const h = create(); const beforePhone = JSON.stringify(h.store.identities[0]); const beforePatient = JSON.stringify(h.store.patients[0])
  const reused = h.store.addPatientContact({ patientId: 'p1', channel: 'phone', value: '611924357', displayName: 'Cannot overwrite verified' }, access()); h.render()
  assert.equal(reused.identityId, 'phone1'); assert.equal(JSON.stringify(h.store.identities[0]), beforePhone)
  const added = h.store.addPatientContact({ patientId: 'p1', caseId: 'c2', channel: 'telegram', value: '@synthetic-contact', displayName: 'Local' }, access()); h.render()
  const identity = h.store.identities.find(item => item.id === added.identityId); assert.equal(identity.patientId, 'p1'); assert.equal(identity.verified, false)
  assert.ok(h.store.cases.find(item => item.id === 'c2').contactIdentityIds.includes(identity.id)); assert.equal(JSON.stringify(h.store.patients[0]), beforePatient)
})

test('foreign contact never transfers; conflict goes to existing Patient Matching as unlinked review case', () => {
  for (const externalPatientId of ['EXT-1', undefined]) {
    const ps = patientFixtures(); ps[0].externalPatientId = externalPatientId
    const h = create({ patients: ps }); const before = JSON.stringify(h.store.identities.find(item => item.id === 'phone2'))
    const result = h.store.addPatientContact({ patientId: 'p1', channel: 'phone', value: '712483209' }, access()); h.render()
    assert.ok(result.conflictCaseId); assert.equal(JSON.stringify(h.store.identities.find(item => item.id === 'phone2')), before)
    const review = h.store.cases.find(item => item.id === result.conflictCaseId); assert.equal(review.patientId, undefined); assert.equal(review.requestedPatientId, 'p1')
    assert.equal(h.store.matchDecisions.find(item => item.caseId === review.id).decision, 'conflict')
    assert.ok(selectors.selectPatient360('p1', h.store).matches.some(item => item.caseId === review.id))
  }
})

test('local field command allowlist ignores injected medical/identity fields', () => {
  const h = create(); const before = plain(h.store.patients[0])
  h.store.updatePatientLocal('p1', { localTags: [' Follow-up ', 'Follow-up'], localNote: 'CRM note', firstName: 'Injected', pesel: '99999999999', treatmentPlan: {} }, access()); h.render()
  const after = h.store.patients[0]; assert.equal(after.firstName, before.firstName); assert.equal(after.pesel, before.pesel); assert.deepEqual(plain(after.treatmentPlan), before.treatmentPlan)
  assert.deepEqual(plain(after.localTags), ['Follow-up']); assert.equal(after.localNote, 'CRM note')
})

test('all Patient 360 direct commands deny absent permission/context before mutation or audit', () => {
  const h = create(); const input = { patientId: 'p1', contactIdentityId: 'phone1', channel: 'phone', clinicId: 'pana-medica', board: 'leads' }
  for (const command of [
    () => h.store.createPatientCase(input), () => h.store.createPatientTask({ caseId: 'c1', title: 'Denied', dueAt: new Date().toISOString(), priority: 'P2' }),
    () => h.store.completePatientTask('unknown'), () => h.store.addPatientContact({ patientId: 'p1', channel: 'email', value: 'local@example.test' }),
    () => h.store.updatePatientLocal('p1', { localTags: [], localNote: '' }), () => h.store.addCaseComment('c1', 'Denied'),
    () => h.store.syncPatientWithMedicalCrm('p1', 'spoofed'), () => h.store.sendTreatmentPlanTask('p1', 'c1', 'spoofed'),
    () => h.store.syncPatientWithMedicalCrm('p1', 'spoofed', access('operator')),
    () => h.store.createPatientCase(input, access('marketing')), () => h.store.addPatientContact({ patientId: 'p2', channel: 'email', value: 'foreign@example.test' }, access('clinic_manager')),
  ]) rejects(h, command)
})

test('case-scoped composer validates identity ownership/channel, and retains correct channel metadata', () => {
  const h = create(); rejects(h, () => h.store.sendMessage({ caseId: 'c1', patientId: 'p1', text: 'wrong', type: 'email', channel: 'email', direction: 'outgoing', contactIdentityId: 'phone2' }, access()))
  const sent = h.store.sendMessage({ caseId: 'c1', patientId: 'p1', text: 'Synthetic email', type: 'email', channel: 'email', direction: 'outgoing', contactIdentityId: 'email1' }, access()); h.render()
  assert.equal(sent.contactIdentityId, 'email1'); assert.ok(Date.parse(sent.at) >= Date.now() - 2000)
})

test('SMS Stage 1 failure/retry preserves original, creates new record and leaves task open', async () => {
  const h = create({ tasks: [{ id: 'sms-task', patientId: 'p1', caseId: 'c1', status: 'ready', priority: 'P2' }] })
  const sent = h.store.sendSms({ patientId: 'p1', caseId: 'c1', taskId: 'sms-task', recipient: '+48611924357', text: 'Synthetic test only', authorId: 'usr-test', simulateError: true }); h.render()
  await new Promise(resolve => setTimeout(resolve, 750)); h.render()
  assert.equal(h.store.interactions.find(item => item.id === sent.id).deliveryStatus, 'failed')
  const retried = h.store.retrySms(sent.id, 'usr-test', false); h.render()
  assert.notEqual(retried.id, sent.id); assert.equal(retried.retryOfId, sent.id)
  await new Promise(resolve => setTimeout(resolve, 1900)); h.render()
  assert.equal(h.store.interactions.find(item => item.id === sent.id).deliveryStatus, 'failed'); assert.equal(h.store.interactions.find(item => item.id === retried.id).deliveryStatus, 'delivered')
  assert.equal(h.store.tasks[0].status, 'ready')
})


test('existing call lifecycle accepts a selected canonical phone and still requires wrap-up', () => {
  const h = create({ tasks: [{ id: 'call-task', patientId: 'p1', caseId: 'c1', status: 'ready', priority: 'P1', requiresCall: true, attempts: 0 }] })
  h.scoped('operator'); h.callRender()
  h.call.startOutgoingCall({ caseId: 'c1', taskId: 'call-task', contactIdentityId: 'phone1' }); h.callRender()
  assert.equal(h.call.phase, 'active'); assert.equal(h.call.call.callerNumber, '+48 611 924 357')
  h.call.hangUp(); h.callRender(); assert.equal(h.call.phase, 'wrapup')
  h.call.startOutgoingCall({ caseId: 'c2', contactIdentityId: 'phone1' }); h.callRender(); assert.equal(h.call.call.caseId, 'c1'); assert.equal(h.call.phase, 'wrapup')
  assert.equal(h.call.submitWrapUp('call_later', { rescheduleAt: 'invalid' }), false)
  assert.equal(h.call.submitWrapUp('appointment_scheduled'), true); h.render(); h.callRender()
  assert.equal(h.call.phase, 'idle'); assert.equal(h.store.tasks[0].status, 'completed'); assert.equal(h.store.interactions[0].contactIdentityId, 'phone1')
})

test('selected outgoing phone rejects a foreign or unowned identity without starting a call', () => {
  const h = create(); h.scoped('operator'); h.callRender(); const before = snapshot(h)
  assert.throws(() => h.call.startOutgoingCall({ caseId: 'c1', contactIdentityId: 'phone2' }), /Numer nie należy/)
  h.callRender(); assert.equal(h.call.phase, 'idle'); assert.equal(snapshot(h), before)
})

test('shared incoming call still offers and claims the existing operator and opens the same case', () => {
  const h = create(); h.scoped('operator'); h.callRender()
  h.call.simulateIncomingCall({ caseId: 'c1' }); h.render(); h.callRender()
  assert.equal(h.call.phase, 'incoming'); assert.ok(h.call.call.offeredToUserIds.includes('usr-test'))
  h.call.answer(); h.callRender(); assert.equal(h.call.phase, 'active'); assert.equal(h.call.call.claimedByUserId, 'usr-test'); assert.equal(h.opened.at(-1), 'c1')
  h.call.hangUp(); h.callRender(); assert.equal(h.call.phase, 'wrapup')
})
