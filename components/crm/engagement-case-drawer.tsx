"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Phone, MessageSquare, Calendar, History, CheckCircle2, Link2, Search, XIcon, UserRound, BriefcaseBusiness, Save } from "lucide-react"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useLanguage } from "@/lib/crm/language-context"
import { useCall } from "@/lib/crm/call-context"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { getCase, getPatient, getIdentity, getTasksForCase, getCommentsForCase, getAuditForCase } from "@/lib/crm/entity-data"
import { getClinic, getProcedure, getDoctor, DOCTORS } from "@/lib/crm/catalog"
import { getOperator, PRIORITY_TEXT_TONE, priorityLabel } from "@/lib/crm/entity-selectors"
import { getNextTaskForCase } from "@/lib/crm/entity-queue"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"
import { PatientConversationWorkspace } from "@/components/crm/patient-conversation-workspace"
import { AppointmentSlotPicker } from "@/components/crm/appointment-slot-picker"
import { useAuthorization } from "@/lib/crm/authorization-context"

export function EngagementCaseDrawer() {
  const { activeCaseId, closeCase } = useCasePanel()
  const { hasPermission } = useAuthorization()
  const { cases } = useScopedEntityStore()
  const canViewCases = hasPermission("case:view")
  const isEntityCase = !!activeCaseId && activeCaseId.startsWith("case-")
  const engagementCase = isEntityCase ? cases.find((c) => c.id === activeCaseId) ?? getCase(activeCaseId!) : undefined

  return (
    <Dialog open={!!engagementCase && canViewCases} onOpenChange={(open) => !open && closeCase()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-6xl"
      >
        {engagementCase && <DrawerBody key={engagementCase.id} caseId={engagementCase.id} />}
      </DialogContent>
    </Dialog>
  )
}

function DrawerBody({ caseId }: { caseId: string }) {
  const { hasPermission } = useAuthorization()
  const canViewAudit = hasPermission("audit:view")
  const { tasks, cases, patients, identities, completeTask, reopenTask, skipTask, matchCaseToPatient, saveCaseContactProfile } = useScopedEntityStore()
  const { startOutgoingCall } = useCall()
  const { t } = useLanguage()
  const engagementCase = cases.find((c) => c.id === caseId) ?? getCase(caseId)!
  const patient = patients.find((item) => item.id === engagementCase.patientId) ?? getPatient(engagementCase.patientId)
  const identity = identities.find((item) => item.id === engagementCase.contactIdentityId) ?? getIdentity(engagementCase.contactIdentityId)
  const clinic = getClinic(engagementCase.clinicId)
  const procedure = getProcedure(engagementCase.serviceInterest)
  const doctor = getDoctor(engagementCase.doctorId)
  const caseTasks = useMemo(() => tasks.filter((t) => t.caseId === caseId), [tasks, caseId])
  const comments = getCommentsForCase(caseId)
  const audit = getAuditForCase(caseId)
  const timeline = useMemo(() => {
    type TimelineEntry = { id: string; at: string; kind: "task" | "comment" | "audit"; title: string; actor?: string }
    const entries: TimelineEntry[] = []
    for (const task of caseTasks) {
      const owner = getOperator(task.ownerId)
      const isDone = task.status === "completed" || task.status === "cancelled"
      entries.push({
        id: `task-${task.id}`,
        at: task.createdAt,
        kind: "task",
        title: `${isDone ? t("timeline_task_completed") : t("timeline_task_created")}: ${task.title}`,
        actor: owner?.name,
      })
    }
    for (const comment of comments) {
      const author = getOperator(comment.authorId)
      entries.push({ id: comment.id, at: comment.at, kind: "comment", title: comment.text, actor: author?.name })
    }
    if (canViewAudit) {
      for (const event of audit) {
        const actor = getOperator(event.actorId)
        entries.push({ id: event.id, at: event.at, kind: "audit", title: event.summary, actor: actor?.name })
      }
    }
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [caseTasks, comments, audit, canViewAudit, t])
  const [skipReason, setSkipReason] = useState("")
  const [skipTaskId, setSkipTaskId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(patient ? "timeline" : "profile")
  const [matchResult, setMatchResult] = useState<"matched" | "none" | null>(null)
  const patientIdentities = identities.filter((item) => item.patientId === patient?.id)
  const [profileDraft, setProfileDraft] = useState({
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    pesel: patient?.pesel ?? "",
    phone: patientIdentities.find((item) => item.channel === "phone")?.value ?? (identity?.channel === "phone" ? identity.value : ""),
    email: patientIdentities.find((item) => item.channel === "email")?.value ?? (identity?.channel === "email" ? identity.value : ""),
  })
  const [profileSaved, setProfileSaved] = useState(false)

  const openTasks = caseTasks.filter((t) => !["completed", "cancelled", "failed"].includes(t.status))
  const nextTask = getNextTaskForCase(caseTasks, caseId)
  const relatedCases = patient ? cases.filter((item) => item.patientId === patient.id) : [engagementCase]

  const handleCall = () => {
    startOutgoingCall({ caseId, taskId: nextTask?.id })
  }

  const handleMatchPatient = () => {
    const result = matchCaseToPatient(caseId, "current-user")
    setMatchResult(result.matched ? "matched" : "none")
  }

  const handleSaveProfile = () => {
    if (!profileDraft.firstName.trim() || !profileDraft.lastName.trim()) return
    saveCaseContactProfile({ caseId, ...profileDraft, actorId: "current-user" })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 1800)
  }

  return (
    <div className="flex h-full flex-col">
      <DialogHeader className="gap-3 border-b border-border px-6 py-4 text-left">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lg">
              {patient ? `${patient.firstName} ${patient.lastName}` : t("unknown_contact")}
            </DialogTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {identity && <span>{identity.value}</span>}
              <span>{engagementCase.id}</span>
              <span>{clinic?.name}</span>
            </div>
          </div>
          {patient && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              nativeButton={false}
              render={<Link href={`/patients/${patient.id}`}>{t("full_profile")}</Link>}
            />
          )}
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={t("close")} />
            }
          >
            <XIcon className="h-4 w-4" />
          </DialogClose>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{engagementCase.board === "leads" ? t("board_lead") : engagementCase.board === "deals" ? t("board_deal") : t("board_patient_care")}</Badge>
          {procedure && <Badge variant="secondary">{procedure.name}</Badge>}
          {doctor && <Badge variant="secondary">{doctor.name}</Badge>}
          {patient && <Badge variant="outline">{patient.integrationState}</Badge>}
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleCall}>
            <Phone className="h-3.5 w-3.5" />
            {t("call")}
          </Button>
          <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={() => setActiveTab("history")}>
            <MessageSquare className="h-3.5 w-3.5" />
            {t("message")}
          </Button>
          <Popover>
            <PopoverTrigger
              render={
                <Button size="sm" variant="secondary" className="flex-1 gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("book_appointment")}
                </Button>
              }
            />
            <AppointmentSlotPicker
              caseId={caseId}
              taskId={nextTask?.id}
              patientId={patient?.id ?? engagementCase.patientId}
              clinicId={engagementCase.clinicId}
              procedureId={engagementCase.serviceInterest}
              doctorId={engagementCase.doctorId}
            />
          </Popover>
        </div>

        {!patient && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {matchResult === "matched"
                ? t("matched_note")
                : matchResult === "none"
                  ? t("none_matched_note")
                  : t("not_linked_note")}
            </p>
            {matchResult !== "matched" && (
              <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs" onClick={handleMatchPatient}>
                <Link2 className="h-3 w-3" />
                {t("check_in_crm")}
              </Button>
            )}
          </div>
        )}
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-3 py-0">
          <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <UserRound className="mr-1.5 h-3.5 w-3.5" />Profil
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_timeline")}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_tasks")}
            {openTasks.length > 0 && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {openTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_history")}
          </TabsTrigger>
          <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_comments")}
          </TabsTrigger>
          {canViewAudit && <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_audit")}
          </TabsTrigger>}
          <TabsTrigger value="cases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" />Sprawy ({relatedCases.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <TabsContent value="profile" className="mt-0 space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Dane kontaktu i pacjenta</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Dane można uzupełnić ręcznie podczas rozmowy. Medical CRM pozostaje źródłem głównym po synchronizacji.</p>
                </div>
                <Badge variant="outline">{patient ? "Profil istnieje" : "Nowy profil lokalny"}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["firstName", "Imię"], ["lastName", "Nazwisko"], ["pesel", "PESEL"], ["phone", "Telefon"], ["email", "E-mail"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`profile-${field}`} className="text-xs text-muted-foreground">{label}</Label>
                    <Input id={`profile-${field}`} value={profileDraft[field]} onChange={(event) => setProfileDraft((prev) => ({ ...prev, [field]: event.target.value }))} placeholder={`Uzupełnij: ${label.toLowerCase()}`} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Pola zapisane ręcznie otrzymują źródło „User-entered” i są widoczne w historii zmian.</p>
                <Button size="sm" className="gap-1.5" disabled={!profileDraft.firstName.trim() || !profileDraft.lastName.trim()} onClick={handleSaveProfile}>
                  <Save className="h-3.5 w-3.5" />{profileSaved ? "Zapisano" : patient ? "Zapisz zmiany" : "Utwórz profil"}
                </Button>
              </div>
            </div>
            {patient && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-2 text-sm font-semibold">Źródło i synchronizacja</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{patient.integrationState}</Badge>
                  {patient.externalPatientId && <Badge variant="secondary">Medical CRM ID: {patient.externalPatientId}</Badge>}
                  {patient.lastSyncAt && <span className="text-muted-foreground">Ostatnia synchronizacja: {formatDateTime(patient.lastSyncAt)}</span>}
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="timeline" className="mt-0">
            <ol className="space-y-3">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    {entry.kind === "task" && <CheckCircle2 className="h-3 w-3 text-muted-foreground" />}
                    {entry.kind === "comment" && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                    {entry.kind === "audit" && <History className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{entry.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.actor ?? t("unassigned_owner")} · {formatDateTime(entry.at)}
                    </p>
                  </div>
                </li>
              ))}
              {timeline.length === 0 && <p className="text-sm text-muted-foreground">{t("no_timeline")}</p>}
            </ol>
          </TabsContent>

          <TabsContent value="tasks" className="mt-0 space-y-2">
            {caseTasks.length === 0 && <p className="text-sm text-muted-foreground">{t("no_tasks")}</p>}
            {caseTasks.map((task) => {
              const done = task.status === "completed" || task.status === "cancelled"
              const owner = getOperator(task.ownerId)
              const requiresCall = !done && task.requiresCall === true
              return (
                <div key={task.id} className="rounded-md border border-border px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      checked={done}
                      disabled={requiresCall}
                      onCheckedChange={(checked) => {
                        if (checked) completeTask(task.id, "done")
                        else reopenTask(task.id)
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", done && "text-muted-foreground line-through")}>{task.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className={cn("font-medium", PRIORITY_TEXT_TONE[task.priority])}>
                          {task.priority} · {priorityLabel(task.priority)}
                        </span>
                        {task.dueAt && <span suppressHydrationWarning>· {t("due_prefix")} {formatRelative(task.dueAt)}</span>}
                        <span>· {owner?.name ?? t("unassigned_owner")}</span>
                      </p>
                      {task.skipReason && (
                        <p className="mt-1 text-xs text-amber-600">{t("skipped_prefix")}: {task.skipReason}</p>
                      )}
                      {requiresCall && (
                        <p className="mt-1 text-xs font-medium text-sky-700">To zadanie wymaga próby połączenia i wyboru wyniku rozmowy.</p>
                      )}
                    </div>
                    {requiresCall ? (
                      <Button
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => startOutgoingCall({ caseId, taskId: task.id })}
                      >
                        <Phone className="h-3 w-3" />
                        {t("call")}
                      </Button>
                    ) : !done ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() => setSkipTaskId(skipTaskId === task.id ? null : task.id)}
                      >
                        {t("skip")}
                      </Button>
                    ) : null}
                  </div>
                  {skipTaskId === task.id && (
                    <div className="mt-2 flex items-center gap-2 pl-7">
                      <input
                        value={skipReason}
                        onChange={(e) => setSkipReason(e.target.value)}
                        placeholder={t("skip_reason_placeholder")}
                        className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          skipTask(task.id, skipReason || "Brak powodu")
                          setSkipTaskId(null)
                          setSkipReason("")
                        }}
                      >
                        {t("save")}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </TabsContent>

          <TabsContent value="history" className="-mx-5 -my-4 mt-0 h-full">
            <PatientConversationWorkspace
              patientId={patient?.id}
              currentCaseId={caseId}
              authorId="current-user"
            />
          </TabsContent>

          <TabsContent value="comments" className="mt-0 space-y-3">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">{t("no_comments")}</p>}
            {comments.map((comment) => {
              const author = getOperator(comment.authorId)
              return (
                <div key={comment.id} className="rounded-md border border-border px-3 py-2.5">
                  <p className="text-sm text-foreground">{comment.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {author?.name ?? comment.authorId} · {formatDateTime(comment.at)}
                  </p>
                </div>
              )
            })}
          </TabsContent>

          {canViewAudit && <TabsContent value="audit" className="mt-0">
            <ol className="space-y-3">
              {audit.map((event) => {
                const actor = getOperator(event.actorId)
                return (
                  <li key={event.id} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <History className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{event.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {actor?.name ?? event.actorId} · {formatDateTime(event.at)}
                      </p>
                    </div>
                  </li>
                )
              })}
              {audit.length === 0 && <p className="text-sm text-muted-foreground">{t("no_audit")}</p>}
            </ol>
          </TabsContent>}

          <TabsContent value="cases" className="mt-0 space-y-2">
            {relatedCases.map((item) => {
              const itemClinic = getClinic(item.clinicId)
              const itemTasks = tasks.filter((task) => task.caseId === item.id && !["completed", "cancelled", "failed"].includes(task.status))
              return (
                <div key={item.id} className={cn("rounded-lg border p-3", item.id === caseId && "border-primary bg-primary/5")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.id} · {itemClinic?.name ?? "Bez kliniki"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.board} / {item.status} · otwarte zadania: {itemTasks.length}</p>
                    </div>
                    {item.id === caseId && <Badge>Bieżąca sprawa</Badge>}
                  </div>
                </div>
              )
            })}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
