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

test('case workspace keeps context visible and offers stage-aware actions', () => {
  const drawer = fs.readFileSync('components/crm/engagement-case-drawer.tsx', 'utf8')
  const conversation = fs.readFileSync('components/crm/conversation-thread.tsx', 'utf8')
  const tasks = fs.readFileSync('components/crm/task-actions.tsx', 'utf8')
  const booking = fs.readFileSync('components/crm/appointment-slot-picker.tsx', 'utf8')
  assert.match(drawer, /Komentarze zespołu/)
  assert.match(drawer, /Profil i dane kontaktowe/)
  assert.match(conversation, /data-message-composer/)
  assert.match(tasks, /stageRule\?\.suggestedTasks/)
  assert.match(tasks, /"custom"/)
  assert.match(booking, /selectedClinicId/)
  assert.match(booking, /selectedProcedureId/)
  assert.match(booking, /selectedDoctorId/)
})

test('manual ordering stays presentational and filtered boards cannot move cards', () => {
  const ordering = harness().load('lib/crm/manual-order.ts')
  const items = [{ id: 'urgent', fallback: 0 }, { id: 'ranked-b', fallback: 1 }, { id: 'ranked-a', fallback: 2 }]
  assert.deepEqual(Array.from(ordering.sortWithManualOrder(items, { 'ranked-a': 0, 'ranked-b': 1 }, item => item.id, (a, b) => a.fallback - b.fallback), item => item.id), ['urgent', 'ranked-a', 'ranked-b'])
  const board = fs.readFileSync('components/crm/kanban-board.tsx', 'utf8')
  const columns = fs.readFileSync('components/crm/sortable-columns.tsx', 'utf8')
  assert.match(board, /disabled=\{!canMoveCase \|\| reorderDisabled\}/)
  assert.match(columns, /if \(reorderDisabled\) return/)
})

test('Patient 360 uses the active PL/RU language for its workspace and actions', () => {
  const profile = fs.readFileSync('components/crm/patient-profile.tsx', 'utf8')
  const actions = fs.readFileSync('components/crm/patient-360-actions.tsx', 'utf8')
  assert.match(profile, /tr\("Przegląd", "Обзор"\)/)
  assert.match(profile, /tr\("Oś aktywności", "Хронология активности"\)/)
  assert.match(profile, /tr\("Patient 360 · podsumowanie", "Patient 360 · сводка"\)/)
  assert.match(profile, /tr\("Źródło pierwszego kontaktu \(niezmienne\)", "Источник первого контакта \(неизменяемый\)"\)/)
  assert.match(profile, /formatRelative\(latest, language\)/)
  assert.match(profile, /taskTypeLabel\(taskType\(task\), language\)/)
  assert.match(actions, /tr\("Utwórz zadanie", "Создать задачу"\)/)
  assert.match(actions, /taskTypeLabel\(type, language\)/)
})
