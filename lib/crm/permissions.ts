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
  | "sms:send_custom"
  | "sms:send_template"
  | "sms:retry"
  | "sms:match_patient"
  | "sms:template_manage"
  | "sms:provider_manage"
  | "call:handle"
  | "call:recording_view"
  | "report:view_operational"
  | "report:view_marketing"
  | "audit:view"
  | "configuration:manage"
  | "users:manage"

export interface PermissionDefinition {
  id: Permission
  group: string
  label: string
  description: string
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { id: "case:view", group: "Sprawy", label: "Podgląd spraw", description: "Otwieranie spraw w dozwolonym zakresie danych." },
  { id: "case:edit", group: "Sprawy", label: "Edycja spraw", description: "Zmiana danych operacyjnych sprawy." },
  { id: "case:move", group: "Sprawy", label: "Zmiana etapu", description: "Przenoszenie spraw między etapami workflow." },
  { id: "task:view", group: "Zadania", label: "Podgląd zadań", description: "Lista, kalendarz i szczegóły zadań." },
  { id: "task:work", group: "Zadania", label: "Realizacja zadań", description: "Rozpoczęcie, wynik i przełożenie zadania." },
  { id: "task:assign", group: "Zadania", label: "Przypisywanie zadań", description: "Zmiana właściciela i priorytetu." },
  { id: "patient:view_basic", group: "Pacjent", label: "Dane podstawowe", description: "Kontakt i podstawowy profil pacjenta." },
  { id: "patient:view_medical", group: "Pacjent", label: "Dane medyczne", description: "Plan leczenia i dane kliniczne." },
  { id: "patient:edit_local", group: "Pacjent", label: "Edycja lokalna", description: "Uzupełnianie danych niezarządzanych przez Medical CRM." },
  { id: "communication:view", group: "Komunikacja", label: "Podgląd komunikacji", description: "Inbox i historia rozmów." },
  { id: "communication:send", group: "Komunikacja", label: "Wysyłanie wiadomości", description: "Chat, e-mail i kanały społecznościowe." },
  { id: "sms:send_custom", group: "SMS", label: "Dowolny tekst SMS", description: "Wysyłanie ręcznie wpisanego tekstu." },
  { id: "sms:send_template", group: "SMS", label: "Szablony SMS", description: "Wysyłanie zatwierdzonych szablonów." },
  { id: "sms:retry", group: "SMS", label: "Ponów SMS", description: "Ponowna próba nieudanego SMS." },
  { id: "sms:match_patient", group: "SMS", label: "Powiąż przychodzący SMS", description: "Ręczne wskazanie pacjenta." },
  { id: "sms:template_manage", group: "SMS", label: "Zarządzaj szablonami", description: "Tworzenie i dezaktywacja szablonów." },
  { id: "sms:provider_manage", group: "SMS", label: "Konfiguracja dostawcy", description: "Dostawcy, nadawcy i test połączenia." },
  { id: "call:handle", group: "Telefonia", label: "Obsługa połączeń", description: "Odbieranie i inicjowanie połączeń." },
  { id: "call:recording_view", group: "Telefonia", label: "Nagrania rozmów", description: "Odsłuchiwanie nagrań w swoim zakresie." },
  { id: "report:view_operational", group: "Raporty", label: "Raporty operacyjne", description: "Wyniki zespołu i SLA." },
  { id: "report:view_marketing", group: "Raporty", label: "Raporty marketingowe", description: "Źródła i konwersja kampanii." },
  { id: "audit:view", group: "Administracja", label: "Historia zmian", description: "Aktywność i centralny Audit Log." },
  { id: "configuration:manage", group: "Administracja", label: "Konfiguracja", description: "Workflow, kliniki i ustawienia aplikacji." },
  { id: "users:manage", group: "Administracja", label: "Użytkownicy i role", description: "Konta, dostęp i macierz uprawnień." },
]

export const ALL_PERMISSIONS: Permission[] = PERMISSION_DEFINITIONS.map((item) => item.id)

const ALL: Permission[] = [
  "case:view", "case:edit", "case:move", "task:view", "task:work", "task:assign",
  "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view",
  "communication:send", "sms:send_custom", "sms:send_template", "sms:retry", "sms:match_patient", "sms:template_manage", "sms:provider_manage", "call:handle", "call:recording_view", "report:view_operational", "report:view_marketing",
  "audit:view", "configuration:manage", "users:manage",
]

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  operator: ["case:view", "case:edit", "case:move", "task:view", "task:work", "patient:view_basic", "patient:edit_local", "communication:view", "communication:send", "sms:send_custom", "sms:send_template", "sms:retry", "call:handle"],
  patient_care: ["case:view", "case:edit", "case:move", "task:view", "task:work", "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view", "communication:send", "sms:send_custom", "sms:send_template", "sms:retry", "call:handle"],
  team_leader: ["case:view", "case:edit", "case:move", "task:view", "task:work", "task:assign", "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view", "communication:send", "sms:send_custom", "sms:send_template", "sms:retry", "sms:match_patient", "call:handle", "call:recording_view", "report:view_operational", "audit:view"],
  clinic_manager: ["case:view", "case:edit", "case:move", "task:view", "task:work", "task:assign", "patient:view_basic", "patient:view_medical", "patient:edit_local", "communication:view", "communication:send", "sms:send_custom", "sms:send_template", "sms:retry", "call:handle", "call:recording_view", "report:view_operational"],
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
