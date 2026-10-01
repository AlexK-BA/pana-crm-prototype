"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { KeyRound, Laptop2, Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUserDirectory, type AppUser } from "@/lib/crm/user-directory"
import { ROLE_ORDER, ROLE_PROFILES, type RoleId } from "@/lib/crm/roles"
import { CLINICS } from "@/lib/crm/catalog"
import type { ClinicId } from "@/lib/crm/entities"
import { formatRelative } from "@/lib/crm/format"
import { RolePermissionMatrix } from "@/components/crm/role-permission-matrix"

const STATUS_LABEL = { invited: "Zaproszony", active: "Aktywny", inactive: "Nieaktywny", locked: "Zablokowany" }
const STATUS_TONE = { invited: "border-sky-200 bg-sky-50 text-sky-700", active: "border-emerald-200 bg-emerald-50 text-emerald-700", inactive: "border-slate-200 bg-slate-50 text-slate-600", locked: "border-red-200 bg-red-50 text-red-700" }

export function UserManagementView() {
  const { users, createUser, setActive, requestPasswordReset, revokeSessions, updateAccess } = useUserDirectory()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [draft, setDraft] = useState({ name: "", email: "", role: "operator" as RoleId, clinics: ["pana-medica"] as ClinicId[] })

  const visible = useMemo(() => users.filter((user) => {
    const matchesQuery = !query || `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === "all" || user.status === status)
  }), [query, status, users])

  function notify(text: string) {
    setMessage(text)
    setTimeout(() => setMessage(""), 2500)
  }

  function openCreate() {
    setDraft({ name: "", email: "", role: "operator", clinics: ["pana-medica"] })
    setCreateOpen(true)
  }

  function submitCreate() {
    if (!draft.name.trim() || !draft.email.trim()) return
    createUser({ name: draft.name.trim(), email: draft.email.trim(), roles: [draft.role], clinicIds: draft.clinics })
    setCreateOpen(false)
    notify("Użytkownik został zaproszony. Hasło nie jest generowane ani wyświetlane w CRM.")
  }

  function toggleClinic(clinicId: ClinicId) {
    setDraft((prev) => ({ ...prev, clinics: prev.clinics.includes(clinicId) ? prev.clinics.filter((id) => id !== clinicId) : [...prev.clinics, clinicId] }))
  }

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
        {message && <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">{message}</div>}
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
                    <Button size="icon" variant="ghost" aria-label="Edytuj role i kliniki" onClick={() => { setEditing(user); setDraft({ name: user.name, email: user.email, role: user.roles[0], clinics: user.clinicIds }) }}><ShieldCheck className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Resetuj hasło" onClick={() => { requestPasswordReset(user.id); notify(`Wysłano instrukcję resetu hasła do ${user.email}.`) }}><KeyRound className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Zakończ sesje" onClick={() => { revokeSessions(user.id); notify(`Aktywne sesje użytkownika ${user.name} zostały zakończone.`) }}><Laptop2 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" disabled={user.id === "usr-mk"} aria-label={user.status === "inactive" ? "Aktywuj" : "Dezaktywuj"} onClick={() => { const active = user.status === "inactive"; setActive(user.id, active); notify(active ? "Konto aktywowano." : "Konto dezaktywowano, a sesje zakończono.") }}>{user.status === "inactive" ? <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> : <UserX className="h-3.5 w-3.5 text-amber-600" />}</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RolePermissionMatrix />

      <UserDialog open={createOpen || Boolean(editing)} title={editing ? "Edytuj dostęp" : "Dodaj użytkownika"} draft={draft} setDraft={setDraft} toggleClinic={toggleClinic} onClose={() => { setCreateOpen(false); setEditing(null) }} onSave={() => {
        if (editing) { updateAccess(editing.id, [draft.role], draft.clinics); setEditing(null); notify("Zaktualizowano role i zakres klinik.") } else submitCreate()
      }} editing={Boolean(editing)} />
    </div>
  )
}

function UserDialog({ open, title, draft, setDraft, toggleClinic, onClose, onSave, editing }: { open: boolean; title: string; draft: { name: string; email: string; role: RoleId; clinics: ClinicId[] }; setDraft: Dispatch<SetStateAction<{ name: string; email: string; role: RoleId; clinics: ClinicId[] }>>; toggleClinic: (id: ClinicId) => void; onClose: () => void; onSave: () => void; editing: boolean }) {
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Imię i nazwisko</Label><Input value={draft.name} disabled={editing} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /></div><div className="space-y-1.5"><Label>E-mail służbowy</Label><Input type="email" value={draft.email} disabled={editing} onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))} /></div></div>
    <div className="space-y-1.5"><Label>Rola</Label><Select value={draft.role} onValueChange={(value) => setDraft((prev) => ({ ...prev, role: value as RoleId }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_ORDER.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Zakres klinik</Label><div className="grid gap-2 sm:grid-cols-3">{CLINICS.map((clinic) => <label key={clinic.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"><input type="checkbox" checked={draft.clinics.includes(clinic.id)} onChange={() => toggleClinic(clinic.id)} />{clinic.name}</label>)}</div></div>
    {!editing && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Nowe konto otrzyma status „Zaproszony”. System wyśle bezpieczny link ustanowienia hasła. Administrator nie zna hasła użytkownika.</p>}
  </div><DialogFooter><Button variant="ghost" onClick={onClose}>Anuluj</Button><Button disabled={!draft.name.trim() || !draft.email.trim()} onClick={onSave}>{editing ? "Zapisz dostęp" : "Wyślij zaproszenie"}</Button></DialogFooter></DialogContent></Dialog>
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
