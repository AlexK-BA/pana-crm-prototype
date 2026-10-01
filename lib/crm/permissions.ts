import type { RoleId } from "./roles"

export type Permission =
  | "case:view"
  | "case:edit"
  | "case:move"
  | "task:view"
  | "task:work"
  | "task:assign"
  | "patient:view_basic"
  | "patient:view_medical"
  | "patient:edit_local"
  | "communication:view"
  | "communication:send"
  | "call:handle"
  | "report:view_operational"
  | "report:view_marketing"
  | "audit:view"
  | "configuration:manage"
  | "users:manage"

const ALL: Permission[] = [
  "case:view", "case:edit", "case:move", "task:view", "task:work", "task:assign",
  "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view",
  "communication:send", "call:handle", "report:view_operational", "report:view_marketing",
  "audit:view", "configuration:manage", "users:manage",
]

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  operator: ["case:view", "case:edit", "case:move", "task:view", "task:work", "patient:view_basic", "patient:edit_local", "communication:view", "communication:send", "call:handle"],
  patient_care: ["case:view", "case:edit", "case:move", "task:view", "task:work", "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view", "communication:send", "call:handle"],
  team_leader: ["case:view", "case:edit", "case:move", "task:view", "task:work", "task:assign", "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view", "communication:send", "call:handle", "report:view_operational", "audit:view"],
  clinic_manager: ["case:view", "case:edit", "case:move", "task:view", "task:work", "task:assign", "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view", "communication:send", "call:handle", "report:view_operational"],
  marketing: ["report:view_marketing"],
  admin: ALL,
}

export const ROUTE_PERMISSION: Array<{ prefix: string; permission?: Permission; roles?: RoleId[] }> = [
  { prefix: "/users", permission: "users:manage" },
  { prefix: "/settings", permission: "configuration:manage" },
  { prefix: "/audit", permission: "audit:view" },
  { prefix: "/docs", roles: ["team_leader", "admin"] },
  { prefix: "/inbox", permission: "communication:view" },
  { prefix: "/records", permission: "case:view" },
  { prefix: "/board", roles: ["operator", "patient_care", "team_leader", "clinic_manager", "admin"] },
  { prefix: "/schedule", permission: "task:view" },
  { prefix: "/calendar", permission: "task:view" },
  { prefix: "/waitlist", permission: "case:view" },
  { prefix: "/patients", permission: "patient:view_basic" },
]

export function hasPermission(role: RoleId, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function canAccessRoute(role: RoleId, pathname: string) {
  if (pathname === "/") return true
  const rule = ROUTE_PERMISSION.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))
  if (!rule) return true
  if (rule.roles) return rule.roles.includes(role)
  return rule.permission ? hasPermission(role, rule.permission) : true
}
