"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { KeyRound, Laptop2, Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUserDirectory, type AppUser } from "@/lib/crm/user-directory"
import { ROLE_ORDER, ROLE_PROFILES, type RoleId } from "@/lib/crm/roles"
import { CLINICS } from "@/lib/crm/catalog"
import type { ClinicId } from "@/lib/crm/entities"
import { formatRelative } from "@/lib/crm/format"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { RolePermissionMatrix } from "@/components/crm/role-permission-matrix"
import { useLanguage } from "@/lib/crm/language-context"

const STATUS_LABEL = {
  invited: ["Zaproszony", "Приглашён"], active: ["Aktywny", "Активен"],
  inactive: ["Nieaktywny", "Неактивен"], locked: ["Zablokowany", "Заблокирован"],
} as const
const STATUS_FILTER_LABEL = {
  all: ["Wszystkie statusy", "Все статусы"], active: ["Aktywni", "Активные"],
  inactive: ["Nieaktywni", "Неактивные"], invited: ["Zaproszeni", "Приглашённые"],
  locked: ["Zablokowani", "Заблокированные"],
} as const
const STATUS_TONE = { invited: "border-sky-200 bg-sky-50 text-sky-700", active: "border-emerald-200 bg-emerald-50 text-emerald-700", inactive: "border-slate-200 bg-slate-50 text-slate-600", locked: "border-red-200 bg-red-50 text-red-700" }

