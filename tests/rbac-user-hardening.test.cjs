// Isolated command tests execute the real provider source with a minimal hook host.
// This verifies guards and state/audit effects, not React/browser rendering or IdP behavior.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function harness(initialRole = 'admin') {
  let role = initialRole
  let host
  const events = []
  const hosts = new Map()
  const cache = new Map()
  const react = {
    createContext: () => { const context = {}; context.Provider = { context }; return context },
    useContext: context => context.value,
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useState: initial => {
      const index = host.cursor++
      if (!(index in host.slots)) host.slots[index] = typeof initial === 'function' ? initial() : initial
      const owner = host
      return [owner.slots[index], next => { owner.slots[index] = typeof next === 'function' ? next(owner.slots[index]) : next }]
    },
    useRef: initial => {
      const index = host.cursor++
      if (!(index in host.slots)) host.slots[index] = { current: initial }
      return host.slots[index]
    },
  }
  const jsx = (type, props) => { if (type.context) type.context.value = props.value; return null }
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const localRequire = name => {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => key })
      if (name === '@/lib/crm/user-directory') return load('lib/crm/user-directory.tsx')
      if (name.startsWith('@/')) return {}
      if (name === './role-context') return { useRole: () => ({ role }) }
      if (name === './entity-store') return { useEntityStore: () => ({ recordAudit: event => events.push(event) }) }
      const resolved = path.resolve(path.dirname(file), name)
      return load(fs.existsSync(resolved + '.tsx') ? resolved + '.tsx' : resolved + '.ts')
    }
    vm.runInNewContext(code + (file.endsWith("audit-log-view.tsx") ? "\nexports.auditHelpers = { actorName, actorInitials, actorColor, matchesQuery };" : ""), { require: localRequire, module, exports: module.exports, Date, Set, console }, { filename: file })
    return module.exports
  }
  const authModule = load('lib/crm/authorization-context.tsx')
  const directoryModule = load('lib/crm/user-directory.tsx')
  function renderProvider(fn) {
    if (!hosts.has(fn)) hosts.set(fn, { slots: [], cursor: 0 })
    host = hosts.get(fn); host.cursor = 0; fn({ children: null })
  }
  const api = { events, load,
    render() { renderProvider(authModule.AuthorizationProvider); renderProvider(directoryModule.UserDirectoryProvider); api.auth = authModule.useAuthorization(); api.users = directoryModule.useUserDirectory(); return api },
    switchRole(next) { role = next; return api.render() },
  }
  return api.render()
}
const userInput = { name: ' Test User ', email: ' NEW@EXAMPLE.COM ', roles: ['operator'], clinicIds: ['pana-medica'] }
function rejected(h, command) {
  const before = JSON.stringify({ users: h.users.users, permissions: h.auth.rolePermissions, events: h.events })
  assert.throws(command, error => error.name === 'AccessCommandError' && error.message.length > 0)
  h.render()
  assert.equal(JSON.stringify({ users: h.users.users, permissions: h.auth.rolePermissions, events: h.events }), before)
}

test('all seven protected commands reject default Operator without mutation or audit', () => {
  const h = harness('operator')
  for (const command of [
    () => h.users.createUser(userInput), () => h.users.setActive('usr-im', false),
    () => h.users.requestPasswordReset('usr-im'), () => h.users.revokeSessions('usr-im'),
    () => h.users.updateAccess('usr-im', ['marketing'], []),
    () => h.auth.toggleRolePermission('marketing', 'users:manage'), () => h.auth.resetRolePermissions('marketing'),
  ]) rejected(h, command)
})

test('create normalizes input and rejects invalid or duplicate identity/access, including batched duplicate', () => {
  const h = harness()
  h.users.createUser(userInput)
  // No render between commands: must see the newly reserved canonical user immediately.
  assert.throws(() => h.users.createUser({ ...userInput, email: 'new@example.com' }), /już istnieje/)
  h.render()
  const created = h.users.users.find(user => user.email === 'new@example.com')
  assert.equal(created.name, 'Test User'); assert.equal(created.status, 'invited')
  assert.equal(h.events.length, 1); assert.equal(h.events[0].type, 'user_invited')
  assert.equal(h.events[0].actorId, 'usr-mk'); assert.equal(h.events[0].targetUserId, created.id)
  for (const patch of [{ name: ' ' }, { email: 'invalid' }, { email: 'NEW@EXAMPLE.COM' },
    { roles: [] }, { roles: ['missing'] }, { clinicIds: [] }, { clinicIds: ['missing'] },
    { roles: ['admin', 'operator'], clinicIds: [] }]) rejected(h, () => h.users.createUser({ ...userInput, email: 'other@example.com', ...patch }))
})

test('unknown targets, self actions and invalid updates reject before audit/state', () => {
  const h = harness()
  for (const command of [() => h.users.setActive('missing', false), () => h.users.setActive('missing', true),
    () => h.users.requestPasswordReset('missing'), () => h.users.revokeSessions('missing'),
    () => h.users.updateAccess('missing', ['admin'], []), () => h.users.setActive('usr-mk', false),
    () => h.users.updateAccess('usr-mk', ['marketing'], []), () => h.users.updateAccess('usr-im', [], []),
    () => h.users.updateAccess('usr-im', ['operator'], []), () => h.users.updateAccess('usr-im', ['bad'], []),
    () => h.users.updateAccess('usr-im', ['marketing'], ['bad'])]) rejected(h, command)
  assert.equal('deleteUser' in h.users, false)
})

