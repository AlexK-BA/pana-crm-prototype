"use client"

/**
 * Full Audit Log — §2.7 / §18. Reads the live, shared auditEvents stream from
 * EntityStore so every status/assignment/priority/task change, merge, link,
 * and sync conflict recorded anywhere in the app (kanban drag, call wrap-up,
 * drawer actions) shows up here immediately, in one searchable place.
 */

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
import { useLanguage } from "@/lib/crm/language-context"
import type { AuditEvent, AuditEventType } from "@/lib/crm/entities"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

const TYPE_META: Record<AuditEventType, { label: string; icon: typeof ShieldCheck; className: string }> = {
  case_created: { label: "Utworzenie sprawy", icon: Link2, className: "bg-teal-100 text-teal-700" },
  comment_added: { label: "Komentarz pracownika", icon: UserCog, className: "bg-slate-100 text-slate-700" },
  patient_local_updated: { label: "Lokalne dane pacjenta", icon: UserCog, className: "bg-teal-100 text-teal-700" },
  patient_match_searched: { label: "Wyszukanie pacjenta", icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_suggested: { label: "Propozycja dopasowania", icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_auto_linked: { label: "Automatyczne powiązanie pacjenta", icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_approved: { label: "Zatwierdzenie dopasowania", icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_rejected: { label: "Odrzucenie dopasowania", icon: Link2, className: "bg-teal-100 text-teal-700" },
  patient_match_conflict: { label: "Konflikt dopasowania", icon: Link2, className: "bg-teal-100 text-teal-700" },
  contact_identity_linked: { label: "Powiązanie kontaktu", icon: Link2, className: "bg-teal-100 text-teal-700" },
  contact_identity_reused: { label: "Użycie istniejącego kontaktu", icon: Link2, className: "bg-teal-100 text-teal-700" },
  user_invited: { label: "Zaproszenie użytkownika", icon: UserCog, className: "bg-amber-100 text-amber-700" },
  user_activated: { label: "Aktywacja użytkownika", icon: UserCog, className: "bg-emerald-100 text-emerald-700" },
  user_deactivated: { label: "Dezaktywacja użytkownika", icon: UserCog, className: "bg-red-100 text-red-700" },
  user_password_reset_requested: { label: "Prośba o reset hasła", icon: UserCog, className: "bg-amber-100 text-amber-700" },
  user_sessions_revoked: { label: "Odwołanie sesji", icon: UserCog, className: "bg-amber-100 text-amber-700" },
  user_access_changed: { label: "Zmiana dostępu użytkownika", icon: UserCog, className: "bg-amber-100 text-amber-700" },
  role_permissions_changed: { label: "Zmiana uprawnień roli", icon: UserCog, className: "bg-amber-100 text-amber-700" },
  role_permissions_reset: { label: "Reset uprawnień roli", icon: UserCog, className: "bg-amber-100 text-amber-700" },
  access_denied: { label: "Odmowa dostępu", icon: ShieldCheck, className: "bg-red-100 text-red-700" },
  conversation_handoff: { label: "Przekazanie rozmowy", icon: UserCog, className: "bg-violet-100 text-violet-700" },
  ai_control_changed: { label: "Sterowanie AI", icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },
  ai_policy_changed: { label: "Polityka AI", icon: SlidersHorizontal, className: "bg-violet-100 text-violet-700" },
  ai_activation_scheduled: { label: "Zaplanowanie AI", icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },
  ai_activation_cancelled: { label: "Anulowanie AI", icon: ShieldCheck, className: "bg-amber-100 text-amber-700" },
  ai_activation_started: { label: "Aktywacja AI", icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },
  ai_response_recorded: { label: "Odpowiedź AI", icon: ShieldCheck, className: "bg-violet-100 text-violet-700" },

  sms_send: { label: "Wysyłka SMS", icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  sms_failed: { label: "Błąd SMS", icon: ShieldCheck, className: "bg-red-100 text-red-700" },
  sms_retry: { label: "Ponowienie SMS", icon: ShieldCheck, className: "bg-amber-100 text-amber-700" },
  sms_provider_change: { label: "Zmiana dostawcy SMS", icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  sms_provider_test: { label: "Test dostawcy SMS", icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  sms_provider_config: { label: "Konfiguracja SMS", icon: ShieldCheck, className: "bg-sky-100 text-sky-700" },
  status_change: { label: "Zmiana statusu", icon: ArrowRight, className: "bg-sky-100 text-sky-700" },
  assignment_change: { label: "Zmiana przypisania", icon: UserCog, className: "bg-violet-100 text-violet-700" },
  task_change: { label: "Zmiana zadania", icon: ListChecks, className: "bg-emerald-100 text-emerald-700" },
  priority_change: { label: "Zmiana priorytetu", icon: SlidersHorizontal, className: "bg-amber-100 text-amber-700" },
  merge: { label: "Scalenie", icon: GitMerge, className: "bg-fuchsia-100 text-fuchsia-700" },
  link: { label: "Powiązanie", icon: Link2, className: "bg-teal-100 text-teal-700" },
  unlink: { label: "Odłączenie", icon: Unlink, className: "bg-slate-200 text-slate-700" },
  sync: { label: "Synchronizacja", icon: RefreshCw, className: "bg-red-100 text-red-700" },
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

const ACTION_LABELS: Record<string, string> = {
  task_edit: "Edycja zadania",
  task_reschedule: "Zmiana terminu zadania",
  task_reassign: "Zmiana właściciela zadania",
  task_reprioritize: "Zmiana priorytetu zadania",
  task_replace: "Zastąpienie zadania",
  task_cancel: "Anulowanie zadania",
  task_complete: "Zakończenie zadania",
  task_reopen: "Ponowne otwarcie zadania",
  task_created: "Utworzenie zadania",
  workflow_task_skipped: "Pominięcie zadania workflow",
}

const ACTION_LABELS_RU: Record<string, string> = {
  task_edit: "Редактирование задачи", task_reschedule: "Перенос срока задачи", task_reassign: "Смена ответственного",
  task_reprioritize: "Смена приоритета задачи", task_replace: "Замена задачи", task_cancel: "Отмена задачи",
  task_complete: "Завершение задачи", task_reopen: "Повторное открытие задачи", task_created: "Создание задачи",
  workflow_task_skipped: "Пропуск задачи процесса",
}

const TYPE_LABELS_RU: Record<AuditEventType, string> = {
  case_created: "Создание кейса", comment_added: "Комментарий сотрудника", patient_local_updated: "Локальные данные пациента",
  patient_match_searched: "Поиск пациента", patient_match_suggested: "Предложение совпадения", patient_auto_linked: "Автопривязка пациента",
  patient_match_approved: "Подтверждение совпадения", patient_match_rejected: "Отклонение совпадения", patient_match_conflict: "Конфликт совпадения",
  contact_identity_linked: "Привязка контакта", contact_identity_reused: "Повторное использование контакта", user_invited: "Приглашение пользователя",
  user_activated: "Активация пользователя", user_deactivated: "Деактивация пользователя", user_password_reset_requested: "Запрос сброса пароля",
  user_sessions_revoked: "Отзыв сессий", user_access_changed: "Изменение доступа", role_permissions_changed: "Изменение разрешений роли",
  role_permissions_reset: "Сброс разрешений роли", access_denied: "Отказ в доступе", conversation_handoff: "Передача диалога",
  ai_control_changed: "Управление ИИ", ai_policy_changed: "Политика ИИ", ai_activation_scheduled: "Планирование ИИ",
  ai_activation_cancelled: "Отмена активации ИИ", ai_activation_started: "Активация ИИ", ai_response_recorded: "Ответ ИИ",
  sms_send: "Отправка SMS", sms_failed: "Ошибка SMS", sms_retry: "Повторная отправка SMS", sms_provider_change: "Смена SMS-провайдера",
  sms_provider_test: "Тест SMS-провайдера", sms_provider_config: "Настройка SMS", status_change: "Изменение статуса",
  assignment_change: "Изменение назначения", task_change: "Изменение задачи", priority_change: "Изменение приоритета",
  merge: "Объединение", link: "Привязка", unlink: "Отвязка", sync: "Синхронизация",
}

const SUMMARY_RU: Record<string, string> = {
  "Sprawa z listy oczekujących przeniesiona do aktywnego callbacku": "Заявка из списка ожидания переведена в активный обратный звонок",
  "Team Leader zmienił przypisanie": "Тимлид изменил назначение", "Status zmieniony": "Статус изменён",
  "Wykryto konflikt danych z Medical CRM (nazwisko)": "Обнаружен конфликт данных с Medical CRM (фамилия)",
  "Eskalacja P0 utworzona ręcznie": "Эскалация P0 создана вручную", "Przypisano po rozpoczęciu obsługi": "Назначено после начала обработки",
  "Synchronizacja z Medical CRM nie powiodła się — dane lokalne pozostają dostępne": "Синхронизация с Medical CRM не удалась — локальные данные остаются доступны",
  "Zaktualizowano kolejność kolumn kanban": "Порядок колонок канбан обновлён",
  "Połączono kontakt e-mail z pacjentem po dopasowaniu numeru telefonu": "E-mail объединён с пациентом после сопоставления номера телефона",
  "Lead przekształcony w Deal": "Лид преобразован в визит",
}

const AUDIT_VALUE_RU: Record<string, string> = {
  "Waiting List": "Список ожидания", Qualification: "Квалификация", "Call Later": "Перезвонить позже",
  Nieprzypisane: "Не назначено", "Converted to Deal": "Преобразован в визит", "Appointment Scheduled": "Визит запланирован",
  "ci-04b (niepowiązany)": "ci-04b (не связан)",
}

function readableSummary(event: AuditEvent, language: "pl" | "ru") {
  if (language === "ru" && SUMMARY_RU[event.summary]) return SUMMARY_RU[event.summary]
  const actionId = event.action
  const action = actionId ? (language === "ru" ? ACTION_LABELS_RU[actionId] : ACTION_LABELS[actionId]) : undefined
  if (!actionId || !action || !event.summary.startsWith(actionId)) return event.summary
  return `${action}${event.summary.slice(actionId.length)}`
}

function readableAuditValue(value: string | undefined, event: AuditEvent, users: AppUser[], language: "pl" | "ru") {
  if (!value) return undefined
  if (language === "ru" && AUDIT_VALUE_RU[value]) return AUDIT_VALUE_RU[value]
  if (value === "no_task") return language === "ru" ? "Нет задачи" : "Brak zadania"
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return value
    if (event.action === "task_reprioritize") return String(parsed.priority ?? "—")
    if (event.action === "task_reassign") return actorName(String(parsed.ownerId ?? "—"), users)
    if (event.action === "task_reschedule") return typeof parsed.dueAt === "string" ? formatDateTime(parsed.dueAt, undefined, language === "ru" ? "ru-RU" : "pl-PL") : language === "ru" ? "Без срока" : "Bez terminu"
    if (["task_complete", "task_cancel", "task_reopen"].includes(event.action ?? "")) return [parsed.status, parsed.outcome].filter(Boolean).join(" · ") || "—"
    if (event.action === "task_replace") return String(parsed.replacementTaskId ?? parsed.status ?? "—")
    return [parsed.title, parsed.status, parsed.priority].filter(Boolean).join(" · ") || (language === "ru" ? "Данные изменены" : "Zmieniono dane")
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
  const { auditEvents } = useScopedEntityStore()
  const { users } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const { language, tr } = useLanguage()
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
    () => sorted.filter((e) => e.type === "sync" && /konflikt|конфликт/i.test(e.summary)).length,
    [sorted],
  )

  const typeCounts = useMemo(() => {
    const counts = new Map<AuditEventType, number>()
    for (const e of sorted) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    return counts
  }, [sorted])

  if (!hasPermission("audit:view")) return <p role="alert">{tr("Brak dostępu do Audit Log.", "Нет доступа к журналу аудита.")}</p>

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("Zdarzenia w systemie", "События в системе")} value={sorted.length} />
        <Stat label={tr("Ostatnie 24h", "Последние 24 часа")} value={last24h} />
        <Stat label={tr("Konflikty synchronizacji", "Конфликты синхронизации")} value={conflicts} accent={conflicts > 0} />
        <Stat label={tr("Typy zdarzeń", "Типы событий")} value={typeCounts.size} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Szukaj po sprawie, aktorze, treści…", "Поиск по кейсу, автору или содержанию…")}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={activeType === "all"} onClick={() => setActiveType("all")}>
            {tr("Wszystkie", "Все")} ({sorted.length})
          </FilterChip>
          {TYPE_ORDER.filter((t) => (typeCounts.get(t) ?? 0) > 0).map((t) => (
            <FilterChip key={t} active={activeType === t} onClick={() => setActiveType(t)}>
              {language === "ru" ? TYPE_LABELS_RU[t] : TYPE_META[t].label} ({typeCounts.get(t) ?? 0})
            </FilterChip>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            {tr("Dziennik zdarzeń", "Журнал событий")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">({filtered.length})</span>
          </h3>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {tr("Brak zdarzeń spełniających kryteria filtrowania.", "Нет событий, соответствующих фильтрам.")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((event) => {
              const meta = TYPE_META[event.type]
              const before = readableAuditValue(event.before, event, users, language)
              const after = readableAuditValue(event.after, event, users, language)
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
                      {event.targetUserId && <span>· {tr("użytkownik", "пользователь")} {actorName(event.targetUserId, users)}</span>}
                      {event.targetRole && <span>· {tr("rola", "роль")} {event.targetRole}</span>}
                      {event.caseId ? <span>· {tr("sprawa", "кейс")} {event.caseId}</span> : null}
                      {event.patientId ? <span>· {tr("pacjent", "пациент")} {event.patientId}</span> : null}
                      <span title={formatDateTime(event.at, undefined, language === "ru" ? "ru-RU" : "pl-PL")}>
                        · {mounted ? formatRelative(event.at, language) : formatDateTime(event.at, undefined, language === "ru" ? "ru-RU" : "pl-PL")}
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
