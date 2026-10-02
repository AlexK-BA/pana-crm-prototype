"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { ROLE_ORDER, ROLE_PROFILES, type RoleId } from "./roles"
import { AccessCommandError, ALL_PERMISSIONS, ROLE_PERMISSIONS, ROUTE_PERMISSION, type Permission } from "./permissions"
import { useRole } from "./role-context"
import { useEntityStore } from "./entity-store"

type RolePermissionMap = Record<RoleId, Permission[]>

interface AuthorizationValue {
  rolePermissions: RolePermissionMap
  hasPermission: (permission: Permission) => boolean
  roleHasPermission: (role: RoleId, permission: Permission) => boolean
  canAccessRoute: (pathname: string) => boolean
  toggleRolePermission: (role: RoleId, permission: Permission) => void
  resetRolePermissions: (role: RoleId) => void
}

const AuthorizationContext = createContext<AuthorizationValue | null>(null)

function cloneDefaults(): RolePermissionMap {
  return Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [role, [...permissions]])) as RolePermissionMap
}

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const { role } = useRole()
  const { recordAudit } = useEntityStore()
  const [rolePermissions, setRolePermissions] = useState<RolePermissionMap>(cloneDefaults)

  const commandSnapshot = useRef({ role, rolePermissions })
  commandSnapshot.current = { role, rolePermissions }
  const roleHasPermission = useCallback((targetRole: RoleId, permission: Permission) =>
    (targetRole === "admin" ? ALL_PERMISSIONS : commandSnapshot.current.rolePermissions[targetRole] ?? []).includes(permission), [rolePermissions])
  const hasPermission = useCallback((permission: Permission) => roleHasPermission(role, permission), [role, roleHasPermission])
  const canAccessRoute = useCallback((pathname: string) => {
    if (pathname === "/") return true
    const rule = ROUTE_PERMISSION.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))
    if (!rule) return true
    if (rule.roles) return rule.roles.includes(role)
    return rule.permission ? roleHasPermission(role, rule.permission) : true
  }, [role, roleHasPermission])

  const requireConfiguration = () => {
    const { role: actorRole, rolePermissions: current } = commandSnapshot.current
    if (!(actorRole === "admin" ? ALL_PERMISSIONS : current[actorRole]).includes("configuration:manage")) {
      throw new AccessCommandError("Brak uprawnienia configuration:manage do zmiany macierzy ról.")
    }
    return ROLE_PROFILES[actorRole].user.id
  }
  const validateTargetRole = (targetRole: RoleId) => {
    if (!ROLE_ORDER.includes(targetRole)) throw new AccessCommandError("Nieznana rola.")
    if (targetRole === "admin") throw new AccessCommandError("Systemowa rola admin jest chroniona i zachowuje pełne uprawnienia.")
  }
  const toggleRolePermission = useCallback((targetRole: RoleId, permission: Permission) => {
    const actorId = requireConfiguration()
    validateTargetRole(targetRole)
    if (!ALL_PERMISSIONS.includes(permission)) throw new AccessCommandError("Nieznane uprawnienie.")
    const previous = commandSnapshot.current.rolePermissions
    const before = previous[targetRole]
    const after = before.includes(permission) ? before.filter((item) => item !== permission) : [...before, permission]
    const next = { ...previous, [targetRole]: after }
    commandSnapshot.current.rolePermissions = next
    setRolePermissions(next)
    recordAudit({ type: "role_permissions_changed", actorId, targetRole, correlationId: `role:${targetRole}`,
      before: before.join(", "), after: after.join(", "), summary: `Zmieniono uprawnienie ${permission} dla roli ${targetRole}` })
  }, [recordAudit])

  const resetRolePermissions = useCallback((targetRole: RoleId) => {
    const actorId = requireConfiguration()
    validateTargetRole(targetRole)
    const previous = commandSnapshot.current.rolePermissions
    const after = [...ROLE_PERMISSIONS[targetRole]]
    const next = { ...previous, [targetRole]: after }
    commandSnapshot.current.rolePermissions = next
    setRolePermissions(next)
    recordAudit({ type: "role_permissions_reset", actorId, targetRole, correlationId: `role:${targetRole}`,
      before: previous[targetRole].join(", "), after: after.join(", "), summary: `Przywrócono domyślne uprawnienia roli ${targetRole}` })
  }, [recordAudit])

  const value = useMemo(() => ({ rolePermissions, hasPermission, roleHasPermission, canAccessRoute, toggleRolePermission, resetRolePermissions }), [canAccessRoute, hasPermission, resetRolePermissions, roleHasPermission, rolePermissions, toggleRolePermission])
  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>
}

export function useAuthorization() {
  const value = useContext(AuthorizationContext)
  if (!value) throw new Error("useAuthorization must be used within AuthorizationProvider")
  return value
}