export function UserManagementView() {
  const { users, currentUser, createUser, setActive, requestPasswordReset, revokeSessions, updateAccess } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const { language, t, tr } = useLanguage()
  const roleLabel = (role: RoleId) => t(ROLE_PROFILES[role].labelKey)
  const statusLabel = (value: AppUser["status"]) => {
    const [pl, ru] = STATUS_LABEL[value]
    return tr(pl, ru)
  }
  const statusFilterLabel = (value: string | null) => {
    const key = (value ?? "all") as keyof typeof STATUS_FILTER_LABEL
    const [pl, ru] = STATUS_FILTER_LABEL[key]
    return tr(pl, ru)
  }
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pendingAction, setPendingAction] = useState<{ type: "password" | "sessions" | "active" | "access"; user: AppUser; roles?: RoleId[]; clinicIds?: ClinicId[] } | null>(null)
  const [draft, setDraft] = useState({ name: "", email: "", roles: ["operator"] as RoleId[], clinics: ["pana-medica"] as ClinicId[] })

  const visible = useMemo(() => users.filter((user) => {
    const matchesQuery = !query || `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === "all" || user.status === status)
  }), [query, status, users])

  function renderActions(user: (typeof visible)[number]) {
    return (
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="ghost" disabled={user.id === currentUser.id} aria-label={tr("Edytuj role i kliniki", "Изменить роли и клиники")} onClick={() => { setError(""); setEditing(user); setDraft({ name: user.name, email: user.email, roles: [...user.roles], clinics: user.clinicIds }) }}><ShieldCheck className="h-3.5 w-3.5" /></Button>} />
          <TooltipContent>{tr("Edytuj role i kliniki", "Изменить роли и клиники")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="ghost" aria-label={tr("Resetuj hasło", "Сбросить пароль")} onClick={() => { setError(""); setPendingAction({ type: "password", user }) }}><KeyRound className="h-3.5 w-3.5" /></Button>} />
          <TooltipContent>{tr("Resetuj hasło", "Сбросить пароль")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="ghost" aria-label={tr("Zakończ sesje", "Завершить сеансы")} onClick={() => { setError(""); setPendingAction({ type: "sessions", user }) }}><Laptop2 className="h-3.5 w-3.5" /></Button>} />
          <TooltipContent>{tr("Zakończ aktywne sesje", "Завершить активные сеансы")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="ghost" disabled={user.id === currentUser.id} aria-label={user.status === "inactive" ? tr("Aktywuj", "Активировать") : tr("Dezaktywuj", "Деактивировать")} onClick={() => { setError(""); setPendingAction({ type: "active", user }) }}>{user.status === "inactive" ? <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> : <UserX className="h-3.5 w-3.5 text-amber-600" />}</Button>} />
          <TooltipContent>{user.status === "inactive" ? tr("Aktywuj konto", "Активировать учётную запись") : tr("Dezaktywuj konto", "Деактивировать учётную запись")}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  function notify(text: string) {
    setMessage(text)
    setTimeout(() => setMessage(""), 2500)
  }

  function openCreate() {
    setDraft({ name: "", email: "", roles: ["operator"], clinics: ["pana-medica"] })
    setError("")
    setCreateOpen(true)
  }

  function submitCreate() {
    try {
      createUser({ name: draft.name, email: draft.email, roles: draft.roles, clinicIds: draft.clinics })
      setError("")
      setCreateOpen(false)
      notify(tr("Użytkownik został zaproszony (demo). E-mail nie jest wysyłany; hasło nie jest generowane.", "Пользователь приглашён (демо). Письмо не отправляется, пароль не создаётся."))
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("Nie udało się utworzyć użytkownika.", "Не удалось создать пользователя.")) }
  }

  function toggleClinic(clinicId: ClinicId) {
    setDraft((prev) => ({ ...prev, clinics: prev.clinics.includes(clinicId) ? prev.clinics.filter((id) => id !== clinicId) : [...prev.clinics, clinicId] }))
  }

  function confirmAction() {
    if (!pendingAction) return
    const { type, user } = pendingAction
    try {
      if (type === "password") {
        requestPasswordReset(user.id)
        notify(tr("Zarejestrowano prośbę o reset hasła (demo, bez e-maila i linku).", "Запрос на сброс пароля зарегистрирован (демо, без письма и ссылки)."))
      } else if (type === "sessions") {
        revokeSessions(user.id)
        notify(tr(`Zarejestrowano odwołanie sesji użytkownika ${user.name} (demo).`, `Завершение сеансов пользователя ${user.name} зарегистрировано (демо).`))
      } else if (type === "access") {
        updateAccess(user.id, pendingAction.roles ?? [], pendingAction.clinicIds ?? [])
        notify(tr("Zaktualizowano role i zakres klinik.", "Роли и доступ к клиникам обновлены."))
      } else {
        const active = user.status === "inactive"
        setActive(user.id, active)
        notify(active ? tr("Konto aktywowano.", "Учётная запись активирована.") : tr("Konto dezaktywowano, a sesje odwołano (demo).", "Учётная запись деактивирована, сеансы завершены (демо)."))
      }
      setError("")
      setPendingAction(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("Operacja została odrzucona.", "Операция отклонена.")) }
  }

  if (!hasPermission("users:manage")) return <p role="alert">{tr("Brak dostępu do zarządzania użytkownikami.", "Нет доступа к управлению пользователями.")}</p>

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={tr("Wszyscy użytkownicy", "Все пользователи")} value={users.length} />
        <Stat label={tr("Aktywni", "Активные")} value={users.filter((user) => user.status === "active").length} />
        <Stat label={tr("Nieaktywni", "Неактивные")} value={users.filter((user) => user.status === "inactive").length} />
        <Stat label={tr("Administratorzy", "Администраторы")} value={users.filter((user) => user.roles.includes("admin")).length} />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">{tr("Użytkownicy aplikacji", "Пользователи приложения")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{tr("Konta są dezaktywowane, nigdy usuwane. Operacje bezpieczeństwa pozostają audytowalne.", "Учётные записи деактивируются, но не удаляются. Операции безопасности сохраняются в журнале аудита.")}</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-3.5 w-3.5" />{tr("Dodaj użytkownika", "Добавить пользователя")}</Button>
        </div>
        <div className="flex gap-2 border-b border-border p-3">
          <div className="relative max-w-sm flex-1"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Szukaj po imieniu lub e-mailu", "Поиск по имени или e-mail")} className="pl-8" /></div>
          <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}><SelectTrigger className="w-44"><SelectValue>{statusFilterLabel}</SelectValue></SelectTrigger><SelectContent>{Object.keys(STATUS_FILTER_LABEL).map((value) => <SelectItem key={value} value={value}>{statusFilterLabel(value)}</SelectItem>)}</SelectContent></Select>
        </div>
        {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>}
        {message && <div role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">{message}</div>}
        <ul className="divide-y divide-border md:hidden" aria-label={tr("Użytkownicy aplikacji", "Пользователи приложения")}>
          {visible.map((user) => (
            <li key={user.id} className="flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant="outline" className={STATUS_TONE[user.status]}>{statusLabel(user.status)}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">{user.roles.map((role) => <Badge key={role} variant="secondary" className="text-[10px]">{roleLabel(role)}</Badge>)}</div>
              <p className="text-xs text-muted-foreground">
                {user.clinicIds.length ? user.clinicIds.map((id) => CLINICS.find((clinic) => clinic.id === id)?.name).join(", ") : tr("Dane zagregowane", "Сводные данные")}
                {" · "}
                {user.lastLoginAt ? formatRelative(user.lastLoginAt, language) : tr("Nigdy", "Никогда")}
              </p>
              {renderActions(user)}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">{tr("Użytkownik", "Пользователь")}</th><th className="px-3 py-2.5 font-medium">{tr("Role", "Роли")}</th><th className="hidden px-3 py-2.5 font-medium md:table-cell">{tr("Zakres klinik", "Доступ к клиникам")}</th><th className="px-3 py-2.5 font-medium">{tr("Status", "Статус")}</th><th className="hidden px-3 py-2.5 font-medium md:table-cell">{tr("Ostatnie logowanie", "Последний вход")}</th><th className="px-4 py-2.5 text-right font-medium">{tr("Działania", "Действия")}</th></tr></thead>
            <tbody className="divide-y divide-border">
              {visible.map((user) => (
                <tr key={user.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3"><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{user.roles.map((role) => <Badge key={role} variant="secondary" className="text-[10px]">{roleLabel(role)}</Badge>)}</div></td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">{user.clinicIds.length ? user.clinicIds.map((id) => CLINICS.find((clinic) => clinic.id === id)?.name).join(", ") : tr("Dane zagregowane", "Сводные данные")}</td>
                  <td className="px-3 py-3"><Badge variant="outline" className={STATUS_TONE[user.status]}>{statusLabel(user.status)}</Badge></td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">{user.lastLoginAt ? formatRelative(user.lastLoginAt, language) : tr("Nigdy", "Никогда")}</td>
                  <td className="px-4 py-3">{renderActions(user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RolePermissionMatrix />

      <UserDialog open={createOpen || Boolean(editing)} title={editing ? tr("Edytuj dostęp", "Изменить доступ") : tr("Dodaj użytkownika", "Добавить пользователя")} draft={draft} setDraft={setDraft} toggleClinic={toggleClinic} onClose={() => { setCreateOpen(false); setEditing(null) }} onSave={() => {
        if (editing) { setError(""); setPendingAction({ type: "access", user: editing, roles: [...draft.roles], clinicIds: [...draft.clinics] }); setEditing(null) } else submitCreate()
      }} editing={Boolean(editing)} error={error} />

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{tr("Potwierdź operację bezpieczeństwa", "Подтвердите операцию безопасности")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingAction?.type === "password" && tr(`Zarejestrować prośbę o reset hasła dla ${pendingAction.user.name}? To emulacja; żaden link ani e-mail nie zostanie wysłany.`, `Зарегистрировать запрос на сброс пароля для ${pendingAction.user.name}? Это эмуляция: ссылка и письмо не отправляются.`)}
            {pendingAction?.type === "sessions" && tr(`Zarejestrować odwołanie sesji użytkownika ${pendingAction.user.name}? Rzeczywiste sesje obsłuży przyszły backend.`, `Зарегистрировать завершение сеансов пользователя ${pendingAction.user.name}? Реальные сеансы будет обрабатывать будущий бэкенд.`)}
            {pendingAction?.type === "active" && (pendingAction.user.status === "inactive" ? tr(`Konto użytkownika ${pendingAction.user.name} zostanie ponownie aktywowane.`, `Учётная запись пользователя ${pendingAction.user.name} будет снова активирована.`) : tr(`Konto użytkownika ${pendingAction?.user.name} zostanie dezaktywowane, bez usuwania historii i przypisanych danych.`, `Учётная запись пользователя ${pendingAction?.user.name} будет деактивирована без удаления истории и назначенных данных.`))}
          </p>
          {pendingAction?.type === "access" && <p className="text-sm">{tr("Zmiana dostępu dla", "Изменение доступа для")} {pendingAction.user.name}: {tr("role", "роли")} {pendingAction.user.roles.map(roleLabel).join(", ")} → {pendingAction.roles?.map(roleLabel).join(", ") || tr("brak", "нет")}; {tr("kliniki", "клиники")} {pendingAction.user.clinicIds.join(", ") || tr("brak", "нет")} → {pendingAction.clinicIds?.join(", ") || tr("brak", "нет")}.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{tr("Operacja zostanie zapisana w dzienniku audytowym wraz z wykonującym ją administratorem.", "Операция и выполнивший её администратор будут сохранены в журнале аудита.")}</p>
          <DialogFooter><Button variant="ghost" onClick={() => setPendingAction(null)}>{tr("Anuluj", "Отмена")}</Button><Button onClick={confirmAction}>{tr("Potwierdź", "Подтвердить")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserDialog({ open, title, draft, setDraft, toggleClinic, onClose, onSave, editing, error }: { open: boolean; title: string; draft: { name: string; email: string; roles: RoleId[]; clinics: ClinicId[] }; setDraft: Dispatch<SetStateAction<{ name: string; email: string; roles: RoleId[]; clinics: ClinicId[] }>>; toggleClinic: (id: ClinicId) => void; onClose: () => void; onSave: () => void; editing: boolean; error: string }) {
  const { t, tr } = useLanguage()
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{tr("Imię i nazwisko", "Имя и фамилия")}</Label><Input value={draft.name} disabled={editing} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /></div><div className="space-y-1.5"><Label>{tr("E-mail służbowy", "Рабочий e-mail")}</Label><Input type="email" value={draft.email} disabled={editing} onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))} /></div></div>
    <div className="space-y-2"><Label>{tr("Role", "Роли")}</Label><div className="grid gap-2 sm:grid-cols-2">{ROLE_ORDER.map((role) => <label key={role} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"><input type="checkbox" checked={draft.roles.includes(role)} onChange={() => setDraft((prev) => ({ ...prev, roles: prev.roles.includes(role) ? prev.roles.filter((id) => id !== role) : [...prev.roles, role] }))} />{t(ROLE_PROFILES[role].labelKey)}</label>)}</div></div>
    <div className="space-y-2"><Label>{tr("Zakres klinik", "Доступ к клиникам")}</Label><div className="grid gap-2 sm:grid-cols-3">{CLINICS.map((clinic) => <label key={clinic.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"><input type="checkbox" checked={draft.clinics.includes(clinic.id)} onChange={() => toggleClinic(clinic.id)} />{clinic.name}</label>)}</div></div>
    {!editing && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{tr("Nowe konto otrzyma status „Zaproszony”. To emulacja: e-mail ani link nie jest wysyłany i żadne hasło nie jest tworzone.", "Новая учётная запись получит статус «Приглашён». Это эмуляция: письмо и ссылка не отправляются, пароль не создаётся.")}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div><DialogFooter><Button variant="ghost" onClick={onClose}>{tr("Anuluj", "Отмена")}</Button><Button disabled={!draft.name.trim() || !draft.email.trim()} onClick={onSave}>{editing ? tr("Zapisz dostęp", "Сохранить доступ") : tr("Wyślij zaproszenie", "Отправить приглашение")}</Button></DialogFooter></DialogContent></Dialog>
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
