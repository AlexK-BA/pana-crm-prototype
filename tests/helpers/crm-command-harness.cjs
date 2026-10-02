const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const patients = [
  { id: 'p1', externalPatientId: 'EXT-1', pesel: '11111111111', firstName: 'Test', lastName: 'One', primaryClinicId: 'pana-medica', integrationState: 'synced', medicalSummary: 'unchanged' },
  { id: 'p2', externalPatientId: 'EXT-2', pesel: '22222222222', firstName: 'Test', lastName: 'Two', primaryClinicId: 'pana-comfort', integrationState: 'synced' },
]
const identities = [
  { id: 'phone1', patientId: 'p1', channel: 'phone', value: '+48 611 924 357', verified: true, isPrimary: true },
  { id: 'email1', patientId: 'p1', channel: 'email', value: 'test.one@example.test', verified: true, isPrimary: false },
  { id: 'phone2', patientId: 'p2', channel: 'phone', value: '+48 712 483 209', verified: true, isPrimary: true },
]
function harness(seed = {}) {
  let host = { slots: [], cursor: 0 }
  let userRole = 'admin'
  const cache = new Map()
  let api
  const opened = []
  const react = {
    createContext: () => { const context = {}; context.Provider = { context }; return context },
    useContext: context => context.value, useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
    useState: initial => { const index = host.cursor++; if (!(index in host.slots)) host.slots[index] = typeof initial === 'function' ? initial() : initial
      return [host.slots[index], next => { host.slots[index] = typeof next === 'function' ? next(host.slots[index]) : next }] },
    useRef: initial => { const index = host.cursor++; if (!(index in host.slots)) host.slots[index] = { current: initial }; return host.slots[index] },
  }
  const jsx = (type, props) => { if (type.context) type.context.value = props.value; return null }
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const localRequire = name => {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => key })
      if (name === './entity-data') return { PATIENTS: seed.patients ?? structuredClone(patients), CONTACT_IDENTITIES: seed.identities ?? structuredClone(identities), ENGAGEMENT_CASES: seed.cases ?? [], TASKS: seed.tasks ?? [], INTERACTIONS: seed.interactions ?? [], AUDIT_EVENTS: seed.auditEvents ?? [], COMMENTS: seed.comments ?? [], BROADCASTS: [], iso: offset => new Date(Date.now() + offset * 3600000).toISOString() }
      if (name === './role-context') return { useRole: () => ({ role: userRole }) }
      if (name === './user-directory') return { useUserDirectory: () => ({ currentUser: { id: 'usr-test', status: 'active', roles: [userRole], clinicIds: ['pana-medica'], telephonyExtension: '101' }, users: [{ id: 'usr-test', status: 'active', roles: ['operator'], clinicIds: ['pana-medica'] }] }) }
      if (name === './panel-context') return { useCasePanel: () => ({ openCase: id => opened.push(id) }) }
      if (name === './authorization-context') return { useAuthorization: () => ({ hasPermission: permission => load('lib/crm/permissions.ts').ROLE_PERMISSIONS[userRole].includes(permission) }) }
      let resolved = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name)
      return load(fs.existsSync(resolved + '.tsx') ? resolved + '.tsx' : resolved + '.ts')
    }
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
    vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, Date, Set, Map, console, AbortController, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} }, { filename: file })
    return module.exports
  }
  const store = load('lib/crm/entity-store.tsx')
  api = { load, opened, callRender() { host.cursor = 60; const calls = load('lib/crm/call-context.tsx'); calls.CallProvider({ children: null }); api.call = calls.useCall(); return api }, render() { host.cursor = 0; store.EntityStoreProvider({ children: null }); api.store = store.useEntityStore(); return api },
    scoped(role) { host.cursor = 30; userRole = role; return load('lib/crm/scoped-entity-store.ts').useScopedEntityStore() } }
  return api.render()
}

module.exports = { harness, patients, identities }
