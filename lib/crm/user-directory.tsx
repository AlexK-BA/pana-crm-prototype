"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { ClinicId } from "./entities"
import type { RoleId } from "./roles"
import { useEntityStore } from "./entity-store"

export type AppUserStatus = "invited" | "active" | "inactive" | "locked"

export interface AppUser {
  id: string
  name: string
  email: string
  roles: RoleId[]
  clinicIds: ClinicId[]
  status: AppUserStatus
  createdAt: string
  lastLoginAt?: string
  deactivatedAt?: string
  passwordResetRequestedAt?: string
  sessionsRevokedAt?: string
}

const USERS: AppUser[] = [
  { id: "usr-ws", name: "Weronika Sadowska", email: "weronika@pa-na.pl", roles: ["operator"], clinicIds: ["pana-medica"], status: "active", createdAt: "2026-01-15T09:00:00Z", lastLoginAt: "2026-10-01T11:40:00Z" },
  { id: "usr-im", name: "Ilona Marchenko", email: "ilona@pa-na.pl", roles: ["patient_care"], clinicIds: ["pana-medica", "pana-comfort"], status: "active", createdAt: "2026-01-15T09:00:00Z", lastLoginAt: "2026-10-01T10:55:00Z" },
  { id: "usr-dw", name: "Daniel Wozniak", email: "daniel@pa-na.pl", roles: ["team_leader"], clinicIds: ["pana-medica", "pana-comfort", "pana-international"], status: "active", createdAt: "2026-01-10T09:00:00Z", lastLoginAt: "2026-10-01T12:04:00Z" },
  { id: "usr-pr", name: "Pavel Rusetski", email: "pavel@pa-na.pl", roles: ["clinic_manager"], clinicIds: ["pana-medica", "pana-comfort"], status: "active", createdAt: "2026-01-10T09:00:00Z" },
  { id: "usr-am", name: "Aleh Miranovich", email: "aleh@pa-na.pl", roles: ["marketing"], clinicIds: [], status: "active", createdAt: "2026-03-01T09:00:00Z", lastLoginAt: "2026-09-30T14:20:00Z" },
  { id: "usr-mk", name: "Marta Kowalik", email: "marta@pa-na.pl", roles: ["admin"], clinicIds: ["pana-medica", "pana-comfort", "pana-international"], status: "active", createdAt: "2025-12-01T09:00:00Z", lastLoginAt: "2026-10-01T12:10:00Z" },
]

interface UserDirectoryValue {
  users: AppUser[]
  createUser: (input: Omit<AppUser, "id" | "status" | "createdAt">) => void
  setActive: (userId: string, active: boolean) => void
  requestPasswordReset: (userId: string) => void
  revokeSessions: (userId: string) => void
  updateAccess: (userId: string, roles: RoleId[], clinicIds: ClinicId[]) => void
}

const UserDirectoryContext = createContext<UserDirectoryValue | null>(null)
let userSeq = 0

export function UserDirectoryProvider({ children }: { children: ReactNode }) {
  const { recordAudit } = useEntityStore()
  const [users, setUsers] = useState(USERS)
  const patch = (id: string, data: Partial<AppUser>) => setUsers((prev) => prev.map((user) => user.id === id ? { ...user, ...data } : user))
  const value = useMemo<UserDirectoryValue>(() => ({
    users,
    createUser: (input) => {
      userSeq += 1
      setUsers((prev) => [...prev, { ...input, id: `usr-live-${userSeq}`, status: "invited", createdAt: new Date().toISOString() }])
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
  }), [recordAudit, users])
  return <UserDirectoryContext.Provider value={value}>{children}</UserDirectoryContext.Provider>
}

export function useUserDirectory() {
  const value = useContext(UserDirectoryContext)
  if (!value) throw new Error("useUserDirectory must be used within UserDirectoryProvider")
  return value
}
