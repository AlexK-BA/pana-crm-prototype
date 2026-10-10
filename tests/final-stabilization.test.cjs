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
  assert.match(profile, /taskDescription\(task\)/)
  assert.match(profile, /channelText\(item\.channel, language\)/)
  assert.match(profile, /taskStatusText\(task\.status, language\)/)
  assert.match(actions, /tr\("Utwórz zadanie", "Создать задачу"\)/)
  assert.match(actions, /taskTypeLabel\(type, language\)/)
})

test('Patient 360 seed workflow tasks retain canonical metadata for localized labels', () => {
  const data = fs.readFileSync('lib/crm/entity-data.ts', 'utf8')
  assert.match(data, /id: "task-11"[\s\S]*?type: "waitlist_contact", source: "workflow", mandatory: true/)
  assert.match(data, /workflowRuleId: "leads\.waiting\.offer-slot"/)
})

test('command palette follows the active PL/RU language', () => {
  const palette = fs.readFileSync('components/crm/command-palette.tsx', 'utf8')
  assert.match(palette, /useLanguage\(\)/)
  assert.match(palette, /tr\("Paleta poleceń", "Палитра команд"\)/)
  assert.match(palette, /tr\("Szukaj spraw, pacjentów, numerów telefonu\.\.\.\", "Искать кейсы, пациентов, номера телефонов\.\.\.\"\)/)
})

test('admin users, permissions and workflow settings follow the active PL/RU language', () => {
  const users = fs.readFileSync('components/crm/user-management-view.tsx', 'utf8')
  const permissions = fs.readFileSync('components/crm/role-permission-matrix.tsx', 'utf8')
  const settings = fs.readFileSync('components/crm/settings-view.tsx', 'utf8')
  assert.match(users, /tr\("Użytkownicy aplikacji", "Пользователи приложения"\)/)
  assert.match(users, /formatRelative\(user\.lastLoginAt, language\)/)
  assert.match(users, /tr\("Edytuj role i kliniki", "Изменить роли и клиники"\)/)
  assert.match(permissions, /PERMISSION_RU\[permission\.id\]/)
  assert.match(permissions, /tr\("Role i uprawnienia", "Роли и разрешения"\)/)
  assert.match(settings, /WORKFLOW_TASK_TITLE_RU/)
  assert.match(settings, /tr\("Źródła wiedzy bota", "Источники знаний бота"\)/)
  assert.match(settings, /complete: \["Zakończone", "Завершено"\]/)
})

test('admin home and audit log follow the active PL/RU language', () => {
  const home = fs.readFileSync('components/crm/home/admin-home.tsx', 'utf8')
  const audit = fs.readFileSync('components/crm/audit-log-view.tsx', 'utf8')
  assert.match(home, /tr\("Sprawy w systemie", "Кейсы в системе"\)/)
  assert.match(home, /formatRelative\(e\.at, language\)/)
  assert.match(audit, /TYPE_LABELS_RU/)
  assert.match(audit, /tr\("Dziennik zdarzeń", "Журнал событий"\)/)
  assert.match(audit, /formatRelative\(event\.at, language\)/)
})
