"use client"

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { ClinicId } from "./entities"
import type { RoleId } from "./roles"
import { ROLE_ORDER, ROLE_PROFILES } from "./roles"
import { useRole } from "./role-context"
import { useEntityStore } from "./entity-store"
import { INITIAL_USERS, type AppUser } from "./user-catalog"
import { useAuthorization } from "./authorization-context"
import { AccessCommandError } from "./permissions"
import { CLINICS } from "./catalog"

export type { AppUser, AppUserStatus } from "./user-catalog"

interface UserDirectoryValue {
  users: AppUser[]
  currentUser: AppUser
  createUser: (input: Omit<AppUser, "id" | "status" | "createdAt" | "initials" | "color" | "telephonyExtension">) => void
  setActive: (userId: string, active: boolean) => void
  requestPasswordReset: (userId: string) => void
  revokeSessions: (userId: string) => void
  updateAccess: (userId: string, roles: RoleId[], clinicIds: ClinicId[]) => void
}

const UserDirectoryContext = createContext<UserDirectoryValue | null>(null)
let userSeq = 0

export function UserDirectoryProvider({ children }: { children: ReactNode }) {
  const { recordAudit } = useEntityStore()
  const { role } = useRole()
  const { hasPermission } = useAuthorization()
  const [users, setUsers] = useState(INITIAL_USERS)
  const currentUser = users.find((user) => user.id === ROLE_PROFILES[role].user.id) ?? INITIAL_USERS[0]
  // Same array as React state, used only to serialize commands before React's next render.
  // No second directory, model or independent source of users is introduced.
  const commandSnapshot = useRef({ users, currentUser, hasPermission, role })
  commandSnapshot.current = { users, currentUser, hasPermission, role }
  const value = useMemo<UserDirectoryValue>(() => {
    const requireManage = () => {
      const snapshot = commandSnapshot.current
      const actor = snapshot.users.find((user) => user.id === snapshot.currentUser.id)
      if (!snapshot.hasPermission("users:manage") || actor?.status !== "active" || !actor.roles.includes(snapshot.role)) {
        throw new AccessCommandError("Brak uprawnienia users:manage do zarządzania użytkownikami.")
      }
      return actor
    }
    const target = (id: string) => {
      const user = commandSnapshot.current.users.find((item) => item.id === id)
      if (!user) throw new AccessCommandError("Nie znaleziono użytkownika.")
      return user
    }
    const commitUsers = (next: AppUser[]) => {
      commandSnapshot.current.users = next
      setUsers(next)
    }
    const patch = (id: string, data: Partial<AppUser>) => commitUsers(commandSnapshot.current.users.map((user) => user.id === id ? { ...user, ...data } : user))
    const validateAccess = (roles: RoleId[], clinicIds: ClinicId[]) => {
      if (!Array.isArray(roles) || !roles.length) throw new AccessCommandError("Wybierz co najmniej jedną rolę.")
      if (roles.some((item) => !ROLE_ORDER.includes(item))) throw new AccessCommandError("Nieznana rola użytkownika.")
      if (!Array.isArray(clinicIds) || clinicIds.some((id) => !CLINICS.some((clinic) => clinic.id === id))) {
        throw new AccessCommandError("Nieznana klinika.")
      }
      if (roles.some((item) => ["operator", "patient_care", "clinic_manager"].includes(item)) && !clinicIds.length) {
        throw new AccessCommandError("Dla roli klinicznej wybierz co najmniej jedną klinikę.")
      }
    }
    const accessSummary = (user: Pick<AppUser, "roles" | "clinicIds">) => JSON.stringify({ roles: user.roles, clinicIds: user.clinicIds })
    return {
      users, currentUser,
      createUser: (input) => {
        const actor = requireManage()
        const name = typeof input.name === "string" ? input.name.trim() : ""
        const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
        if (!name) throw new AccessCommandError("Podaj imię i nazwisko.")
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessCommandError("Podaj poprawny adres e-mail.")
        if (commandSnapshot.current.users.some((user) => user.email.trim().toLowerCase() === email)) {
          throw new AccessCommandError("Użytkownik z tym adresem e-mail już istnieje.")
        }
        validateAccess(input.roles, input.clinicIds)
        const user: AppUser = { name, email, roles: [...new Set(input.roles)], clinicIds: [...new Set(input.clinicIds)],
          initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: "bg-slate-500",
          id: `usr-live-${++userSeq}`, status: "invited", createdAt: new Date().toISOString() }
        commitUsers([...commandSnapshot.current.users, user])
        recordAudit({ type: "user_invited", actorId: actor.id, targetUserId: user.id, correlationId: user.id,
          after: accessSummary(user), summary: `Zaproszono użytkownika ${user.name} (demo)` })
      },
      setActive: (id, active) => {
        const actor = requireManage()
        const user = target(id)
        if (id === actor.id && !active) throw new AccessCommandError("Nie możesz dezaktywować własnego konta.")
        validateAccess(user.roles, user.clinicIds)
        if (user.status === (active ? "active" : "inactive")) return
        const now = new Date().toISOString()
        patch(id, active ? { status: "active", deactivatedAt: undefined }
          : { status: "inactive", deactivatedAt: now, sessionsRevokedAt: now })
        recordAudit({ type: active ? "user_activated" : "user_deactivated", actorId: actor.id, targetUserId: id,
          correlationId: id, before: user.status, after: active ? "active" : "inactive",
          summary: `${active ? "Aktywowano" : "Dezaktywowano i odwołano sesje"} konto ${user.name} (demo)` })
      },
      requestPasswordReset: (id) => {
        const actor = requireManage()
        const user = target(id)
        const now = new Date().toISOString()
        patch(id, { passwordResetRequestedAt: now })
        recordAudit({ type: "user_password_reset_requested", actorId: actor.id, targetUserId: id, correlationId: id,
          before: user.passwordResetRequestedAt, after: now, summary: `Zarejestrowano prośbę o reset hasła dla ${user.name} (demo, bez wysyłki)` })
      },
      revokeSessions: (id) => {
        const actor = requireManage()
        const user = target(id)
        const now = new Date().toISOString()
        patch(id, { sessionsRevokedAt: now })
        recordAudit({ type: "user_sessions_revoked", actorId: actor.id, targetUserId: id, correlationId: id,
          before: user.sessionsRevokedAt, after: now, summary: `Zarejestrowano odwołanie sesji użytkownika ${user.name} (demo)` })
      },
      updateAccess: (id, roles, clinicIds) => {
        const actor = requireManage()
        const user = target(id)
        if (id === actor.id) throw new AccessCommandError("Nie możesz zmieniać własnych ról ani zakresu klinik.")
        validateAccess(roles, clinicIds)
        const next = { roles: [...new Set(roles)], clinicIds: [...new Set(clinicIds)] }
        if (accessSummary(user) === accessSummary(next)) return
        patch(id, next)
        recordAudit({ type: "user_access_changed", actorId: actor.id, targetUserId: id, correlationId: id,
          before: accessSummary(user), after: accessSummary(next), summary: `Zmieniono role lub zakres klinik użytkownika ${user.name}` })
      },
    }
  }, [currentUser, hasPermission, recordAudit, role, users])
  return <UserDirectoryContext.Provider value={value}>{children}</UserDirectoryContext.Provider>
}

export function useUserDirectory() {
  const value = useContext(UserDirectoryContext)
  if (!value) throw new Error("useUserDirectory must be used within UserDirectoryProvider")
  return value
}
