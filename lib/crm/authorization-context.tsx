"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { ROLE_PROFILES, type RoleId } from "./roles"
import { ROLE_PERMISSIONS, ROUTE_PERMISSION, type Permission } from "./permissions"
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

  const roleHasPermission = useCallback((targetRole: RoleId, permission: Permission) => rolePermissions[targetRole].includes(permission), [rolePermissions])
  const hasPermission = useCallback((permission: Permission) => roleHasPermission(role, permission), [role, roleHasPermission])
  const canAccessRoute = useCallback((pathname: string) => {
    if (pathname === "/") return true
    const rule = ROUTE_PERMISSION.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))
    if (!rule) return true
    if (rule.roles) return rule.roles.includes(role)
    return rule.permission ? roleHasPermission(role, rule.permission) : true
  }, [role, roleHasPermission])

  const toggleRolePermission = useCallback((targetRole: RoleId, permission: Permission) => {
    if (targetRole === "admin") return
    setRolePermissions((prev) => {
      const enabled = prev[targetRole].includes(permission)
      return { ...prev, [targetRole]: enabled ? prev[targetRole].filter((item) => item !== permission) : [...prev[targetRole], permission] }
    })
    recordAudit({ type: "assignment_change", actorId: ROLE_PROFILES[role].user.id, summary: `Zmieniono uprawnienie ${permission} dla roli ${targetRole}` })
  }, [recordAudit, role])

  const resetRolePermissions = useCallback((targetRole: RoleId) => {
    if (targetRole === "admin") return
    setRolePermissions((prev) => ({ ...prev, [targetRole]: [...ROLE_PERMISSIONS[targetRole]] }))
    recordAudit({ type: "assignment_change", actorId: ROLE_PROFILES[role].user.id, summary: `Przywrócono domyślne uprawnienia roli ${targetRole}` })
  }, [recordAudit, role])

  const value = useMemo(() => ({ rolePermissions, hasPermission, roleHasPermission, canAccessRoute, toggleRolePermission, resetRolePermissions }), [canAccessRoute, hasPermission, resetRolePermissions, roleHasPermission, rolePermissions, toggleRolePermission])
  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>
}

export function useAuthorization() {
  const value = useContext(AuthorizationContext)
  if (!value) throw new Error("useAuthorization must be used within AuthorizationProvider")
  return value
}
