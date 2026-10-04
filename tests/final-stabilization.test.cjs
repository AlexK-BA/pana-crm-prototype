const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { harness } = require('./helpers/crm-command-harness.cjs')

const patientLink = harness().load('lib/crm/patient-link-state.ts')

const localPatient = { id: 'local-1', integrationState: 'unlinked' }
const linkedPatient = { id: 'medical-1', integrationState: 'linked' }
const targetCase = { id: 'case-1', patientId: 'local-1' }

test('local Patient grouping never masquerades as a Medical CRM link', () => {
  assert.equal(patientLink.resolvePatientLinkState(targetCase, localPatient, undefined), 'unlinked')
  assert.equal(patientLink.resolvePatientLinkState({ ...targetCase, patientId: undefined }, undefined, undefined), 'unlinked')
  assert.equal(patientLink.resolvePatientLinkState({ ...targetCase, patientId: 'medical-1' }, linkedPatient, undefined), 'linked')
})

test('conflict remains visible even when a Case already references a Patient', () => {
  const decision = { decision: 'conflict', status: 'conflict' }
  assert.equal(patientLink.resolvePatientLinkState(targetCase, linkedPatient, decision), 'conflict')
})

test('SMS composer never replaces a human draft with the clinic default automatically', () => {
  const source = fs.readFileSync('components/crm/conversation-thread.tsx', 'utf8')
  assert.doesNotMatch(source, /setDraft\(defaultSmsText\)/)
  assert.match(source, /Wstaw domyślny tekst kliniki/)
  assert.match(source, /current\.trim\(\) \? current : defaultSmsText/)
})

test('mobile shell exposes navigation, search and call controls', () => {
  const topbar = fs.readFileSync('components/crm/app-topbar.tsx', 'utf8')
  const sidebar = fs.readFileSync('components/crm/app-sidebar.tsx', 'utf8')
  assert.match(topbar, /AppSidebar mobile/)
  assert.match(topbar, /aria-label=\{t\("search_placeholder"\)\}/)
  assert.match(topbar, /setMobileNavigationOpen\(true\)/)
  assert.match(sidebar, /mobile \? "flex h-full w-full"/)
})