test('deactivation and reactivation preserve ID, access and last session revocation', () => {
  const h = harness()
  const before = h.users.users.find(u => u.id === 'usr-im')
  h.users.setActive(before.id, false); h.render()
  const inactive = h.users.users.find(u => u.id === before.id)
  assert.equal(inactive.status, 'inactive'); assert.ok(inactive.deactivatedAt)
  assert.equal(inactive.deactivatedAt, inactive.sessionsRevokedAt)
  assert.deepEqual(inactive.roles, before.roles); assert.deepEqual(inactive.clinicIds, before.clinicIds)
  h.users.setActive(before.id, true); h.render()
  const active = h.users.users.find(u => u.id === before.id)
  assert.equal(active.status, 'active'); assert.equal(active.deactivatedAt, undefined)
  assert.equal(active.sessionsRevokedAt, inactive.sessionsRevokedAt)
  assert.deepEqual(h.events.map(e => e.type), ['user_deactivated', 'user_activated'])
  assert.ok(h.events.every(e => e.actorId === 'usr-mk' && e.targetUserId === before.id))
})

test('typed reset/revoke/access events and other-admin access retain canonical targets', () => {
  const h = harness()
  h.users.createUser({ name: 'Second Admin', email: 'admin2@example.com', roles: ['admin'], clinicIds: [] }); h.render()
  const admin = h.users.users.find(u => u.email === 'admin2@example.com')
  h.users.updateAccess(admin.id, ['admin', 'team_leader'], []); h.render()
  h.users.requestPasswordReset(admin.id); h.render(); h.users.revokeSessions(admin.id); h.render()
  assert.deepEqual(h.events.map(e => e.type), ['user_invited', 'user_access_changed', 'user_password_reset_requested', 'user_sessions_revoked'])
  assert.ok(h.events.every(e => e.actorId === 'usr-mk' && e.targetUserId === admin.id && e.correlationId === admin.id))
  assert.ok(h.events[1].before); assert.ok(h.events[1].after)
  assert.equal(h.users.users.find(u => u.id === admin.id).status, 'invited')
})

test('admin bundle is protected, unknown matrix input rejects, role reset is typed', () => {
  const h = harness()
  for (const permission of ['users:manage', 'configuration:manage', 'audit:view']) {
    rejected(h, () => h.auth.toggleRolePermission('admin', permission)); assert.equal(h.auth.hasPermission(permission), true)
  }
  rejected(h, () => h.auth.resetRolePermissions('admin'))
  rejected(h, () => h.auth.resetRolePermissions('bad'))
  rejected(h, () => h.auth.toggleRolePermission('bad', 'audit:view'))
  rejected(h, () => h.auth.toggleRolePermission('operator', 'bad'))
  h.auth.toggleRolePermission('operator', 'sms:send_custom'); h.render()
  h.auth.resetRolePermissions('operator'); h.render()
  assert.deepEqual(h.events.map(e => e.type), ['role_permissions_changed', 'role_permissions_reset'])
  assert.ok(h.events.every(e => e.actorId === 'usr-mk' && e.targetRole === 'operator' && e.before && e.after))
})

test('configuration permission is required independently and immediate revocation affects retained commands', () => {
  const h = harness()
  h.auth.toggleRolePermission('operator', 'configuration:manage'); h.render(); h.switchRole('operator')
  const retainedReset = h.auth.resetRolePermissions
  h.auth.toggleRolePermission('operator', 'configuration:manage')
  assert.throws(() => retainedReset('marketing'), /configuration:manage/)
  h.render(); assert.equal(h.auth.canAccessRoute('/audit'), false)
  h.switchRole('admin'); assert.equal(h.auth.canAccessRoute('/audit'), true)
})


test('live audit resolves and searches session-created actors even after deactivation', () => {
  const h = harness()
  h.users.createUser(userInput); h.render()
  const created = h.users.users.find(u => u.email === 'new@example.com')
  const { auditHelpers } = h.load('components/crm/audit-log-view.tsx')
  const event = { summary: 'Administrative demo action', actorId: created.id, targetUserId: 'usr-im' }
  assert.equal(auditHelpers.actorName(created.id, h.users.users), 'Test User')
  assert.equal(auditHelpers.actorInitials(created.id, h.users.users), 'TU')
  assert.equal(auditHelpers.matchesQuery(event, 'test user', h.users.users), true)
  h.users.setActive(created.id, false); h.render()
  assert.equal(auditHelpers.actorName(created.id, h.users.users), 'Test User')
  assert.equal(auditHelpers.matchesQuery(event, 'ilona', h.users.users), true)
})

test('inactive and no-longer-assigned demo actors cannot invoke user commands', () => {
  const h = harness()
  h.auth.toggleRolePermission('operator', 'users:manage'); h.render()
  h.users.setActive('usr-ws', false); h.render(); h.switchRole('operator')
  rejected(h, () => h.users.createUser(userInput))
  h.switchRole('admin'); h.users.setActive('usr-ws', true); h.render()
  h.users.updateAccess('usr-ws', ['marketing'], []); h.render(); h.switchRole('operator')
  rejected(h, () => h.users.revokeSessions('usr-im'))
})
