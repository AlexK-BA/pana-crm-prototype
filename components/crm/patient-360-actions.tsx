"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useCasePanel } from "@/lib/crm/panel-context"
import { CLINICS, PROCEDURES } from "@/lib/crm/catalog"
import type { CaseBoard, ClinicId, ContactChannel, TaskPriority } from "@/lib/crm/entities"

const channels: ContactChannel[] = ["phone", "email", "website", "whatsapp", "instagram", "facebook", "telegram", "tiktok", "viber", "personal_account"]
export function Patient360Actions({ patientId, caseId, contactOnly = false }: { patientId: string; caseId?: string; contactOnly?: boolean }) {
  const store = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { openCase } = useCasePanel()
  const patient = store.patients.find(item => item.id === patientId)
  const cases = store.cases.filter(item => item.patientId === patientId)
  const identities = store.identities.filter(item => item.patientId === patientId)
  const [action, setAction] = useState<"case" | "task" | "contact" | "local" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [clinicId, setClinicId] = useState(patient?.primaryClinicId ?? "pana-medica")
  const [identityId, setIdentityId] = useState("")
  const [selectedCase, setSelectedCase] = useState(caseId ?? "")
  const [board, setBoard] = useState<CaseBoard>("leads")
  const [service, setService] = useState("")
  const [title, setTitle] = useState("")
  const [due, setDue] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("P2")
  const [requiresCall, setRequiresCall] = useState(false)
  const [channel, setChannel] = useState<ContactChannel>("phone")
  const [value, setValue] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [tags, setTags] = useState("")
  const [note, setNote] = useState("")
  function begin(kind: NonNullable<typeof action>) {
    setAction(kind); setError(""); setNotice(""); setSelectedCase(caseId ?? ""); setIdentityId(""); setValue(""); setDisplayName("")
    setTags(patient?.localTags?.join(", ") ?? ""); setNote(patient?.localNote ?? ""); setService("")
  }
  function save() {
    try {
      if (action === "case") {
        const identity = identities.find(item => item.id === identityId)
        if (!identity) throw new Error("Wybierz istniejący kontakt pacjenta.")
        const created = store.createPatientCase({ patientId, contactIdentityId: identityId, channel: identity.channel, clinicId, serviceInterest: service || undefined, board })
        setAction(null); openCase(created.id); return
      }
      if (action === "task") store.createPatientTask({ caseId: selectedCase, title, dueAt: due, priority, requiresCall })
      if (action === "local") store.updatePatientLocal(patientId, { localTags: tags.split(","), localNote: note })
      if (action === "contact") {
        const result = store.addPatientContact({ patientId, caseId: selectedCase || undefined, channel, value, displayName })
        if (result.conflictCaseId) { setAction(null); setNotice("Kontakt konfliktowy — skierowano do Patient Matching bez przeniesienia identity."); openCase(result.conflictCaseId); return }
      }
      setAction(null); setNotice("Zapisano.")
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać.") }
  }
  const titles = { case: "Nowa sprawa tego pacjenta", task: "Nowe zadanie w wybranej sprawie", contact: "Dodaj lokalny kontakt", local: "Lokalne tagi i notatka" }
  const selectClass = "w-full rounded-md border border-input bg-background p-2 text-sm"
  const casePicker = <label className="grid gap-1 text-sm">Sprawa<select aria-label="Sprawa" className={selectClass} value={selectedCase} onChange={event => setSelectedCase(event.target.value)}><option value="">{action === "contact" ? "Kontakt pacjenta bez konkretnej sprawy" : "Wybierz sprawę"}</option>{cases.map(item => <option key={item.id} value={item.id}>{item.id} · {item.status}</option>)}</select></label>
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {!contactOnly && hasPermission("case:edit") && <Button size="sm" variant="outline" onClick={() => begin("case")}>Utwórz sprawę</Button>}
      {!contactOnly && hasPermission("case:edit") && hasPermission("task:work") && <Button size="sm" variant="outline" onClick={() => begin("task")}>Utwórz zadanie</Button>}
      {hasPermission("patient:edit_local") && <Button size="sm" variant="outline" onClick={() => begin("contact")}>Dodaj kontakt</Button>}
      {!contactOnly && hasPermission("patient:edit_local") && <Button size="sm" variant="outline" onClick={() => begin("local")}>Edytuj pola lokalne</Button>}
    </div>
    {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    <Dialog open={Boolean(action)} onOpenChange={open => { if (!open) setAction(null) }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{action ? titles[action] : "Patient 360"}</DialogTitle></DialogHeader>
        {action === "case" && <>
          <label className="grid gap-1 text-sm">Kontakt / kanał<select className={selectClass} value={identityId} onChange={event => setIdentityId(event.target.value)}><option value="">Wybierz istniejącą identity</option>{identities.map(item => <option key={item.id} value={item.id}>{item.channel} · {item.value}</option>)}</select></label>
          {identities.length === 0 && <p className="text-sm">Brak kontaktów. Najpierw dodaj lokalną identity.</p>}
          <label className="grid gap-1 text-sm">Klinika<select className={selectClass} value={clinicId} onChange={event => { setClinicId(event.target.value as ClinicId); setService("") }}>{CLINICS.filter(item => store.currentUser.roles.includes("admin") || store.currentUser.roles.includes("team_leader") || store.currentUser.clinicIds.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Usługa<select className={selectClass} value={service} onChange={event => setService(event.target.value)}><option value="">Nie określono</option>{PROCEDURES.filter(item => item.clinicId === clinicId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Początkowy lejek<select className={selectClass} value={board} onChange={event => setBoard(event.target.value as CaseBoard)}><option value="leads">Leads · New</option><option value="deals">Deals · Scheduled</option><option value="patients">Patients · New patient</option></select></label>
          <p className="text-xs text-muted-foreground">Patient i pierwszy kontakt pozostają bez zmian. Zadanie startowe powstaje według istniejącej reguły workflow.</p>
        </>}
        {action === "task" && <>{casePicker}<label className="grid gap-1 text-sm">Tytuł<Input value={title} onChange={event => setTitle(event.target.value)} /></label><label className="grid gap-1 text-sm">Termin<Input type="datetime-local" value={due} onChange={event => setDue(event.target.value)} /></label><label className="grid gap-1 text-sm">Priorytet<select className={selectClass} value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>{["P0", "P1", "P2", "P3", "P4"].map(item => <option key={item}>{item}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresCall} onChange={event => setRequiresCall(event.target.checked)} />Wymaga połączenia i obowiązkowego wrap-up</label></>}
        {action === "contact" && <>{casePicker}<label className="grid gap-1 text-sm">Kanał<select className={selectClass} value={channel} onChange={event => setChannel(event.target.value as ContactChannel)}>{channels.map(item => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1 text-sm">Telefon / e-mail / handle<Input value={value} onChange={event => setValue(event.target.value)} /></label><label className="grid gap-1 text-sm">Display name<Input value={displayName} onChange={event => setDisplayName(event.target.value)} /></label><p className="text-xs text-muted-foreground">Dodawany kontakt jest lokalny i niezweryfikowany. Potwierdzone kontakty Medical CRM pozostają read-only; konflikt wymaga Patient Matching.</p></>}
        {action === "local" && <><label className="grid gap-1 text-sm">Tagi oddzielone przecinkami<Input value={tags} onChange={event => setTags(event.target.value)} /></label><label className="grid gap-1 text-sm">Notatka operacyjna<Textarea value={note} onChange={event => setNote(event.target.value)} /></label><p className="text-xs text-muted-foreground">Wyłącznie lokalna CRM. Nie zmienia danych medycznych ani tożsamości Patient.</p></>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setAction(null)}>Anuluj</Button><Button onClick={save}>Zapisz</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
