"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { ClinicId } from "./entities"
import type { RoleId } from "./roles"
import { ROLE_PROFILES } from "./roles"
import { useRole } from "./role-context"
import { useEntityStore } from "./entity-store"
import { INITIAL_USERS, type AppUser } from "./user-catalog"

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
  const [users, setUsers] = useState(INITIAL_USERS)
  const currentUser = users.find((user) => user.id === ROLE_PROFILES[role].user.id) ?? INITIAL_USERS[0]
  const patch = (id: string, data: Partial<AppUser>) => setUsers((prev) => prev.map((user) => user.id === id ? { ...user, ...data } : user))
  const value = useMemo<UserDirectoryValue>(() => ({
    users,
    currentUser,
    createUser: (input) => {
      userSeq += 1
      setUsers((prev) => [...prev, { ...input, initials: input.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: "bg-slate-500", id: `usr-live-${userSeq}`, status: "invited", createdAt: new Date().toISOString() }])
      recordAudit({ type: "assignment_change", actorId: "usr-mk", summary: `Zaproszono użytkownika ${input.email} · rola: ${input.roles.join(", ")}` })
    },
    setActive: (id, active) => {
      if (id === "usr-mk" && !active) return
      patch(id, { status: active ? "active" : "inactive", deactivatedAt: active ? undefined : new Date().toISOString(), sessionsRevokedAt: active ? undefined : new Date().toISOString() })
      recordAudit({ type: "assignment_change", actorId: "usr-mk", summary: `${active ? "Aktywowano" : "Dezaktywowano"} konto użytkownika ${users.find((user) => user.id === id)?.email ?? id}` })
    },
    requestPasswordReset: (id) => {
      patch(id, { passwordResetRequestedAt: new Date().toISOString() })
      recordAudit({ type: "assignment_change", actorId: "usr-mk", summary: `Zainicjowano reset hasła użytkownika ${users.find((user) => user.id === id)?.email ?? id}` })
    },
    revokeSessions: (id) => {
      patch(id, { sessionsRevokedAt: new Date().toISOString() })
      recordAudit({ type: "assignment_change", actorId: "usr-mk", summary: `Zakończono aktywne sesje użytkownika ${users.find((user) => user.id === id)?.email ?? id}` })
    },
    updateAccess: (id, roles, clinicIds) => {
      patch(id, { roles, clinicIds })
      recordAudit({ type: "assignment_change", actorId: "usr-mk", summary: `Zmieniono role lub zakres klinik użytkownika ${users.find((user) => user.id === id)?.email ?? id}` })
    },
  }), [currentUser, recordAudit, users])
  return <UserDirectoryContext.Provider value={value}>{children}</UserDirectoryContext.Provider>
}

export function useUserDirectory() {
  const value = useContext(UserDirectoryContext)
  if (!value) throw new Error("useUserDirectory must be used within UserDirectoryProvider")
  return value
}
