"use client"

/**
 * Full Audit Log — §2.7 / §18. Reads the live, shared auditEvents stream from
 * EntityStore so every status/assignment/priority/task change, merge, link,
 * and sync conflict recorded anywhere in the app (kanban drag, call wrap-up,
 * drawer actions) shows up here immediately, in one searchable place.
 */

import { useLanguage, type Language } from "@/lib/crm/language-context"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  GitMerge,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  UserCog,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useUserDirectory, type AppUser } from "@/lib/crm/user-directory"
import { useAuthorization } from "@/lib/crm/authorization-context"
import type { AuditEvent, AuditEventType } from "@/lib/crm/entities"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { localizeAuditSummary } from "@/lib/crm/audit-summary"
import { cn } from "@/lib/utils"

const TYPE_META: Record<AuditEventType, { icon: typeof ShieldCheck; className: string }> = {
  case_created: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  comment_added: { icon: UserCog, className: "bg-slate-100 text-slate-700" },
  patient_local_updated: { icon: UserCog, className: "bg-teal-100 text-teal-700" },
  patient_match_searched: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_suggested: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_auto_linked: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_approved: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_rejected: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_conflict: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  contact_identity_linked: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  contact_identity_reused: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  user_invited: { icon: UserCog, className: "bg-amber-100 text-amber-700" },
  user_activated: { icon: UserCog, className: "bg-emerald-100 text-emerald-700" },
  user_deactivated: { icon: UserCog, className: "bg-red-100 text-red-700" },
  user_password_reset_requested: { icon: UserCog, className: "bg-amber-100 text-amber-700" },
  user_sessions_revoked: { icon: UserCog, className: "bg-amber-100 text-amber-700" },
  user_access_changed: { icon: UserCog, className: "bg-amber-100 text-amber-700" },
  role_permissions_changed: { icon: UserCog, className: "bg-amber-100 text-amber-700" },
  role_permissions_reset: { icon: UserCog, className: "bg-amber-100 text-amber-700" },
  access_denied: { icon: ShieldCheck, className: "bg-red-100 text-red-700" },
  conversation_handoff: { icon: UserCog, className: "bg-violet-100 text-violet-700" },
  ai_control_changed: { icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },
  ai_policy_changed: { icon: SlidersHorizontal, className: "bg-violet-100 text-violet-700" },
  ai_activation_scheduled: { icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },
  ai_activation_cancelled: { icon: ShieldCheck, className: "bg-amber-100 text-amber-700" },
  ai_activation_started: { icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },
  ai_response_recorded: { icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },

  sms_send: { icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  sms_failed: { icon: ShieldCheck, className: "bg-red-100 text-red-700" },
  sms_retry: { icon: ShieldCheck, className: "bg-amber-100 text-amber-700" },
  sms_provider_change: { icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  sms_provider_test: { icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  sms_provider_config: { icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  status_change: { icon: ArrowRight, className: "bg-sky-100 text-sky-700" },
  assignment_change: { icon: UserCog, className: "bg-violet-100 text-violet-700" },
  task_change: { icon: ListChecks, className: "bg-emerald-100 text-emerald-700" },
  priority_change: { icon: SlidersHorizontal, className: "bg-amber-100 text-amber-700" },
  merge: { icon: GitMerge, className: "bg-fuchsia-100 text-fuchsia-700" },
  link: { icon: Link2, className: "bg-teal-100 text-teal-700" },
  unlink: { icon: Unlink, className: "bg-slate-200 text-slate-700" },
  sync: { icon: RefreshCw, className: "bg-red-100 text-red-700" },
}

const TYPE_LABELS: Record<AuditEventType, Record<Language, string>> = {
  case_created: { en: "Case created", pl: "Utworzenie sprawy", ru: "Создание кейса", es: "Creación del caso" },
  comment_added: { en: "Staff comment", pl: "Komentarz pracownika", ru: "Комментарий сотрудника", es: "Comentario del personal" },
  patient_local_updated: { en: "Local patient data", pl: "Lokalne dane pacjenta", ru: "Локальные данные пациента", es: "Datos locales del paciente" },
  patient_match_searched: { en: "Patient search", pl: "Wyszukanie pacjenta", ru: "Поиск пациента", es: "Búsqueda de paciente" },
  patient_match_suggested: { en: "Match suggestion", pl: "Propozycja dopasowania", ru: "Предложение совпадения", es: "Propuesta de coincidencia" },
  patient_auto_linked: { en: "Automatic patient link", pl: "Automatyczne powiązanie pacjenta", ru: "Автоматическая привязка пациента", es: "Vinculación automática del paciente" },
  patient_match_approved: { en: "Match approved", pl: "Zatwierdzenie dopasowania", ru: "Подтверждение совпадения", es: "Aprobación de la coincidencia" },
  patient_match_rejected: { en: "Match rejected", pl: "Odrzucenie dopasowania", ru: "Отклонение совпадения", es: "Rechazo de la coincidencia" },
  patient_match_conflict: { en: "Match conflict", pl: "Konflikt dopasowania", ru: "Конфликт совпадения", es: "Conflicto de coincidencia" },
  contact_identity_linked: { en: "Contact linked", pl: "Powiązanie kontaktu", ru: "Привязка контакта", es: "Vinculación del contacto" },
  contact_identity_reused: { en: "Existing contact reused", pl: "Użycie istniejącego kontaktu", ru: "Использован существующий контакт", es: "Uso de un contacto existente" },
  user_invited: { en: "User invited", pl: "Zaproszenie użytkownika", ru: "Приглашение пользователя", es: "Invitación de usuario" },
  user_activated: { en: "User activated", pl: "Aktywacja użytkownika", ru: "Активация пользователя", es: "Activación de usuario" },
  user_deactivated: { en: "User deactivated", pl: "Dezaktywacja użytkownika", ru: "Деактивация пользователя", es: "Desactivación de usuario" },
  user_password_reset_requested: { en: "Password reset requested", pl: "Prośba o reset hasła", ru: "Запрос сброса пароля", es: "Solicitud de restablecimiento de contraseña" },
  user_sessions_revoked: { en: "Sessions revoked", pl: "Odwołanie sesji", ru: "Отзыв сессий", es: "Revocación de sesiones" },
  user_access_changed: { en: "User access changed", pl: "Zmiana dostępu użytkownika", ru: "Изменение доступа пользователя", es: "Cambio de acceso del usuario" },
  role_permissions_changed: { en: "Role permissions changed", pl: "Zmiana uprawnień roli", ru: "Изменение прав роли", es: "Cambio de permisos del rol" },
  role_permissions_reset: { en: "Role permissions reset", pl: "Reset uprawnień roli", ru: "Сброс прав роли", es: "Restablecimiento de permisos del rol" },
  access_denied: { en: "Access denied", pl: "Odmowa dostępu", ru: "Отказ в доступе", es: "Acceso denegado" },
  conversation_handoff: { en: "Conversation handoff", pl: "Przekazanie rozmowy", ru: "Передача диалога", es: "Traspaso de la conversación" },
  ai_control_changed: { en: "AI control", pl: "Sterowanie AI", ru: "Управление AI", es: "Control de IA" },
  ai_policy_changed: { en: "AI policy", pl: "Polityka AI", ru: "Политика AI", es: "Política de IA" },
  ai_activation_scheduled: { en: "AI scheduled", pl: "Zaplanowanie AI", ru: "Запланирована активация AI", es: "Programación de IA" },
  ai_activation_cancelled: { en: "AI cancelled", pl: "Anulowanie AI", ru: "Отмена активации AI", es: "Cancelación de IA" },
  ai_activation_started: { en: "AI activated", pl: "Aktywacja AI", ru: "Активация AI", es: "Activación de IA" },
  ai_response_recorded: { en: "AI response", pl: "Odpowiedź AI", ru: "Ответ AI", es: "Respuesta de IA" },
  sms_send: { en: "SMS sent", pl: "Wysyłka SMS", ru: "Отправка SMS", es: "Envío de SMS" },
  sms_failed: { en: "SMS error", pl: "Błąd SMS", ru: "Ошибка SMS", es: "Error de SMS" },
  sms_retry: { en: "SMS retry", pl: "Ponowienie SMS", ru: "Повтор SMS", es: "Reintento de SMS" },
  sms_provider_change: { en: "SMS provider change", pl: "Zmiana dostawcy SMS", ru: "Смена SMS-провайдера", es: "Cambio de proveedor de SMS" },
  sms_provider_test: { en: "SMS provider test", pl: "Test dostawcy SMS", ru: "Тест SMS-провайдера", es: "Prueba del proveedor de SMS" },
  sms_provider_config: { en: "SMS configuration", pl: "Konfiguracja SMS", ru: "Настройка SMS", es: "Configuración de SMS" },
  status_change: { en: "Status change", pl: "Zmiana statusu", ru: "Смена статуса", es: "Cambio de estado" },
  assignment_change: { en: "Assignment change", pl: "Zmiana przypisania", ru: "Смена назначения", es: "Cambio de asignación" },
  task_change: { en: "Task change", pl: "Zmiana zadania", ru: "Изменение задачи", es: "Cambio de tarea" },
  priority_change: { en: "Priority change", pl: "Zmiana priorytetu", ru: "Смена приоритета", es: "Cambio de prioridad" },
  merge: { en: "Merge", pl: "Scalenie", ru: "Объединение", es: "Fusión" },
  link: { en: "Link", pl: "Powiązanie", ru: "Связывание", es: "Vinculación" },
  unlink: { en: "Unlink", pl: "Odłączenie", ru: "Отвязка", es: "Desvinculación" },
  sync: { en: "Synchronization", pl: "Synchronizacja", ru: "Синхронизация", es: "Sincronización" },
}

const TYPE_ORDER: AuditEventType[] = [
  "case_created", "comment_added", "patient_local_updated", "conversation_handoff", "ai_control_changed", "ai_policy_changed", "ai_activation_scheduled", "ai_activation_cancelled", "ai_activation_started", "ai_response_recorded",
  "patient_match_searched", "patient_match_suggested", "patient_auto_linked", "patient_match_approved", "patient_match_rejected", "patient_match_conflict", "contact_identity_linked", "contact_identity_reused",
  "user_invited", "user_activated", "user_deactivated", "user_password_reset_requested", "user_sessions_revoked", "user_access_changed", "role_permissions_changed", "role_permissions_reset", "access_denied",
  "sms_send", "sms_failed", "sms_retry", "sms_provider_change", "sms_provider_test", "sms_provider_config",
  "status_change",
  "assignment_change",
  "priority_change",
  "task_change",
  "merge",
  "link",
  "unlink",
  "sync",
]

function actorName(actorId: string, users: AppUser[]) {
  if (actorId === "system") return "System"
  return users.find((o) => o.id === actorId)?.name ?? actorId
}

function actorInitials(actorId: string, users: AppUser[]) {
  if (actorId === "system") return "SY"
  return users.find((o) => o.id === actorId)?.initials ?? actorId.slice(0, 2).toUpperCase()
}

function actorColor(actorId: string, users: AppUser[]) {
  if (actorId === "system") return "bg-slate-400"
  return users.find((o) => o.id === actorId)?.color ?? "bg-slate-400"
}

const ACTION_LABELS: Record<string, Record<Language, string>> = {
  task_edit: { en: "Task edited", pl: "Edycja zadania", ru: "Редактирование задачи", es: "Edición de la tarea" },
  task_reschedule: { en: "Task rescheduled", pl: "Zmiana terminu zadania", ru: "Перенос срока задачи", es: "Cambio de fecha de la tarea" },
  task_reassign: { en: "Task owner changed", pl: "Zmiana właściciela zadania", ru: "Смена владельца задачи", es: "Cambio de responsable de la tarea" },
  task_reprioritize: { en: "Task priority changed", pl: "Zmiana priorytetu zadania", ru: "Смена приоритета задачи", es: "Cambio de prioridad de la tarea" },
  task_replace: { en: "Task replaced", pl: "Zastąpienie zadania", ru: "Замена задачи", es: "Reemplazo de la tarea" },
  task_cancel: { en: "Task cancelled", pl: "Anulowanie zadania", ru: "Отмена задачи", es: "Cancelación de la tarea" },
  task_complete: { en: "Task completed", pl: "Zakończenie zadania", ru: "Завершение задачи", es: "Finalización de la tarea" },
  task_reopen: { en: "Task reopened", pl: "Ponowne otwarcie zadania", ru: "Повторное открытие задачи", es: "Reapertura de la tarea" },
  task_created: { en: "Task created", pl: "Utworzenie zadania", ru: "Создание задачи", es: "Creación de la tarea" },
  workflow_task_skipped: { en: "Workflow task skipped", pl: "Pominięcie zadania workflow", ru: "Пропуск задачи workflow", es: "Omisión de la tarea del workflow" },
}

function readableSummary(event: AuditEvent, language: Language) {
  const actionId = event.action
  const action = actionId ? ACTION_LABELS[actionId]?.[language] : undefined
  if (!actionId || !action || !event.summary.startsWith(actionId)) return localizeAuditSummary(event.summary, language)
  return `${action}${event.summary.slice(actionId.length)}`
}

function readableAuditValue(value: string | undefined, event: AuditEvent, users: AppUser[], language: Language, locale: string) {
  const noTask = { en: "No task", pl: "Brak zadania", ru: "Нет задачи", es: "Sin tarea" }[language]
  const noDueDate = { en: "No due date", pl: "Bez terminu", ru: "Без срока", es: "Sin fecha límite" }[language]
  const dataChanged = { en: "Data changed", pl: "Zmieniono dane", ru: "Данные изменены", es: "Datos modificados" }[language]
  if (!value) return undefined
  if (value === "no_task") return noTask
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return value
    if (event.action === "task_reprioritize") return String(parsed.priority ?? "—")
    if (event.action === "task_reassign") return actorName(String(parsed.ownerId ?? "—"), users)
    if (event.action === "task_reschedule") return typeof parsed.dueAt === "string" ? formatDateTime(parsed.dueAt, undefined, locale) : noDueDate
    if (["task_complete", "task_cancel", "task_reopen"].includes(event.action ?? "")) return [parsed.status, parsed.outcome].filter(Boolean).join(" · ") || "—"
    if (event.action === "task_replace") return String(parsed.replacementTaskId ?? parsed.status ?? "—")
    return [parsed.title, parsed.status, parsed.priority].filter(Boolean).join(" · ") || dataChanged
  } catch {
    return value
  }
}

function matchesQuery(event: AuditEvent, query: string, users: AppUser[]) {
  if (!query.trim()) return true
  const haystack = [event.summary, event.caseId, event.patientId, event.before, event.after, actorName(event.actorId, users), event.targetUserId, event.targetRole, event.targetUserId ? actorName(event.targetUserId, users) : undefined]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export function AuditLogView() {
  const { language, locale } = useLanguage()
  const tl = (en: string, pl: string, ru: string, es: string) => ({ en, pl, ru, es }[language])
  const { auditEvents } = useScopedEntityStore()
  const { users } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const [query, setQuery] = useState("")
  const [activeType, setActiveType] = useState<AuditEventType | "all">("all")

  // Relative timestamps ("24 mins ago") are computed against the real clock,
  // which ticks forward between the server render and client hydration and
  // can flip the rounded minute value. Deferring them to a client-only mount
  // avoids a hydration mismatch (no diff against server HTML after mount).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const sorted = useMemo(
    () => [...auditEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [auditEvents],
  )

  const filtered = useMemo(
    () => sorted.filter((e) => (activeType === "all" || e.type === activeType) && matchesQuery(e, query, users)),
    [sorted, activeType, query, users],
  )

  const last24h = useMemo(
    () => sorted.filter((e) => Date.now() - new Date(e.at).getTime() < 24 * 60 * 60 * 1000).length,
    [sorted],
  )

  const conflicts = useMemo(
    () => sorted.filter((e) => e.type === "sync" && /konflikt|conflict|конфликт/i.test(e.summary)).length,
    [sorted],
  )

  const typeCounts = useMemo(() => {
    const counts = new Map<AuditEventType, number>()
    for (const e of sorted) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    return counts
  }, [sorted])

  if (!hasPermission("audit:view")) return <p role="alert">{tl("No access to the audit log.", "Brak dostępu do Audit Log.", "Нет доступа к журналу изменений.", "Sin acceso al registro de auditoría.")}</p>

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tl("Events in the system", "Zdarzenia w systemie", "События в системе", "Eventos en el sistema")} value={sorted.length} />
        <Stat label={tl("Last 24h", "Ostatnie 24h", "Последние 24 ч", "Últimas 24 h")} value={last24h} />
        <Stat label={tl("Sync conflicts", "Konflikty synchronizacji", "Конфликты синхронизации", "Conflictos de sincronización")} value={conflicts} accent={conflicts > 0} />
        <Stat label={tl("Event types", "Typy zdarzeń", "Типы событий", "Tipos de eventos")} value={typeCounts.size} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tl("Search by case, actor, content…", "Szukaj po sprawie, aktorze, treści…", "Поиск по кейсу, автору, содержимому…", "Buscar por caso, autor, contenido…")}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={activeType === "all"} onClick={() => setActiveType("all")}>
            {tl("All", "Wszystkie", "Все", "Todos")} ({sorted.length})
          </FilterChip>
          {TYPE_ORDER.filter((t) => (typeCounts.get(t) ?? 0) > 0).map((t) => (
            <FilterChip key={t} active={activeType === t} onClick={() => setActiveType(t)}>
              {TYPE_LABELS[t][language]} ({typeCounts.get(t) ?? 0})
            </FilterChip>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            {tl("Event log", "Dziennik zdarzeń", "Журнал событий", "Registro de eventos")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">({filtered.length})</span>
          </h3>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {tl("No events match the filters.", "Brak zdarzeń spełniających kryteria filtrowania.", "Нет событий, соответствующих фильтрам.", "No hay eventos que coincidan con los filtros.")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((event) => {
              const meta = TYPE_META[event.type]
              const before = readableAuditValue(event.before, event, users, language, locale)
              const after = readableAuditValue(event.after, event, users, language, locale)
              return (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.className)}
                  >
                    <meta.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{readableSummary(event, language)}</span>
                      {event.occurrences && event.occurrences > 1 ? (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          ×{event.occurrences}
                        </span>
                      ) : null}
                    </div>
                    {(before || after) && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {before ? <span className="max-w-full break-words rounded bg-secondary px-1.5 py-0.5">{before}</span> : null}
                        {before && after ? <ArrowRight className="h-3 w-3 shrink-0" /> : null}
                        {after ? (
                          <span className="max-w-full break-words rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">{after}</span>
                        ) : null}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white",
                          actorColor(event.actorId, users),
                        )}
                      >
                        {actorInitials(event.actorId, users)}
                      </span>
                      <span>{actorName(event.actorId, users)}</span>
                      {event.targetUserId && <span>· {tl("user", "użytkownik", "пользователь", "usuario")} {actorName(event.targetUserId, users)}</span>}
                      {event.targetRole && <span>· {tl("role", "rola", "роль", "rol")} {event.targetRole}</span>}
                      {event.caseId ? <span>· {tl("case", "sprawa", "кейс", "caso")} {event.caseId}</span> : null}
                      {event.patientId ? <span>· {tl("patient", "pacjent", "пациент", "paciente")} {event.patientId}</span> : null}
                      <span title={formatDateTime(event.at, undefined, locale)}>
                        · {mounted ? formatRelative(event.at, language) : formatDateTime(event.at, undefined, locale)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold text-foreground", accent && value > 0 && "text-red-600")}>{value}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  )
}
