const test = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/crm-command-harness.cjs')

const permissions = harness().load('lib/crm/permissions.ts')
const roles = harness().load('lib/crm/roles.ts')

test('every configured role has one complete, duplicate-free permission bundle', () => {
  assert.deepEqual(Object.keys(permissions.ROLE_PERMISSIONS).sort(), [...roles.ROLE_ORDER].sort())
  for (const role of roles.ROLE_ORDER) {
    const bundle = permissions.ROLE_PERMISSIONS[role]
    assert.equal(new Set(bundle).size, bundle.length, `${role} contains duplicate permissions`)
    assert.ok(bundle.every((permission) => permissions.ALL_PERMISSIONS.includes(permission)), `${role} contains an unknown permission`)
  }
})

test('Operator workspace cannot reach administration, audit or medical data', () => {
  for (const route of ['/settings', '/users', '/audit', '/docs', '/patients/pat-01']) {
    const expected = route.startsWith('/patients')
    assert.equal(permissions.canAccessRoute('operator', route), expected, route)
  }
  assert.equal(permissions.hasPermission('operator', 'patient:view_medical'), false)
  assert.equal(permissions.hasPermission('operator', 'audit:view'), false)
  assert.equal(permissions.hasPermission('operator', 'users:manage'), false)
  assert.equal(permissions.hasPermission('operator', 'call:handle'), true)
  assert.equal(permissions.hasPermission('operator', 'task:work'), true)
})

test('Marketing stays aggregate-only and cannot access operational Patient/Case records', () => {
  assert.deepEqual(Array.from(permissions.ROLE_PERMISSIONS.marketing), ['report:view_marketing'])
  for (const route of ['/board', '/inbox', '/schedule', '/calendar', '/records', '/patients/pat-01', '/audit', '/settings']) {
    assert.equal(permissions.canAccessRoute('marketing', route), false, route)
  }
  assert.equal(permissions.canAccessRoute('marketing', '/'), true)
})

test('Team Leader can supervise audit while Admin/AIHub Admin retains the protected full bundle', () => {
  assert.equal(permissions.hasPermission('team_leader', 'audit:view'), true)
  assert.equal(permissions.canAccessRoute('team_leader', '/audit'), true)
  assert.equal(permissions.canAccessRoute('team_leader', '/users'), false)
  assert.deepEqual(new Set(permissions.ROLE_PERMISSIONS.admin), new Set(permissions.ALL_PERMISSIONS))
  for (const route of ['/audit', '/settings', '/users', '/docs', '/patients/pat-01']) {
    assert.equal(permissions.canAccessRoute('admin', route), true, route)
  }
})

test('Clinic Manager remains clinic-scoped and has no global configuration or central audit permission', () => {
  assert.equal(permissions.hasPermission('clinic_manager', 'task:assign'), true)
  assert.equal(permissions.hasPermission('clinic_manager', 'patient:match_approve'), true)
  assert.equal(permissions.hasPermission('clinic_manager', 'configuration:manage'), false)
  assert.equal(permissions.hasPermission('clinic_manager', 'audit:view'), false)
  assert.equal(permissions.canAccessRoute('clinic_manager', '/settings'), false)
  assert.equal(permissions.canAccessRoute('clinic_manager', '/audit'), false)
})
