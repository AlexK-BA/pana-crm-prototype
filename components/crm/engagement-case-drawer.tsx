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
import { Phone, MessageSquare, Calendar, History, CheckCircle2, XIcon, UserRound, BriefcaseBusiness, Save, ChevronDown, Clock3, AlertTriangle } from "lucide-react"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useLanguage } from "@/lib/crm/language-context"
import { CreateCaseTask, TaskActions } from "@/components/crm/task-actions"
import { getWorkflowStageRule } from "@/lib/crm/workflow-rules"
import { useCall } from "@/lib/crm/call-context"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { getClinic, getProcedure, getDoctor, DOCTORS } from "@/lib/crm/catalog"
import { getOperator, PRIORITY_TEXT_TONE, priorityLabel } from "@/lib/crm/entity-selectors"
import { getNextTaskForCase } from "@/lib/crm/entity-queue"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import type { SmsMessage } from "@/lib/crm/entities"
import { getSmsStatusLabel, isSmsMessage } from "@/lib/crm/sms-service"
import { cn } from "@/lib/utils"
import { PatientLinkPanel } from "@/components/crm/patient-link-panel"
import { Patient360Actions } from "@/components/crm/patient-360-actions"
import { PatientConversationWorkspace } from "@/components/crm/patient-conversation-workspace"
import { AppointmentBookingDialog } from "@/components/crm/appointment-slot-picker"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"

