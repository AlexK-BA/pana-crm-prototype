"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { PatientConversationWorkspace } from "@/components/crm/patient-conversation-workspace"
import { Patient360Actions } from "@/components/crm/patient-360-actions"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useCall } from "@/lib/crm/call-context"
import { selectPatient360, isCaseActive, patientTaskGroup } from "@/lib/crm/patient-360-selectors"
import { isOverdue } from "@/lib/crm/entity-queue"
import { getClinic, getClinicTone, getProcedure, getDoctor } from "@/lib/crm/catalog"
import { BOARD_COLUMNS } from "@/lib/crm/boards"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { getSmsStatusLabel, isSmsMessage } from "@/lib/crm/sms-service"
import { cn } from "@/lib/utils"

const integration: Record<string, string> = { linked: "Powiązano", match_suggested: "Sugerowane dopasowanie", conflict: "Konflikt", sync_pending: "Synchronizacja w toku", sync_failed: "Medical CRM niedostępne / błąd sync", unlinked: "Niepowiązano" }
const taskGroups = { overdue: "Przeterminowane", today: "Na dziś", upcoming: "Nadchodzące", completed: "Zakończone", cancelled: "Anulowane", failed: "Nieudane" }

/** Same Patient route/profile; every section is a scoped projection of canonical records. */
export function PatientProfile({ patientId }: { patientId: string }) {
  const store = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  if (!hasPermission("patient:view_basic")) return <div role="alert" className="rounded border p-6">Brak dostępu do Patient 360.</div>
  if (!store.patients.some(item => item.id === patientId)) return <div role="status" className="rounded border p-6">Pacjent nie został znaleziony lub jest poza zakresem Twoich klinik.</div>
  return <PatientWorkspace patientId={patientId} />
}
function PatientWorkspace({ patientId }: { patientId: string }) {
  const store = useScopedEntityStore()
  const view = selectPatient360(patientId, store)
  const patient = view.patient!
  const { hasPermission } = useAuthorization()
  const { users } = useUserDirectory()
  const { openCase } = useCasePanel()
  const { startOutgoingCall } = useCall()
  const [section, setSection] = useState("overview")
  const [communicationCase, setCommunicationCase] = useState("")
  const [communicationSms, setCommunicationSms] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [commentCase, setCommentCase] = useState("")
  const [comment, setComment] = useState("")
  const primaryCase = view.cases.find(item => item.id === view.nextTask?.caseId) ?? view.cases.find(isCaseActive) ?? view.cases[0]
  const phone = view.identities.find(item => item.channel === "phone" && item.isPrimary) ?? view.identities.find(item => item.channel === "phone")
  const email = view.identities.find(item => item.channel === "email" && item.isPrimary) ?? view.identities.find(item => item.channel === "email")
  const name = `${patient.firstName} ${patient.lastName}`
  const actor = (id?: string) => id === "system" ? "System" : users.find(item => item.id === id)?.name ?? id ?? "Nieprzypisane"
  const latest = view.activity[0]?.at
  const currentMatches = view.matches.filter(item => ["pending", "conflict"].includes(item.status))
  function command(work: () => void) { try { setError(""); setNotice(""); work() } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się wykonać operacji.") } }
  function communication(caseId = primaryCase?.id ?? "", sms = false) { setCommunicationCase(caseId); setCommunicationSms(sms); setSection("communications") }
  const detail = (label: string, value: React.ReactNode) => <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || "Brak danych"}</dd></div>
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5">
    <header className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0 space-y-2"><h2 className="break-words text-xl font-semibold">{name}</h2><p className="break-all text-xs text-muted-foreground">Patient ID: {patient.id} · External Medical CRM ID: {patient.externalPatientId ?? "Brak"}</p>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{getClinic(patient.primaryClinicId)?.name}</Badge><Badge variant="outline">{integration[patient.integrationState]}</Badge><Badge variant="secondary">{patient.externalPatientId ? "Istniejący w Medical CRM" : "Nowy / niepowiązany z Medical CRM"}</Badge>{!patient.contactable && <Badge variant="destructive">Nie kontaktować</Badge>}{view.overdue.length > 0 && <Badge variant="destructive">{view.overdue.length} przeterminowanych</Badge>}</div>
        </div>
        <div className="space-y-1 text-xs"><p>Odpowiedzialny: {actor(patient.careOwnerId ?? primaryCase?.responsibleTeamId)}</p><p>Język: {patient.preferredLanguage.toUpperCase()}</p><p>Ostatnia aktywność: {latest ? formatRelative(latest) : "Brak"}</p><p>Sync: {patient.lastSyncAt ? formatDateTime(patient.lastSyncAt) : "Nie synchronizowano"}</p></div>
      </div>
      <p className="break-all text-sm">Telefon: {phone?.value ?? "Brak"} · E-mail: {email?.value ?? "Brak"}</p>
      <div className="flex flex-wrap gap-1">{patient.localTags?.map(tag => <Badge key={tag} variant="outline" className="max-w-full break-all whitespace-normal">{tag}</Badge>)}</div>
      <p className="text-sm"><strong>Następne działanie:</strong> {view.nextTask ? `${view.nextTask.title} · ${view.nextTask.dueAt ? formatDateTime(view.nextTask.dueAt) : "Bez terminu"}` : "Nie ustalono — utwórz zadanie we właściwej sprawie"}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!hasPermission("call:handle") || !primaryCase || !phone} onClick={() => command(() => { if (primaryCase) startOutgoingCall({ caseId: primaryCase.id, taskId: view.nextTask?.id, contactIdentityId: phone?.id }) })}>Zadzwoń</Button>
        <Button size="sm" variant="outline" disabled={!hasPermission("communication:view") || !hasPermission("communication:send") || !hasPermission("sms:send_custom")} onClick={() => communication("", true)}>Wyślij SMS</Button>
        <Button size="sm" variant="outline" disabled={!hasPermission("communication:view")} onClick={() => communication()}>Otwórz komunikacje</Button>
        {hasPermission("patient:view_medical") && hasPermission("patient:edit_local") && <Button size="sm" variant="outline" onClick={() => command(() => { store.syncPatientWithMedicalCrm(patient.id, store.currentUser.id); setNotice("Zakończono emulację synchronizacji (bez API).") })}>Synchronizuj Medical CRM · demo</Button>}
      </div>
      <Patient360Actions patientId={patientId} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    </header>
    {currentMatches.length > 0 && <div role="status" className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">Patient Matching wymaga weryfikacji.{currentMatches.map(item => <p key={item.id}>{item.status === "conflict" ? "Conflict" : "Matching pending"} · <button className="underline" onClick={() => openCase(item.caseId)}>{item.caseId}</button></p>)}</div>}
    <Tabs value={section} onValueChange={setSection}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="overview">Przegląd</TabsTrigger>{hasPermission("case:view") && <TabsTrigger value="cases">Sprawy ({view.cases.length})</TabsTrigger>}{hasPermission("task:view") && <TabsTrigger value="tasks">Zadania ({view.tasks.length})</TabsTrigger>}
        {hasPermission("communication:view") && <TabsTrigger value="communications">Komunikacje</TabsTrigger>}{(hasPermission("communication:view") || hasPermission("audit:view")) && <TabsTrigger value="activity">Activity Timeline</TabsTrigger>}
        {hasPermission("case:view") && <TabsTrigger value="comments">Komentarze ({view.comments.length})</TabsTrigger>}{hasPermission("patient:view_medical") && <TabsTrigger value="medical">Medical CRM</TabsTrigger>}
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        <section className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">Patient 360 · podsumowanie</h3><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {detail("Kontakty", `${phone?.value ?? "Brak telefonu"} / ${email?.value ?? "Brak e-mailu"}`)}{detail("Klinika", getClinic(patient.primaryClinicId)?.name)}{detail("Lekarz w bieżącej sprawie", getDoctor(primaryCase?.doctorId)?.name)}{detail("Procedura", getProcedure(primaryCase?.serviceInterest)?.name)}
          {detail("Pierwsze zgłoszenie", view.firstTouch ? formatDateTime(view.firstTouch.at) : undefined)}{detail("First-touch source (immutable)", view.firstTouch ? `${view.firstTouch.source} · ${view.firstTouch.channel}` : undefined)}
          {detail("Aktywne sprawy", view.cases.filter(isCaseActive).length.toString())}{detail("Najbliższa czynność", view.nextTask?.title)}{detail("Przeterminowane zadania", view.overdue.length.toString())}{detail("Ostatnie wykonane działanie", view.lastAction ? `${view.lastAction.type} · ${formatDateTime(view.lastAction.at)}` : undefined)}{detail("Ostatnia wiadomość przychodząca", view.lastIncoming?.text ?? view.lastIncoming?.type)}
          {hasPermission("patient:view_medical") && detail("Plan leczenia", patient.treatmentPlan ? `v${patient.treatmentPlan.version} · ${patient.treatmentPlan.status}` : "Brak planu z Medical CRM")}
        </dl></section>
        <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">Kanały kontaktu</h3>{view.identities.length === 0 && <p className="text-sm text-muted-foreground">Brak kontaktów.</p>}{view.identities.map(item => <div key={item.id} className="flex flex-wrap gap-2 text-sm"><strong>{item.channel}</strong><span className="break-all">{item.displayName ?? item.value} {item.displayName && `· ${item.value}`}</span><Badge variant="outline">{item.verified ? "Zweryfikowany · read-only" : "Lokalny / niezweryfikowany"}</Badge>{!item.patientId && <Badge variant="outline">Unlinked contact</Badge>}</div>)}<p className="whitespace-pre-wrap break-words text-sm">{patient.localNote || "Brak lokalnej notatki."}</p></section>
      </TabsContent>
      {hasPermission("case:view") && <TabsContent value="cases" className="space-y-3">
        {!view.cases.length && <p className="rounded border p-4 text-sm">Pacjent nie ma spraw. Utwórz nowy Engagement Case z istniejącą identity.</p>}
        {view.cases.map(item => {
          const caseTasks = view.tasks.filter(task => task.caseId === item.id)
          const next = caseTasks.find(task => !["completed", "cancelled", "failed"].includes(task.status))
          const last = view.interactions.find(interaction => interaction.caseId === item.id)
          const unread = view.threads.filter(thread => thread.caseId === item.id).reduce((sum, thread) => sum + thread.unread, 0)
          const matching = view.matches.filter(decision => decision.caseId === item.id).at(-1)
          return <article key={item.id} className={cn("space-y-3 rounded-lg border-l-4 bg-card p-4", getClinicTone(item.clinicId).chip)}>
            <div className="flex flex-wrap justify-between gap-2"><strong>{item.id} · {item.board}</strong><span>{BOARD_COLUMNS[item.board].find(stage => stage.id === item.status)?.label ?? item.status} · {isCaseActive(item) ? "Active" : "Closed"}</span></div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{detail("Klinika / usługa", `${getClinic(item.clinicId)?.name ?? "Nieprzypisana"} / ${getProcedure(item.serviceInterest)?.name ?? "Brak"}`)}{detail("Lekarz", getDoctor(item.doctorId)?.name)}{detail("Źródło / kanał", `${item.attribution.caseCreationTouch.source} / ${item.attribution.caseCreationTouch.channel}`)}{detail("Odpowiedzialny", actor(item.responsibleTeamId))}{detail("Utworzono", formatDateTime(item.createdAt))}{detail("Ostatnie działanie", last ? `${last.type} · ${formatDateTime(last.at)}` : undefined)}{detail("Następna czynność / zadanie", next ? `${next.title} · ${next.dueAt ? formatDateTime(next.dueAt) : "Bez terminu"}` : "Nie ustalono")}{detail("Patient Link / unread", `${matching?.decision ?? "Linked"} / ${unread}`)}</dl>
            {caseTasks.some(task => isOverdue(task)) && <Badge variant="destructive">Przeterminowane zadanie</Badge>}
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openCase(item.id)}>Otwórz drawer</Button>{hasPermission("communication:view") && <Button size="sm" variant="outline" onClick={() => communication(item.id)}>Komunikacja sprawy</Button>}<Patient360Actions patientId={patientId} caseId={item.id} /></div>
          </article>
        })}
      </TabsContent>}
      {hasPermission("task:view") && <TabsContent value="tasks" className="space-y-4">
        {!view.tasks.length && <p className="rounded border p-4 text-sm">Brak zadań pacjenta.</p>}
        {Object.entries(taskGroups).map(([group, label]) => {
          const tasks = view.tasks.filter(item => patientTaskGroup(item) === group)
          return <section key={group} className="space-y-2"><h3 className="font-semibold">{label} ({tasks.length})</h3>{tasks.map(task => <article key={task.id} className="space-y-2 rounded border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{task.priority} · {task.title}</strong><span>{task.dueAt ? formatDateTime(task.dueAt) : "Bez terminu"}</span></div>
            <p>{task.caseId} · {task.status} · owner: {actor(task.ownerId)} · typ: {task.requiresCall ? "Call" : task.workflowRuleId ?? "Operacyjny"} · requiresCall: {task.requiresCall ? "Tak" : "Nie"} · próby: {task.attempts}</p>
            <p>Ostatnie: {task.outcome ?? task.skipReason ?? "Brak wyniku"} · Następne: {["completed", "cancelled", "failed"].includes(task.status) ? "Zachowane w historii" : task.requiresCall ? "Połączenie + disposition w wrap-up" : task.title}</p>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openCase(task.caseId)}>Sprawa</Button>
              {hasPermission("task:work") && !["completed", "cancelled", "failed"].includes(task.status) && (task.requiresCall ? <Button size="sm" disabled={!hasPermission("call:handle")} onClick={() => command(() => startOutgoingCall({ caseId: task.caseId, taskId: task.id, contactIdentityId: phone?.id }))}>Zadzwoń / wrap-up</Button> : <Button size="sm" onClick={() => command(() => store.completePatientTask(task.id))}>Zakończ czynność</Button>)}
            </div>
          </article>)}</section>
        })}
      </TabsContent>}
      {hasPermission("communication:view") && <TabsContent value="communications"><div className="h-[min(760px,80vh)] min-h-[460px] overflow-hidden rounded-xl border"><PatientConversationWorkspace key={`${patientId}/${communicationCase}/${communicationSms}`} patientId={patientId} currentCaseId={communicationCase || primaryCase?.id || ""} authorId={store.currentUser.id} initialView={communicationSms ? "sms" : undefined} /></div></TabsContent>}
      {(hasPermission("communication:view") || hasPermission("audit:view")) && <TabsContent value="activity" className="space-y-2">
        {!view.activity.length && <p className="p-4 text-sm text-muted-foreground">Brak aktywności w dozwolonym zakresie.</p>}
        {view.activity.map(entry => <article key={entry.id} className="space-y-1 rounded border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{entry.interaction ? `${entry.interaction.type} · ${entry.interaction.direction ?? "System"}` : "Operacja CRM"}</strong><span className="text-xs">{formatDateTime(entry.at)}</span></div><p className="whitespace-pre-wrap break-words">{entry.interaction?.text ?? entry.events[0]?.summary ?? "Połączenie"}</p>{entry.interaction && <p className="text-xs">{actor(entry.interaction.authorId)} {isSmsMessage(entry.interaction) && `· ${getSmsStatusLabel(entry.interaction)}`}</p>}{entry.caseId && <button className="text-xs underline" onClick={() => openCase(entry.caseId!)}>{entry.caseId}</button>}{entry.events.length > 0 && <details className="text-xs"><summary>{entry.events.length} powiązanych zdarzeń audit · jedna operacja</summary>{entry.events.map(event => <p key={event.id}>{actor(event.actorId)} · {event.summary}</p>)}</details>}</article>)}
      </TabsContent>}
      {hasPermission("case:view") && <TabsContent value="comments" className="space-y-3">
        {hasPermission("case:edit") && <div className="space-y-2 rounded border p-3"><select aria-label="Sprawa komentarza" className="max-w-full rounded border bg-background p-2 text-sm" value={commentCase} onChange={event => setCommentCase(event.target.value)}><option value="">Wybierz sprawę komentarza</option>{view.cases.map(item => <option key={item.id}>{item.id}</option>)}</select><Textarea aria-label="Komentarz pracownika" value={comment} onChange={event => setComment(event.target.value)} /><Button size="sm" disabled={!comment.trim() || !commentCase} onClick={() => command(() => { store.addCaseComment(commentCase, comment); setComment("") })}>Dodaj komentarz</Button></div>}
        {!view.comments.length && <p className="text-sm text-muted-foreground">Brak komentarzy pracowników.</p>}{view.comments.map(item => <article key={item.id} className="rounded border p-3 text-sm"><p className="text-xs">{actor(item.authorId)} · {formatDateTime(item.at)} · <button className="underline" onClick={() => openCase(item.caseId)}>{item.caseId}</button></p><p className="whitespace-pre-wrap break-words">{item.text}</p></article>)}
      </TabsContent>}
      {hasPermission("patient:view_medical") && <TabsContent value="medical" className="space-y-4"><section className="space-y-3 rounded border p-4"><h3 className="font-semibold">Medical CRM · read-only</h3><p className="text-xs text-muted-foreground">Primary source of truth. Brak lokalnej edycji danych medycznych.</p><dl className="grid gap-4 sm:grid-cols-2">{detail("External Patient ID", patient.externalPatientId)}{detail("Integration state", integration[patient.integrationState])}{detail("Ostatnia synchronizacja", patient.lastSyncAt ? formatDateTime(patient.lastSyncAt) : undefined)}{detail("PESEL", patient.pesel)}{detail("Klinika", getClinic(patient.primaryClinicId)?.name)}{detail("Medical summary", "Brak oddzielnego summary w obecnej projekcji Medical CRM")}</dl>
        {["sync_failed", "unlinked", "sync_pending"].includes(patient.integrationState) && <p role="status" className="text-amber-700">{integration[patient.integrationState]} — dane mogą być nieaktualne lub niedostępne.</p>}
        {patient.conflicts?.map(item => <p key={item.field} className="break-words text-sm text-destructive">Konflikt {item.field}: {item.localValue} / Medical CRM: {item.medicalValue}</p>)}
        {patient.treatmentPlan ? <div className="space-y-2"><h4 className="font-medium">Plan leczenia v{patient.treatmentPlan.version} · {patient.treatmentPlan.status}</h4>{patient.treatmentPlan.items.map(item => <p key={item.id}>{item.name} {item.price !== undefined && `${item.price} ${patient.treatmentPlan?.currency}`}</p>)}<p>Razem: {patient.treatmentPlan.totalValue} {patient.treatmentPlan.currency}</p><p>Dokument: {patient.treatmentPlan.documentName ?? "Brak dokumentu"}</p>{primaryCase && hasPermission("task:work") && <Button size="sm" variant="outline" onClick={() => command(() => { store.sendTreatmentPlanTask(patientId, primaryCase.id, store.currentUser.id); setNotice("Utworzono istniejące zadanie wysyłki planu.") })}>Utwórz zadanie wysyłki planu</Button>}</div> : <p className="text-sm text-muted-foreground">Brak planu leczenia / dokumentów z Medical CRM.</p>}
        <h4 className="font-medium">Lekarze i procedury powiązanych spraw</h4>{view.cases.map(item => <p key={item.id} className="text-sm">{item.id} · {getDoctor(item.doctorId)?.name ?? "Brak lekarza"} · {getProcedure(item.serviceInterest)?.name ?? "Brak procedury"}</p>)}
        <h4 className="font-medium">Pochodzenie dostępnych danych</h4>{patient.provenance.map((item, index) => <p key={`${item.field}/${index}`} className="break-words text-xs">{item.field}: {item.value} · {item.source}</p>)}
      </section></TabsContent>}
    </Tabs>
  </div>
}
