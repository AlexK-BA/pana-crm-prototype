import type { ClinicId } from "./entities"
import type { RoleId } from "./roles"
import { BRAND_CONFIG } from "./brand-config"

export type AppUserStatus = "invited" | "active" | "inactive" | "locked"

export interface AppUser {
  id: string
  name: string
  email: string
  initials: string
  color: string
  telephonyExtension?: string
  roles: RoleId[]
  clinicIds: ClinicId[]
  status: AppUserStatus
  createdAt: string
  lastLoginAt?: string
  deactivatedAt?: string
  passwordResetRequestedAt?: string
  sessionsRevokedAt?: string
}

/**
 * Canonical prototype user seed. Runtime user management clones this catalog
 * into UserDirectory state; selectors and demo data reference the same IDs.
 * Production replaces it with the identity service/user API.
 */
export const INITIAL_USERS: AppUser[] = [
  { id: "usr-ws", name: "Weronika Sadowska", email: `weronika@${BRAND_CONFIG.contactDomain}`, initials: "WS", color: "bg-emerald-500", telephonyExtension: "101", roles: ["operator"], clinicIds: ["pana-medica"], status: "active", createdAt: "2026-01-15T09:00:00Z", lastLoginAt: "2026-10-01T11:40:00Z" },
  { id: "usr-im", name: "Ilona Marchenko", email: `ilona@${BRAND_CONFIG.contactDomain}`, initials: "IM", color: "bg-amber-500", telephonyExtension: "102", roles: ["patient_care"], clinicIds: ["pana-medica", "pana-comfort"], status: "active", createdAt: "2026-01-15T09:00:00Z", lastLoginAt: "2026-10-01T10:55:00Z" },
  { id: "usr-dw", name: "Daniel Wozniak", email: `daniel@${BRAND_CONFIG.contactDomain}`, initials: "DW", color: "bg-sky-500", telephonyExtension: "104", roles: ["team_leader"], clinicIds: ["pana-medica", "pana-comfort", "pana-international"], status: "active", createdAt: "2026-01-10T09:00:00Z", lastLoginAt: "2026-10-01T12:04:00Z" },
  { id: "usr-pr", name: "Pavel Rusetski", email: `pavel@${BRAND_CONFIG.contactDomain}`, initials: "PR", color: "bg-violet-500", telephonyExtension: "103", roles: ["clinic_manager"], clinicIds: ["pana-medica", "pana-comfort"], status: "active", createdAt: "2026-01-10T09:00:00Z" },
  { id: "usr-am", name: "Aleh Miranovich", email: `aleh@${BRAND_CONFIG.contactDomain}`, initials: "AM", color: "bg-rose-500", roles: ["marketing"], clinicIds: [], status: "active", createdAt: "2026-03-01T09:00:00Z", lastLoginAt: "2026-09-30T14:20:00Z" },
  { id: "usr-mk", name: "Marta Kowalik", email: `marta@${BRAND_CONFIG.contactDomain}`, initials: "MK", color: "bg-slate-500", roles: ["admin"], clinicIds: ["pana-medica", "pana-comfort", "pana-international"], status: "active", createdAt: "2025-12-01T09:00:00Z", lastLoginAt: "2026-10-01T12:10:00Z" },
]

export function getCatalogUser(id?: string) {
  return id ? INITIAL_USERS.find((user) => user.id === id) : undefined
}

export function getCatalogUserByRole(role: RoleId) {
  return INITIAL_USERS.find((user) => user.roles.includes(role)) ?? INITIAL_USERS[0]
}

export function getCatalogUserByName(name: string) {
  return INITIAL_USERS.find((user) => user.name === name)
}