export function EngagementCaseDrawer() {
  const { activeCaseId, closeCase } = useCasePanel()
  const { phase: callPhase } = useCall()
  const { hasPermission } = useAuthorization()
  const { cases } = useScopedEntityStore()
  const canViewCases = hasPermission("case:view")
  const isEntityCase = !!activeCaseId && activeCaseId.startsWith("case-")
  const engagementCase = isEntityCase ? cases.find((c) => c.id === activeCaseId) : undefined

  return (
    <Dialog
      open={!!engagementCase && canViewCases}
      modal={callPhase === "idle"}
      onOpenChange={(open) => !open && closeCase()}
    >
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
  const { currentUser, users } = useUserDirectory()
  const canViewAudit = hasPermission("audit:view")
  const canHandleCalls = hasPermission("call:handle")
  const canViewCommunication = hasPermission("communication:view")
  const canEditPatient = hasPermission("patient:edit_local")
  const canWorkTasks = hasPermission("task:work")
  const { tasks, cases, patients, identities, interactions, comments: allComments, auditEvents, retrySms, saveCaseContactProfile } = useScopedEntityStore()
  const { startOutgoingCall } = useCall()
  const { t, tr } = useLanguage()
  const engagementCase = cases.find((c) => c.id === caseId)!
  const patient = patients.find((item) => item.id === engagementCase.patientId)
  const identity = identities.find((item) => item.id === engagementCase.contactIdentityId)
  const clinic = getClinic(engagementCase.clinicId)
  const procedure = getProcedure(engagementCase.serviceInterest)
  const doctor = getDoctor(engagementCase.doctorId)
  const caseTasks = useMemo(() => tasks.filter((t) => t.caseId === caseId), [tasks, caseId])
  const comments = allComments.filter(item => item.caseId === caseId)
  const audit = auditEvents.filter((event) => event.caseId === caseId)
  const caseSms = interactions.filter(isSmsMessage).filter((message) => message.caseId === caseId)
  const [smsError, setSmsError] = useState("")
  const timeline = useMemo(() => {
    type TimelineEntry = { id: string; at: string; kind: "task" | "comment" | "audit" | "sms"; title: string; actor?: string; sms?: SmsMessage }
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
    if (canViewCommunication) {
      for (const message of caseSms) entries.push({ id: message.id, at: message.at, kind: "sms", title: message.text ?? "",
        actor: users.find((user) => user.id === message.authorId)?.name ?? (message.direction === "incoming" ? "Pacjent (demo)" : message.authorId), sms: message })
    }
    if (canViewAudit) {
      for (const event of audit) {
        if (event.type.startsWith("sms_") && caseSms.some((message) => message.id === event.correlationId)) continue
        const actor = getOperator(event.actorId)
        entries.push({ id: event.id, at: event.at, kind: "audit", title: event.summary, actor: actor?.name })
      }
    }
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [caseTasks, comments, audit, caseSms, canViewAudit, canViewCommunication, users, t])
  const [bookingOpen, setBookingOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(patient ? "timeline" : "profile")
  const [profileError, setProfileError] = useState("")
  const patientIdentities = identities.filter((item) => item.patientId === patient?.id)
  const [profileDraft, setProfileDraft] = useState({
    firstName: engagementCase.contactProfile?.firstName ?? patient?.firstName ?? "",
    lastName: engagementCase.contactProfile?.lastName ?? patient?.lastName ?? "",
    pesel: engagementCase.contactProfile?.pesel ?? "",
    externalPatientId: engagementCase.contactProfile?.externalPatientId ?? "",
    phone: engagementCase.contactProfile?.phone ?? patientIdentities.find((item) => item.channel === "phone")?.value ?? (identity?.channel === "phone" ? identity.value : ""),
    email: engagementCase.contactProfile?.email ?? patientIdentities.find((item) => item.channel === "email")?.value ?? (identity?.channel === "email" ? identity.value : ""),
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const openTasks = caseTasks.filter((t) => !["completed", "cancelled", "failed"].includes(t.status))
  const nextTask = getNextTaskForCase(caseTasks, caseId)
  const lastCompletedTask = caseTasks
    .filter((task) => task.status === "completed")
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())[0]
  const isTerminalStage = Boolean(getWorkflowStageRule(engagementCase.board, engagementCase.status)?.terminal)
  const nextTaskOverdue = Boolean(nextTask?.dueAt && new Date(nextTask.dueAt).getTime() < Date.now())
  const relatedCases = patient ? cases.filter((item) => item.patientId === patient.id) : [engagementCase]

  const handleCall = () => {
    if (!canHandleCalls) return
    startOutgoingCall({ caseId, taskId: nextTask?.id })
  }

  const handleSaveProfile = () => {
    if (!canEditPatient || !profileDraft.firstName.trim() || !profileDraft.lastName.trim()) return
    try {
      setProfileError("")
      saveCaseContactProfile({ caseId, ...profileDraft, actorId: currentUser.id })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 1800)
    } catch (error) { setProfileError(error instanceof Error ? error.message : tr("Nie udało się zapisać danych.", "Не удалось сохранить данные.")) }
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
          {patient && <Button size="sm" variant="ghost" className="ml-auto h-6 gap-1 px-2 text-xs" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
            {tr("Szczegóły", "Подробнее")} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")} />
          </Button>}
        </div>

        <section className={cn("rounded-lg border p-3", nextTaskOverdue ? "border-red-300 bg-red-50/70" : "border-primary/25 bg-primary/[0.04]")} aria-labelledby="case-now-title">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p id="case-now-title" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {nextTaskOverdue ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : <Clock3 className="h-3.5 w-3.5" />}
                {tr("Co zrobić teraz", "Что делать сейчас")}
              </p>
              {nextTask ? <>
                <p className="truncate text-sm font-semibold">{nextTask.title}</p>
                {nextTask.description && <p className="line-clamp-2 text-xs text-muted-foreground">{nextTask.description}</p>}
                <p className={cn("text-xs", nextTaskOverdue ? "font-medium text-red-700" : "text-muted-foreground")}>
                  {nextTask.dueAt ? `${tr("Termin", "Срок")}: ${formatDateTime(nextTask.dueAt)} · ${formatRelative(nextTask.dueAt)}` : tr("Brak terminu — wymaga zaplanowania", "Нет срока — требуется планирование")}
                </p>
              </> : <p className="text-sm font-medium text-amber-800">{tr("Brak następnego działania — utwórz zadanie przed zamknięciem sprawy.", "Нет следующего действия — создайте задачу до закрытия заявки.")}</p>}
            </div>
            {nextTask && <Badge variant={nextTaskOverdue ? "destructive" : "secondary"}>{nextTask.priority}</Badge>}
          </div>
          {lastCompletedTask && <p className="mt-2 truncate border-t pt-2 text-xs text-muted-foreground">{tr("Ostatnio wykonano", "Последнее выполненное действие")}: {lastCompletedTask.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
            <CreateCaseTask caseId={caseId} variant="secondary" terminal={isTerminalStage} />
          </div>
        </section>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5" disabled={!canHandleCalls} onClick={handleCall}>
            <Phone className="h-3.5 w-3.5" />
            {t("call")}
          </Button>
          <Button size="sm" variant="secondary" className="flex-1 gap-1.5" disabled={!canViewCommunication} onClick={() => setActiveTab("history")}>
            <MessageSquare className="h-3.5 w-3.5" />
            {t("message")}
          </Button>
          <Button size="sm" variant="secondary" className="flex-1 gap-1.5" disabled={!canWorkTasks} onClick={() => setBookingOpen(true)}>
            <Calendar className="h-3.5 w-3.5" />
            {t("book_appointment")}
          </Button>
          <AppointmentBookingDialog
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            caseId={caseId}
            taskId={nextTask?.id}
            patientId={patient?.id ?? engagementCase.patientId}
            patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
            clinicId={engagementCase.clinicId}
            procedureId={engagementCase.serviceInterest}
            doctorId={engagementCase.doctorId}
          />
        </div>

        <PatientLinkPanel caseId={caseId} />
        {detailsOpen && patient && <div className="max-h-40 overflow-y-auto"><Patient360Actions patientId={patient.id} caseId={caseId} /></div>}
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-3 py-0">
          <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <UserRound className="mr-1.5 h-3.5 w-3.5" />{tr("Profil", "Профиль")}
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
          {canViewCommunication && <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_history")}
          </TabsTrigger>}
          <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_comments")}
          </TabsTrigger>
          {canViewAudit && <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t("tab_audit")}
          </TabsTrigger>}
          <TabsTrigger value="cases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" />{tr("Sprawy", "Заявки")} ({relatedCases.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <TabsContent value="profile" className="mt-0 space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{tr("Lokalne dane kontaktu sprawy", "Локальные контактные данные заявки")}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tr("Dane do wyszukania pacjenta. Zapis nie tworzy Patient i nie zmienia danych Medical CRM.", "Данные для поиска пациента. Сохранение не создаёт Patient и не изменяет данные Medical CRM.")}</p>
                </div>
                <Badge variant="outline">{patient ? tr("Profil istnieje", "Профиль существует") : tr("Kontakt bez Patient", "Контакт без Patient")}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["firstName", tr("Imię", "Имя")], ["lastName", tr("Nazwisko", "Фамилия")], ["pesel", tr("PESEL do wyszukania", "PESEL для поиска")], ["externalPatientId", tr("Medical CRM ID do wyszukania", "Medical CRM ID для поиска")], ["phone", tr("Telefon", "Телефон")], ["email", "E-mail"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`profile-${field}`} className="text-xs text-muted-foreground">{label}</Label>
                    <Input id={`profile-${field}`} disabled={!canEditPatient} value={profileDraft[field]} onChange={(event) => setProfileDraft((prev) => ({ ...prev, [field]: event.target.value }))} placeholder={`${tr("Uzupełnij", "Заполните")}: ${label.toLowerCase()}`} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{tr("Dane kontaktu pozostają w sprawie; decyzja powiązania ma własną historię.", "Контактные данные остаются в заявке; решение о привязке имеет отдельную историю.")}</p>
                <Button size="sm" className="gap-1.5" disabled={!canEditPatient || !profileDraft.firstName.trim() || !profileDraft.lastName.trim()} onClick={handleSaveProfile}>
                  <Save className="h-3.5 w-3.5" />{profileSaved ? tr("Zapisano", "Сохранено") : tr("Zapisz kontakt i wyszukaj", "Сохранить контакт и найти")}
                </Button>
              </div>
            </div>
            {profileError && <p role="alert" className="text-sm text-destructive">{profileError}</p>}
            {patient && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-2 text-sm font-semibold">{tr("Źródło i synchronizacja", "Источник и синхронизация")}</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{patient.integrationState}</Badge>
                  {hasPermission("patient:view_medical") && patient.externalPatientId && <Badge variant="secondary">Medical CRM ID: {patient.externalPatientId}</Badge>}
                  {patient.lastSyncAt && <span className="text-muted-foreground">{tr("Ostatnia synchronizacja", "Последняя синхронизация")}: {formatDateTime(patient.lastSyncAt)}</span>}
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="timeline" className="mt-0">
            {smsError && <p role="alert" className="text-xs text-destructive">{smsError}</p>}
            <ol className="space-y-3">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    {entry.kind === "task" && <CheckCircle2 className="h-3 w-3 text-muted-foreground" />}
                    {(entry.kind === "comment" || entry.kind === "sms") && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                    {entry.kind === "audit" && <History className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{entry.title}</p>
                    {entry.sms && <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <p>SMS · {entry.sms.direction === "incoming" ? tr("Przychodzący", "Входящее") : tr("Wychodzący", "Исходящее")} · {getSmsStatusLabel(entry.sms)}</p>
                      {entry.sms.taskId && <p>{tr("Zadanie", "Задача")}: {tasks.find((task) => task.id === entry.sms?.taskId)?.title ?? entry.sms.taskId}</p>}
                      {entry.sms.errorMessage && <p className="text-destructive">{entry.sms.errorMessage}</p>}
                      {entry.sms.retryOfId && <p>Ponowienie: {entry.sms.retryOfId}</p>}
                      {entry.sms.deliveryStatus === "failed" && entry.sms.direction === "outgoing" && hasPermission("sms:retry") && hasPermission("sms:send_custom") && hasPermission("communication:send") &&
                        <Button size="sm" variant="outline" onClick={() => {
                          try { retrySms(entry.id, currentUser.id); setSmsError("") }
                          catch (error) { setSmsError(error instanceof Error ? error.message : "Błąd SMS.") }
                        }}>{tr("Ponów SMS", "Повторить SMS")}</Button>}
                    </div>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.actor ?? t("unassigned_owner")} · {formatDateTime(entry.at)}
                    </p>
                  </div>
                </li>
              ))}
              {timeline.length === 0 && <p className="text-sm text-muted-foreground">{t("no_timeline")}</p>}
            </ol>
          </TabsContent>

          <TabsContent value="tasks" className="mt-0 space-y-2"><CreateCaseTask caseId={caseId} terminal={isTerminalStage}/>
            {caseTasks.length === 0 && <p className="text-sm text-muted-foreground">{t("no_tasks")}</p>}
            {caseTasks.map(task=><div key={task.id} className="space-y-2 rounded border p-3"><p className="font-medium">{task.title}</p><p className="text-sm text-muted-foreground">{task.description ?? tr("Brak opisu (dane historyczne)", "Нет описания (исторические данные)")}</p><p className="text-xs">{task.status} · {task.priority} · {task.dueAt ? formatDateTime(task.dueAt) : tr("Bez terminu", "Без срока")} · {tr("przeniesienia", "переносы")} {task.rescheduleCount??0}</p><TaskActions task={task}/></div>)}
          </TabsContent>

          {canViewCommunication && <TabsContent value="history" className="-mx-5 -my-4 mt-0 h-full">
            <PatientConversationWorkspace
              patientId={patient?.id}
              currentCaseId={caseId}
              taskId={nextTask?.id}
              authorId={currentUser.id}
            />
          </TabsContent>}

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
                      <p className="text-sm font-medium">{item.id} · {itemClinic?.name ?? tr("Bez kliniki", "Без клиники")}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.board} / {item.status} · {tr("otwarte zadania", "открытые задачи")}: {itemTasks.length}</p>
                    </div>
                    {item.id === caseId && <Badge>{tr("Bieżąca sprawa", "Текущая заявка")}</Badge>}
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
