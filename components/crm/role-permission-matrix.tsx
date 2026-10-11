"use client"

import { useMemo, useState } from "react"
import { RotateCcw, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { PERMISSION_DEFINITIONS, type Permission } from "@/lib/crm/permissions"
import { ROLE_ORDER, ROLE_PROFILES, type RoleId } from "@/lib/crm/roles"
import { useLanguage } from "@/lib/crm/language-context"

const GROUP_RU: Record<string, string> = {
  Sprawy: "Заявки", Zadania: "Задачи", Pacjent: "Пациент", Komunikacja: "Коммуникации",
  AI: "ИИ", SMS: "SMS", Telefonia: "Телефония", Raporty: "Отчёты", Administracja: "Администрирование",
}
const GROUP_EN: Record<string, string> = { Sprawy: "Cases", Zadania: "Tasks", Pacjent: "Patient", Komunikacja: "Communications", AI: "AI", SMS: "SMS", Telefonia: "Telephony", Raporty: "Reports", Administracja: "Administration" }

const PERMISSION_RU = {
  "case:view": ["Просмотр заявок", "Открытие заявок в разрешённой области данных."],
  "case:edit": ["Редактирование заявок", "Изменение операционных данных заявки."],
  "case:move": ["Изменение этапа", "Перемещение заявок между этапами процесса."],
  "task:view": ["Просмотр задач", "Список, календарь и детали задач."],
  "task:work": ["Выполнение задач", "Начало работы, результат и перенос срока задачи."],
  "task:assign": ["Назначение задач", "Изменение исполнителя и приоритета."],
  "patient:view_basic": ["Основные данные", "Контакты и основной профиль пациента."],
  "patient:view_medical": ["Медицинские данные", "План лечения и клинические данные."],
  "patient:edit_local": ["Локальное редактирование", "Дополнение данных, которыми не управляет Medical CRM."],
  "patient:match_approve": ["Подтверждение сопоставления", "Контролируемая привязка пациента к заявке в пределах доступных клиник."],
  "communication:view": ["Просмотр коммуникаций", "Входящие и история разговоров."],
  "communication:send": ["Отправка сообщений", "Чат, e-mail и социальные каналы."],
  "ai:trace_view": ["Источники ответов ИИ", "Версии модели, политики и источники базы знаний без раскрытия хода рассуждений."],
  "ai:manage": ["Управление ИИ", "Политики активации, передачи оператору и переключатели ИИ."],
  "sms:send_custom": ["Произвольный текст SMS", "Отправка введённого вручную текста."],
  "sms:send_template": ["Шаблоны SMS", "Отправка утверждённых шаблонов."],
  "sms:retry": ["Повтор SMS", "Повторная отправка неудачного SMS."],
  "sms:match_patient": ["Привязка входящего SMS", "Ручной выбор пациента."],
  "sms:template_manage": ["Управление шаблонами", "Создание и деактивация шаблонов."],
  "sms:provider_manage": ["Настройка провайдера", "Провайдеры, отправители и проверка соединения."],
  "call:handle": ["Обработка звонков", "Приём и совершение звонков."],
  "call:recording_view": ["Записи разговоров", "Прослушивание записей в пределах доступных данных."],
  "report:view_operational": ["Операционные отчёты", "Результаты команды и SLA."],
  "report:view_marketing": ["Маркетинговые отчёты", "Источники и конверсия кампаний."],
  "audit:view": ["История изменений", "Активность и центральный журнал аудита."],
  "configuration:manage": ["Конфигурация", "Процессы, клиники и настройки приложения."],
  "users:manage": ["Пользователи и роли", "Учётные записи, доступ и матрица разрешений."],
} satisfies Record<Permission, readonly [string, string]>
const PERMISSION_EN: Record<Permission, readonly [string, string]> = {
  "case:view": ["View cases", "Open cases within the permitted data scope."], "case:edit": ["Edit cases", "Change operational case data."], "case:move": ["Change stage", "Move cases between workflow stages."],
  "task:view": ["View tasks", "Task list, calendar and details."], "task:work": ["Work tasks", "Start, complete and reschedule tasks."], "task:assign": ["Assign tasks", "Change owner and priority."],
  "patient:view_basic": ["Basic data", "Patient contacts and basic profile."], "patient:view_medical": ["Medical data", "Treatment plan and clinical data."], "patient:edit_local": ["Local editing", "Complete data not managed by Medical CRM."], "patient:match_approve": ["Approve matching", "Controlled patient-to-case linking within the clinic scope."],
  "communication:view": ["View communications", "Inbox and conversation history."], "communication:send": ["Send messages", "Chat, email and social channels."],
  "ai:trace_view": ["AI answer sources", "Model versions, policies and knowledge-base sources without chain-of-thought disclosure."], "ai:manage": ["Manage AI", "Activation, handover and AI control policies."],
  "sms:send_custom": ["Custom SMS text", "Send manually entered text."], "sms:send_template": ["SMS templates", "Send approved templates."], "sms:retry": ["Retry SMS", "Retry a failed SMS."], "sms:match_patient": ["Match incoming SMS", "Select the patient manually."], "sms:template_manage": ["Manage templates", "Create and deactivate templates."], "sms:provider_manage": ["Provider configuration", "Providers, senders and connection testing."],
  "call:handle": ["Handle calls", "Receive and initiate calls."], "call:recording_view": ["Call recordings", "Listen to recordings within the permitted scope."],
  "report:view_operational": ["Operational reports", "Team results and SLA."], "report:view_marketing": ["Marketing reports", "Campaign sources and conversion."],
  "audit:view": ["Audit history", "Activity and the central audit log."], "configuration:manage": ["Configuration", "Workflow, clinics and application settings."], "users:manage": ["Users and roles", "Accounts, access and permission matrix."],
}

export function RolePermissionMatrix() {
  const { language, t, tr } = useLanguage()
  const [selectedRole, setSelectedRole] = useState<RoleId>("operator")
  const [resetTarget, setResetTarget] = useState<RoleId | null>(null)
  const [error, setError] = useState("")
  const { hasPermission, rolePermissions, roleHasPermission, toggleRolePermission, resetRolePermissions } = useAuthorization()
  const groups = useMemo(() => [...new Set(PERMISSION_DEFINITIONS.map((item) => item.group))], [])
  const protectedRole = selectedRole === "admin"
  const canManage = hasPermission("configuration:manage")
  function toggle(permission: Parameters<typeof toggleRolePermission>[1]) {
    try { toggleRolePermission(selectedRole, permission); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr("Zmiana została odrzucona.", "Изменение отклонено.")) }
  }
  function confirmReset() {
    if (!resetTarget) return
    try { resetRolePermissions(resetTarget); setResetTarget(null); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr("Reset został odrzucony.", "Сброс отклонён.")) }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold">{tr("Role i uprawnienia", "Роли и разрешения")}</h2></div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{tr("Rola jest pakietem atomowych uprawnień. Zakres klinik użytkownika pozostaje dodatkowym ograniczeniem danych.", "Роль представляет собой набор отдельных разрешений. Доступные пользователю клиники дополнительно ограничивают область данных.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRole} onValueChange={(value) => value && setSelectedRole(value as RoleId)}><SelectTrigger className="w-48"><SelectValue>{(value: RoleId | null) => value ? t(ROLE_PROFILES[value].labelKey) : null}</SelectValue></SelectTrigger><SelectContent>{ROLE_ORDER.map((role) => <SelectItem key={role} value={role}>{t(ROLE_PROFILES[role].labelKey)}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={protectedRole || !canManage} onClick={() => { setError(""); setResetTarget(selectedRole) }}><RotateCcw className="h-3.5 w-3.5" />{tr("Domyślne", "По умолчанию")}</Button>
        </div>
      </div>
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{t(ROLE_PROFILES[selectedRole].labelKey)}</span> · {rolePermissions[selectedRole].length} {tr("uprawnień", "разрешений")}{protectedRole && <Badge variant="outline" className="ml-2">{tr("Rola systemowa · pełny dostęp", "Системная роль · полный доступ")}</Badge>}</div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>}
      {!canManage && <p className="px-4 py-2 text-xs text-muted-foreground">{tr("Zmiana macierzy wymaga configuration:manage.", "Для изменения матрицы требуется разрешение configuration:manage.")}</p>}
      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{tr("Przywrócić domyślne uprawnienia?", "Восстановить разрешения по умолчанию?")}</DialogTitle></DialogHeader>
          <p className="text-sm">{tr("Rola", "Роль")}: {resetTarget ? t(ROLE_PROFILES[resetTarget].labelKey) : ""}. {tr("Bieżący pakiet zostanie zastąpiony domyślnym i zapisany w Audit Log.", "Текущий набор будет заменён стандартным и сохранён в журнале аудита.")}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button variant="ghost" onClick={() => setResetTarget(null)}>{tr("Anuluj", "Отмена")}</Button><Button onClick={confirmReset}>{tr("Potwierdź reset", "Подтвердить сброс")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid gap-0 lg:grid-cols-2">
        {groups.map((group) => <div key={group} className="border-b border-border p-4 lg:odd:border-r"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{language === "ru" ? GROUP_RU[group] ?? group : language === "en" ? GROUP_EN[group] ?? group : group}</h3><div className="space-y-1">
          {PERMISSION_DEFINITIONS.filter((item) => item.group === group).map((permission) => <label key={permission.id} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-muted/40"><span className="min-w-0"><span className="block text-sm font-medium">{language === "ru" ? PERMISSION_RU[permission.id][0] : language === "en" ? PERMISSION_EN[permission.id][0] : permission.label}</span><span className="block text-[11px] text-muted-foreground">{language === "ru" ? PERMISSION_RU[permission.id][1] : language === "en" ? PERMISSION_EN[permission.id][1] : permission.description} · <code>{permission.id}</code></span></span><Switch checked={roleHasPermission(selectedRole, permission.id)} disabled={protectedRole || !canManage} onCheckedChange={() => toggle(permission.id)} /></label>)}
        </div></div>)}
      </div>
      <div className="bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">{tr("Prototyp stosuje zmiany natychmiast w bieżącej sesji. Produkcyjnie wersje macierzy będą przechowywane po stronie backendu, audytowane i egzekwowane w każdym API.", "В прототипе изменения применяются сразу в текущем сеансе. В production версии матрицы будут храниться на бэкенде, аудироваться и проверяться в каждом API.")}</div>
    </section>
  )
}
