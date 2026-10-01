"use client"

import { useState } from "react"
import { notFound } from "next/navigation"
import { Phone, Mail, MessageSquare, Share2, StickyNote, FileText, AlertTriangle, RefreshCw, Send, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { getClinic, getClinicTone, getProcedure, getDoctor } from "@/lib/crm/catalog"
import { PatientConversationWorkspace } from "@/components/crm/patient-conversation-workspace"
import {
  getOperator,
  getCommentsForPatient,
  PRIORITY_TONE,
  priorityLabel,
} from "@/lib/crm/entity-selectors"
import { useEntityStore } from "@/lib/crm/entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useRole } from "@/lib/crm/role-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"
import { OPERATORS } from "@/lib/crm/data"
import type { Call } from "@/lib/crm/entities"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"
import { getQueue } from "@/lib/crm/entity-queue"

const CHANNEL_ICON: Record<string, typeof Phone> = {
  phone: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  telegram: MessageSquare,
  tiktok: Share2,
  viber: MessageSquare,
  instagram: Share2,
  facebook: Share2,
  website: Share2,
  personal_account: StickyNote,
}

const INTEGRATION_LABEL: Record<string, string> = {
  linked: "Powiązano",
  match_suggested: "Sugerowane dopasowanie",
  conflict: "Konflikt",
  sync_pending: "Synchronizacja w toku",
  sync_failed: "Błąd synchronizacji",
  unlinked: "Niepowiązano",
}

const INTEGRATION_TONE: Record<string, string> = {
  linked: "border-emerald-200 bg-emerald-50 text-emerald-700",
  match_suggested: "border-amber-200 bg-amber-50 text-amber-700",
  conflict: "border-red-200 bg-red-50 text-red-700",
  sync_pending: "border-sky-200 bg-sky-50 text-sky-700",
  sync_failed: "border-red-200 bg-red-50 text-red-700",
  unlinked: "border-slate-200 bg-slate-50 text-slate-600",
}

export function PatientProfile({ patientId }: { patientId: string }) {
  const {
    patients,
    cases: allCases,
    identities: allIdentities,
    tasks: allTasks,
    interactions: allInteractions,
    auditEvents,
    syncPatientWithMedicalCrm,
    sendTreatmentPlanTask,
  } = useEntityStore()
  const { openCase } = useCasePanel()
  const foundPatient = patients.find((item) => item.id === patientId)
  if (!foundPatient) return notFound()
  const patient = foundPatient

  const clinic = getClinic(patient.primaryClinicId)
  const careOwner = getOperator(patient.careOwnerId)
  const cases = allCases.filter((item) => item.patientId === patient.id)
  const caseIds = new Set(cases.map((item) => item.id))
  const identities = allIdentities.filter((item) => item.patientId === patient.id)
  const tasks = allTasks.filter((item) => item.patientId === patient.id || caseIds.has(item.caseId))
  const openTasks = getQueue(tasks)
  const interactions = allInteractions
    .filter((item) => item.patientId === patient.id || caseIds.has(item.caseId))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const comments = getCommentsForPatient(patient.id)
  const audit = auditEvents
    .filter((item) => item.patientId === patient.id || (item.caseId ? caseIds.has(item.caseId) : false))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const { role } = useRole()
  const meName = ROLE_PROFILES[role].user.name
  const actorId = OPERATORS.find((o) => o.name === meName)?.id ?? "system"
  const [justSynced, setJustSynced] = useState(false)
  const [planSent, setPlanSent] = useState(false)
  const primaryCase = cases[0]

  function handleSync() {
    syncPatientWithMedicalCrm(patient.id, actorId)
    setJustSynced(true)
    setTimeout(() => setJustSynced(false), 2500)
  }

  function handleSendPlan() {
    if (!primaryCase) return
    sendTreatmentPlanTask(patient.id, primaryCase.id, actorId)
    setPlanSent(true)
    setTimeout(() => setPlanSent(false), 2500)
  }

  const name = `${patient.firstName} ${patient.lastName}`
  const initials = `${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials || "—"}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{name}</h2>
              <p className="text-sm text-muted-foreground">
                {clinic?.name ?? "—"} {patient.externalPatientId ? `· ${patient.externalPatientId}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("text-[11px]", INTEGRATION_TONE[patient.integrationState])}>
                  {INTEGRATION_LABEL[patient.integrationState]}
                </Badge>
                {!patient.contactable && (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700">
                    Nie kontaktować
                  </Badge>
                )}
                {patient.lastSyncAt && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Sync {formatRelative(patient.lastSyncAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs text-muted-foreground">
              <p>Care owner</p>
              <p className="font-medium text-foreground">{careOwner?.name ?? "Nieprzypisane"}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSync}>
                {justSynced ? <Check className="h-3 w-3 text-emerald-600" /> : <RefreshCw className="h-3 w-3" />}
                {justSynced ? "Zsynchronizowano" : "Synchronizuj z PaNa CRM"}
              </Button>
              {primaryCase && (
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSendPlan}>
                  {planSent ? <Check className="h-3 w-3 text-emerald-600" /> : <Send className="h-3 w-3" />}
                  {planSent ? "Zadanie utworzone" : "Wyślij plan leczenia"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {patient.conflicts && patient.conflicts.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-0.5">
              {patient.conflicts.map((c) => (
                <p key={c.field}>
                  Konflikt danych <span className="font-medium">{c.field}</span>: lokalnie &quot;{c.localValue}&quot;, w PaNa CRM &quot;
                  {c.medicalValue}&quot;
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="chat">Czat</TabsTrigger>
          <TabsTrigger value="cases">Sprawy ({cases.length})</TabsTrigger>
          <TabsTrigger value="interactions">Interakcje ({interactions.length})</TabsTrigger>
          {patient.treatmentPlan && <TabsTrigger value="plan">Plan leczenia</TabsTrigger>}
          <TabsTrigger value="comments">Komentarze ({comments.length})</TabsTrigger>
          <TabsTrigger value="audit">Historia zmian ({audit.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Dane podstawowe</h3>
              <Badge variant="outline" className="text-[10px]">Patient 360</Badge>
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Imię i nazwisko</dt><dd className="mt-0.5 font-medium">{name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">PESEL</dt><dd className="mt-0.5 font-medium">{patient.pesel ?? "Nie uzupełniono"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Preferowany język</dt><dd className="mt-0.5 font-medium uppercase">{patient.preferredLanguage}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Zgoda na kontakt</dt><dd className="mt-0.5 font-medium">{patient.contactable ? "Tak" : "Nie"}</dd></div>
            </dl>
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Kanały kontaktu</h3>
            <div className="space-y-2">
              {identities.length === 0 && <p className="text-sm text-muted-foreground">Brak zarejestrowanych kanałów.</p>}
              {identities.map((identity) => {
                const Icon = CHANNEL_ICON[identity.channel] ?? StickyNote
                return (
                  <div key={identity.id} className="flex items-center gap-2 text-sm">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-foreground">{identity.value}</span>
                    {identity.isPrimary && (
                      <Badge variant="outline" className="text-[10px]">
                        Główny
                      </Badge>
                    )}
                    {!identity.verified && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Niezweryfikowany
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Pochodzenie danych</h3>
            <div className="space-y-2">
              {patient.provenance.map((p, idx) => (
                <div key={`${p.field}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{p.field}</span>
                  <span className="text-foreground">{p.value}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.source}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Otwarte zadania</h3>
            <div className="space-y-2">
              {openTasks.length === 0 && (
                <p className="text-sm text-muted-foreground">Brak otwartych zadań.</p>
              )}
              {openTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openCase(task.caseId)}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-secondary"
                  >
                    <span
                      className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white", PRIORITY_TONE[task.priority])}
                      title={priorityLabel(task.priority)}
                    >
                      {task.priority}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{task.title}</span>
                    {task.dueAt && <span className="text-xs text-muted-foreground">{formatRelative(task.dueAt)}</span>}
                    <span className="text-xs text-muted-foreground">{getOperator(task.ownerId)?.name ?? "Nieprzypisane"}</span>
                  </button>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="chat" className="mt-0">
          <div className="h-[540px] overflow-hidden rounded-xl border border-border bg-card">
            <PatientConversationWorkspace patientId={patient.id} currentCaseId={primaryCase?.id ?? ""} authorId={actorId} />
          </div>
        </TabsContent>

        <TabsContent value="cases" className="space-y-3">
          {cases.length === 0 && <p className="text-sm text-muted-foreground">Ten pacjent nie ma jeszcze przypisanych spraw.</p>}
          {cases.map((c) => {
            const procedure = getProcedure(c.serviceInterest)
            const doctor = getDoctor(c.doctorId)
            const caseClinic = getClinic(c.clinicId)
            const tone = getClinicTone(c.clinicId)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openCase(c.id)}
                className="flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/40 hover:bg-secondary/20"
              >
                <span className={cn("w-1 shrink-0", tone.bar)} aria-hidden="true" />
                <div className="min-w-0 flex-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground capitalize">{c.board}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {c.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className={cn("mr-1 inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium", tone.chip)}>
                      {caseClinic?.name ?? "Klinika nieprzypisana"}
                    </span>
                    {procedure?.name ?? "Brak usługi"}
                    {doctor ? ` · ${doctor.name}` : ""}
                  </p>
                </div>
              </button>
            )
          })}
        </TabsContent>

        <TabsContent value="interactions" className="space-y-3">
          {interactions.length === 0 && <p className="text-sm text-muted-foreground">Brak zarejestrowanych interakcji.</p>}
          {interactions.map((interaction) => {
            const isCall = interaction.type === "call"
            const call = isCall ? (interaction as Call) : undefined
            return (
              <div key={interaction.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  {isCall ? <Phone className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {isCall ? (call?.direction === "incoming" ? "Połączenie przychodzące" : "Połączenie wychodzące") : interaction.type}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(interaction.at)}</span>
                  </div>
                  {isCall && (
                    <p className="text-xs text-muted-foreground">
                      {call?.telcoStatus === "missed" ? "Nieodebrane" : call?.disposition ?? call?.telcoStatus}
                      {call?.talkTimeSec ? ` · ${Math.round(call.talkTimeSec / 60)} min` : ""}
                    </p>
                  )}
                  {interaction.text && <p className="mt-0.5 text-sm text-foreground">{interaction.text}</p>}
                </div>
              </div>
            )
          })}
        </TabsContent>

        {patient.treatmentPlan && (
          <TabsContent value="plan" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Plan leczenia · v{patient.treatmentPlan.version}</h3>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {patient.treatmentPlan.status}
                </Badge>
              </div>
              <div className="mt-3 space-y-1.5">
                {patient.treatmentPlan.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{item.name}</span>
                    {item.price !== undefined && (
                      <span className="text-muted-foreground">
                        {item.price} {patient.treatmentPlan?.currency}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-foreground">Razem</span>
                <span className="text-foreground">
                  {patient.treatmentPlan.totalValue} {patient.treatmentPlan.currency}
                </span>
              </div>
              {patient.treatmentPlan.documentName && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {patient.treatmentPlan.documentName}
                </p>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="comments" className="space-y-2">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">Brak komentarzy.</p>}
          {comments.map((comment) => {
            const author = getOperator(comment.authorId)
            return (
              <div key={comment.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-[10px]">{author?.initials ?? "—"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{author?.name ?? "Nieznany"}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(comment.at)}</span>
                  </div>
                  <p className="text-sm text-foreground">{comment.text}</p>
                </div>
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2">
          {audit.length === 0 && <p className="text-sm text-muted-foreground">Brak zmian systemowych.</p>}
          {audit.map((event) => (
            <div key={event.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{event.summary}</span>
              <span className="shrink-0">{formatDateTime(event.at)}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
