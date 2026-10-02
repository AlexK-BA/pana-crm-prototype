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

const STATUS_LABEL = { invited: "Zaproszony", active: "Aktywny", inactive: "Nieaktywny", locked: "Zablokowany" }
const STATUS_TONE = { invited: "border-sky-200 bg-sky-50 text-sky-700", active: "border-emerald-200 bg-emerald-50 text-emerald-700", inactive: "border-slate-200 bg-slate-50 text-slate-600", locked: "border-red-200 bg-red-50 text-red-700" }

export function UserManagementView() {
  const { users, currentUser, createUser, setActive, requestPasswordReset, revokeSessions, updateAccess } = useUserDirectory()
  const { hasPermission } = useAuthorization()
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
      notify("Użytkownik został zaproszony (demo). E-mail nie jest wysyłany; hasło nie jest generowane.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się utworzyć użytkownika.") }
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
        notify("Zarejestrowano prośbę o reset hasła (demo, bez e-maila i linku).")
      } else if (type === "sessions") {
        revokeSessions(user.id)
        notify(`Zarejestrowano odwołanie sesji użytkownika ${user.name} (demo).`)
      } else if (type === "access") {
        updateAccess(user.id, pendingAction.roles ?? [], pendingAction.clinicIds ?? [])
        notify("Zaktualizowano role i zakres klinik.")
      } else {
        const active = user.status === "inactive"
        setActive(user.id, active)
        notify(active ? "Konto aktywowano." : "Konto dezaktywowano, a sesje odwołano (demo).")
      }
      setError("")
      setPendingAction(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Operacja została odrzucona.") }
  }

  if (!hasPermission("users:manage")) return <p role="alert">Brak dostępu do zarządzania użytkownikami.</p>

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Wszyscy użytkownicy" value={users.length} />
        <Stat label="Aktywni" value={users.filter((user) => user.status === "active").length} />
        <Stat label="Nieaktywni" value={users.filter((user) => user.status === "inactive").length} />
        <Stat label="Administratorzy" value={users.filter((user) => user.roles.includes("admin")).length} />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">Użytkownicy aplikacji</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Konta są dezaktywowane, nigdy usuwane. Operacje bezpieczeństwa pozostają audytowalne.</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-3.5 w-3.5" />Dodaj użytkownika</Button>
        </div>
        <div className="flex gap-2 border-b border-border p-3">
          <div className="relative max-w-sm flex-1"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po imieniu lub e-mailu" className="pl-8" /></div>
          <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie statusy</SelectItem><SelectItem value="active">Aktywni</SelectItem><SelectItem value="inactive">Nieaktywni</SelectItem><SelectItem value="invited">Zaproszeni</SelectItem><SelectItem value="locked">Zablokowani</SelectItem></SelectContent></Select>
        </div>
        {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>}
        {message && <div role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">{message}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Użytkownik</th><th className="px-3 py-2.5 font-medium">Role</th><th className="px-3 py-2.5 font-medium">Zakres klinik</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Ostatnie logowanie</th><th className="px-4 py-2.5 text-right font-medium">Działania</th></tr></thead>
            <tbody className="divide-y divide-border">
              {visible.map((user) => (
                <tr key={user.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3"><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{user.roles.map((role) => <Badge key={role} variant="secondary" className="text-[10px]">{ROLE_PROFILES[role].id}</Badge>)}</div></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{user.clinicIds.length ? user.clinicIds.map((id) => CLINICS.find((clinic) => clinic.id === id)?.name).join(", ") : "Dane zagregowane"}</td>
                  <td className="px-3 py-3"><Badge variant="outline" className={STATUS_TONE[user.status]}>{STATUS_LABEL[user.status]}</Badge></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{user.lastLoginAt ? formatRelative(user.lastLoginAt) : "Nigdy"}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger render={<Button size="icon" variant="ghost" disabled={user.id === currentUser.id} aria-label="Edytuj role i kliniki" onClick={() => { setError(""); setEditing(user); setDraft({ name: user.name, email: user.email, roles: [...user.roles], clinics: user.clinicIds }) }}><ShieldCheck className="h-3.5 w-3.5" /></Button>} />
                    <TooltipContent>Edytuj role i kliniki</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button size="icon" variant="ghost" aria-label="Resetuj hasło" onClick={() => { setError(""); setPendingAction({ type: "password", user }) }}><KeyRound className="h-3.5 w-3.5" /></Button>} />
                    <TooltipContent>Resetuj hasło</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button size="icon" variant="ghost" aria-label="Zakończ sesje" onClick={() => { setError(""); setPendingAction({ type: "sessions", user }) }}><Laptop2 className="h-3.5 w-3.5" /></Button>} />
                    <TooltipContent>Zakończ aktywne sesje</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button size="icon" variant="ghost" disabled={user.id === currentUser.id} aria-label={user.status === "inactive" ? "Aktywuj" : "Dezaktywuj"} onClick={() => { setError(""); setPendingAction({ type: "active", user }) }}>{user.status === "inactive" ? <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> : <UserX className="h-3.5 w-3.5 text-amber-600" />}</Button>} />
                    <TooltipContent>{user.status === "inactive" ? "Aktywuj konto" : "Dezaktywuj konto"}</TooltipContent>
                  </Tooltip>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RolePermissionMatrix />

      <UserDialog open={createOpen || Boolean(editing)} title={editing ? "Edytuj dostęp" : "Dodaj użytkownika"} draft={draft} setDraft={setDraft} toggleClinic={toggleClinic} onClose={() => { setCreateOpen(false); setEditing(null) }} onSave={() => {
        if (editing) { setError(""); setPendingAction({ type: "access", user: editing, roles: [...draft.roles], clinicIds: [...draft.clinics] }); setEditing(null) } else submitCreate()
      }} editing={Boolean(editing)} error={error} />

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Potwierdź operację bezpieczeństwa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingAction?.type === "password" && `Zarejestrować prośbę o reset hasła dla ${pendingAction.user.name}? To emulacja; żaden link ani e-mail nie zostanie wysłany.`}
            {pendingAction?.type === "sessions" && `Zarejestrować odwołanie sesji użytkownika ${pendingAction.user.name}? Rzeczywiste sesje obsłuży przyszły backend.`}
            {pendingAction?.type === "active" && (pendingAction.user.status === "inactive" ? `Konto użytkownika ${pendingAction.user.name} zostanie ponownie aktywowane.` : `Konto użytkownika ${pendingAction?.user.name} zostanie dezaktywowane, bez usuwania historii i przypisanych danych.`)}
          </p>
          {pendingAction?.type === "access" && <p className="text-sm">Zmiana dostępu dla {pendingAction.user.name}: role {pendingAction.user.roles.join(", ")} → {pendingAction.roles?.join(", ") || "brak"}; kliniki {pendingAction.user.clinicIds.join(", ") || "brak"} → {pendingAction.clinicIds?.join(", ") || "brak"}.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Operacja zostanie zapisana w dzienniku audytowym wraz z wykonującym ją administratorem.</p>
          <DialogFooter><Button variant="ghost" onClick={() => setPendingAction(null)}>Anuluj</Button><Button onClick={confirmAction}>Potwierdź</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserDialog({ open, title, draft, setDraft, toggleClinic, onClose, onSave, editing, error }: { open: boolean; title: string; draft: { name: string; email: string; roles: RoleId[]; clinics: ClinicId[] }; setDraft: Dispatch<SetStateAction<{ name: string; email: string; roles: RoleId[]; clinics: ClinicId[] }>>; toggleClinic: (id: ClinicId) => void; onClose: () => void; onSave: () => void; editing: boolean; error: string }) {
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Imię i nazwisko</Label><Input value={draft.name} disabled={editing} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /></div><div className="space-y-1.5"><Label>E-mail służbowy</Label><Input type="email" value={draft.email} disabled={editing} onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))} /></div></div>
    <div className="space-y-2"><Label>Role</Label><div className="grid gap-2 sm:grid-cols-2">{ROLE_ORDER.map((role) => <label key={role} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"><input type="checkbox" checked={draft.roles.includes(role)} onChange={() => setDraft((prev) => ({ ...prev, roles: prev.roles.includes(role) ? prev.roles.filter((id) => id !== role) : [...prev.roles, role] }))} />{role}</label>)}</div></div>
    <div className="space-y-2"><Label>Zakres klinik</Label><div className="grid gap-2 sm:grid-cols-3">{CLINICS.map((clinic) => <label key={clinic.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"><input type="checkbox" checked={draft.clinics.includes(clinic.id)} onChange={() => toggleClinic(clinic.id)} />{clinic.name}</label>)}</div></div>
    {!editing && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Nowe konto otrzyma status „Zaproszony”. To emulacja: e-mail ani link nie jest wysyłany i żadne hasło nie jest tworzone.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div><DialogFooter><Button variant="ghost" onClick={onClose}>Anuluj</Button><Button disabled={!draft.name.trim() || !draft.email.trim()} onClick={onSave}>{editing ? "Zapisz dostęp" : "Wyślij zaproszenie"}</Button></DialogFooter></DialogContent></Dialog>
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
