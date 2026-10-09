"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { PatientConversationWorkspace } from "@/components/crm/patient-conversation-workspace"
import { TaskActions } from "@/components/crm/task-actions"
import { Patient360Actions } from "@/components/crm/patient-360-actions"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useCall } from "@/lib/crm/call-context"
import { selectPatient360, isCaseActive, patientTaskGroup } from "@/lib/crm/patient-360-selectors"
import { isOverdue, taskType } from "@/lib/crm/entity-queue"
import { getClinic, getClinicTone, getProcedure, getDoctor } from "@/lib/crm/catalog"
import { BOARD_COLUMNS } from "@/lib/crm/boards"
import { CLINIC_TIME_ZONE, formatDateTime, formatRelative } from "@/lib/crm/format"
import { getSmsStatusLabel, isSmsMessage } from "@/lib/crm/sms-service"
import { patientLinkLabel, resolvePatientLinkState } from "@/lib/crm/patient-link-state"
import { channelText, taskStatusText, taskTypeText } from "@/lib/crm/display-labels"
import { useLanguage } from "@/lib/crm/language-context"
import { taskTypeLabel } from "@/lib/crm/task-type-labels"
import { cn } from "@/lib/utils"

const integration = {
  linked: ["Powiązano", "Связан"], match_suggested: ["Sugerowane dopasowanie", "Предложено совпадение"], conflict: ["Konflikt", "Конфликт"],
  sync_pending: ["Synchronizacja w toku", "Идёт синхронизация"], sync_failed: ["Medical CRM niedostępne / błąd synchronizacji", "Medical CRM недоступна / ошибка синхронизации"], unlinked: ["Niepowiązano", "Не связан"],
} as const
const taskGroups = {
  overdue: ["Przeterminowane", "Просроченные"], today: ["Na dziś", "На сегодня"], upcoming: ["Nadchodzące", "Предстоящие"],
  completed: ["Zakończone", "Завершённые"], cancelled: ["Anulowane", "Отменённые"], failed: ["Nieudane", "Неуспешные"],
} as const
const portalStatus = { none: ["Brak konta", "Нет аккаунта"], pending_verification: ["Oczekuje na weryfikację", "Ожидает подтверждения"], active: ["Aktywne", "Активен"], blocked: ["Zablokowane", "Заблокирован"] } as const
const visitStatus = { scheduled: ["Zaplanowana", "Запланирован"], confirmed: ["Potwierdzona", "Подтверждён"], completed: ["Zakończona", "Завершён"], cancelled: ["Anulowana", "Отменён"], no_show: ["Nieobecność", "Неявка"] } as const

/** Same Patient route/profile; every section is a scoped projection of canonical records. */
export function PatientProfile({ patientId }: { patientId: string }) {
  const { tr } = useLanguage()
  const store = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  if (!hasPermission("patient:view_basic")) return <div role="alert" className="rounded border p-6">{tr("Brak dostępu do Patient 360.", "Нет доступа к Patient 360.")}</div>
  if (!store.patients.some(item => item.id === patientId)) return <div role="status" className="rounded border p-6">{tr("Pacjent nie został znaleziony lub jest poza zakresem Twoich klinik.", "Пациент не найден или не относится к доступным вам клиникам.")}</div>
  return <PatientWorkspace patientId={patientId} />
}
function PatientWorkspace({ patientId }: { patientId: string }) {
  const { t, tr, language } = useLanguage()
  const locale = language === "ru" ? "ru-RU" : "pl-PL"
  const dateTime = (iso: string) => formatDateTime(iso, CLINIC_TIME_ZONE, locale)
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
  const actor = (id?: string) => id === "system" ? tr("System", "Система") : users.find(item => item.id === id)?.name ?? id ?? tr("Nieprzypisane", "Не назначено")
  const latest = view.activity[0]?.at
  const treatmentPlans = [...(patient.treatmentPlans ?? []), ...(patient.treatmentPlan ? [patient.treatmentPlan] : [])]
    .filter((plan, index, plans) => plans.findIndex(item => item.id === plan.id && item.version === plan.version) === index)
    .sort((a, b) => b.date.localeCompare(a.date))
  const medicalVisits = [...(patient.medicalVisits ?? [])].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  const nextMedicalVisit = [...medicalVisits].filter(item => ["scheduled", "confirmed"].includes(item.status) && new Date(item.startsAt) >= new Date()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
  const address = patient.address ? [patient.address.line1, patient.address.line2, `${patient.address.postalCode} ${patient.address.city}`, patient.address.countryCode].filter(Boolean).join(", ") : tr("Brak danych", "Нет данных")
  const currentMatches = view.matches.filter(item => ["pending", "conflict"].includes(item.status))
  const taskTitle = (task: typeof view.tasks[number]) => task.source === "workflow" || task.workflowRuleId ? taskTypeLabel(taskType(task), language) : task.title
  const taskDescription = (task: typeof view.tasks[number]) => task.source === "workflow" || task.workflowRuleId ? taskTypeLabel(taskType(task), language) : task.description
  function command(work: () => void) { try { setError(""); setNotice(""); work() } catch (error) { setError(error instanceof Error ? error.message : tr("Nie udało się wykonać operacji.", "Не удалось выполнить операцию.")) } }
  function communication(caseId = primaryCase?.id ?? "", sms = false) { setCommunicationCase(caseId); setCommunicationSms(sms); setSection("communications") }
  const detail = (label: string, value: React.ReactNode) => <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || tr("Brak danych", "Нет данных")}</dd></div>
  const localized = (pair: readonly [string, string]) => tr(pair[0], pair[1])
  const integrationLabel = (state: keyof typeof integration) => localized(integration[state])
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5">
    <header className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0 space-y-2"><h2 className="break-words text-xl font-semibold">{name}</h2><p className="break-all text-xs text-muted-foreground">{tr("ID pacjenta", "ID пациента")}: {patient.id} · {tr("Zewnętrzny ID Medical CRM", "Внешний ID Medical CRM")}: {patient.externalPatientId ?? tr("Brak", "Нет")}</p>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{getClinic(patient.primaryClinicId)?.name}</Badge><Badge variant="outline">{integrationLabel(patient.integrationState)}</Badge><Badge variant="secondary">{patient.externalPatientId ? tr("Istniejący w Medical CRM", "Существует в Medical CRM") : tr("Nowy / niepowiązany z Medical CRM", "Новый / не связан с Medical CRM")}</Badge>{!patient.contactable && <Badge variant="destructive">{tr("Nie kontaktować", "Не связываться")}</Badge>}{view.overdue.length > 0 && <Badge variant="destructive">{view.overdue.length} {tr("przeterminowanych", "просрочено")}</Badge>}</div>
        </div>
        <div className="space-y-1 text-xs"><p>{tr("Odpowiedzialny", "Ответственный")}: {actor(patient.careOwnerId ?? primaryCase?.responsibleTeamId)}</p><p>{tr("Język", "Язык")}: {patient.preferredLanguage.toUpperCase()}</p><p>{tr("Ostatnia aktywność", "Последняя активность")}: {latest ? formatRelative(latest, language) : tr("Brak", "Нет")}</p><p>{tr("Synchronizacja", "Синхронизация")}: {patient.lastSyncAt ? dateTime(patient.lastSyncAt) : tr("Nie synchronizowano", "Не синхронизировано")}</p></div>
      </div>
      <p className="break-all text-sm">{tr("Telefon", "Телефон")}: {phone?.value ?? tr("Brak", "Нет")} · E-mail: {email?.value ?? tr("Brak", "Нет")}</p>
      <div className="flex flex-wrap gap-1">{patient.localTags?.map(tag => <Badge key={tag} variant="outline" className="max-w-full break-all whitespace-normal">{tag}</Badge>)}</div>
      <p className="text-sm"><strong>{tr("Następne działanie", "Следующее действие")}:</strong> {view.nextTask ? <>{taskTitle(view.nextTask)} · {view.nextTask.dueAt ? dateTime(view.nextTask.dueAt) : tr("Bez terminu", "Без срока")}</> : tr("Nie ustalono — utwórz zadanie we właściwej sprawie", "Не определено — создайте задачу в нужном кейсе")}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!hasPermission("call:handle") || !primaryCase || !phone} onClick={() => command(() => { if (primaryCase) startOutgoingCall({ caseId: primaryCase.id, taskId: view.nextTask?.id, contactIdentityId: phone?.id }) })}>{tr("Zadzwoń", "Позвонить")}</Button>
        <Button size="sm" variant="outline" disabled={!hasPermission("communication:view") || !hasPermission("communication:send") || !hasPermission("sms:send_custom")} onClick={() => communication("", true)}>{tr("Wyślij SMS", "Отправить SMS")}</Button>
        <Button size="sm" variant="outline" disabled={!hasPermission("communication:view")} onClick={() => communication()}>{tr("Otwórz komunikacje", "Открыть коммуникации")}</Button>
        {hasPermission("patient:view_medical") && hasPermission("patient:edit_local") && <Button size="sm" variant="outline" onClick={() => command(() => { store.syncPatientWithMedicalCrm(patient.id, store.currentUser.id); setNotice(tr("Zakończono emulację synchronizacji (bez API).", "Эмуляция синхронизации завершена (без API).")) })}>{tr("Synchronizuj Medical CRM · demo", "Синхронизировать Medical CRM · демо")}</Button>}
      </div>
      <Patient360Actions patientId={patientId} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    </header>
    {currentMatches.length > 0 && <div role="status" className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">{tr("Dopasowanie pacjenta wymaga weryfikacji.", "Сопоставление пациента требует проверки.")}{currentMatches.map(item => <p key={item.id}>{item.status === "conflict" ? tr("Konflikt", "Конфликт") : tr("Oczekuje na dopasowanie", "Ожидает сопоставления")} · <button className="underline" onClick={() => openCase(item.caseId)}>{item.caseId}</button></p>)}</div>}
    <Tabs value={section} onValueChange={setSection}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="overview">{tr("Przegląd", "Обзор")}</TabsTrigger>{hasPermission("case:view") && <TabsTrigger value="cases">{tr("Sprawy", "Кейсы")} ({view.cases.length})</TabsTrigger>}{hasPermission("task:view") && <TabsTrigger value="tasks">{tr("Zadania", "Задачи")} ({view.tasks.length})</TabsTrigger>}
        {hasPermission("communication:view") && <TabsTrigger value="communications">{tr("Komunikacje", "Коммуникации")}</TabsTrigger>}{(hasPermission("communication:view") || hasPermission("audit:view")) && <TabsTrigger value="activity">{tr("Oś aktywności", "Хронология активности")}</TabsTrigger>}
        {hasPermission("case:view") && <TabsTrigger value="comments">{tr("Komentarze", "Комментарии")} ({view.comments.length})</TabsTrigger>}{hasPermission("patient:view_medical") && <TabsTrigger value="medical">Medical CRM</TabsTrigger>}
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        <section className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">{tr("Patient 360 · podsumowanie", "Patient 360 · сводка")}</h3><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {detail(tr("Kontakty", "Контакты"), `${phone?.value ?? tr("Brak telefonu", "Нет телефона")} / ${email?.value ?? tr("Brak e-mailu", "Нет e-mail")}`)}{detail(tr("Klinika", "Клиника"), getClinic(patient.primaryClinicId)?.name)}{detail(tr("Lekarz w bieżącej sprawie", "Врач в текущем кейсе"), getDoctor(primaryCase?.doctorId)?.name)}{detail(tr("Procedura", "Процедура"), getProcedure(primaryCase?.serviceInterest)?.name)}
          {hasPermission("patient:view_medical") && detail(tr("Adres zamieszkania", "Адрес проживания"), address)}{hasPermission("patient:view_medical") && detail(tr("Konto pacjenta", "Аккаунт пациента"), localized(portalStatus[patient.portalAccount?.status ?? "none"]))}{hasPermission("patient:view_medical") && detail(tr("Alergie", "Аллергии"), patient.allergies?.filter(item => item.status === "active").map(item => item.substance).join(", ") || tr("Brak zgłoszonych", "Не указаны"))}
          {hasPermission("patient:view_medical") && detail(tr("Najbliższa wizyta", "Ближайший визит"), nextMedicalVisit ? `${dateTime(nextMedicalVisit.startsAt)} · ${getClinic(nextMedicalVisit.clinicId)?.name ?? nextMedicalVisit.clinicId}` : tr("Brak zaplanowanej wizyty", "Нет запланированного визита"))}
          {detail(tr("Pierwsze zgłoszenie", "Первое обращение"), view.firstTouch ? dateTime(view.firstTouch.at) : undefined)}{detail(tr("Źródło pierwszego kontaktu (niezmienne)", "Источник первого контакта (неизменяемый)"), view.firstTouch ? `${view.firstTouch.source} · ${channelText(view.firstTouch.channel, language)}` : undefined)}
          {detail(tr("Aktywne sprawy", "Активные кейсы"), view.cases.filter(isCaseActive).length.toString())}{detail(tr("Najbliższa czynność", "Ближайшее действие"), view.nextTask ? taskTitle(view.nextTask) : undefined)}{detail(tr("Przeterminowane zadania", "Просроченные задачи"), view.overdue.length.toString())}{detail(tr("Ostatnie wykonane działanie", "Последнее выполненное действие"), view.lastAction ? `${taskTypeText(view.lastAction.type, language)} · ${dateTime(view.lastAction.at)}` : undefined)}{detail(tr("Ostatnia wiadomość przychodząca", "Последнее входящее сообщение"), view.lastIncoming?.text ?? view.lastIncoming?.type)}
          {hasPermission("patient:view_medical") && detail(tr("Plany leczenia", "Планы лечения"), treatmentPlans.length ? `${treatmentPlans.length} · ${tr("aktualny", "текущий")} v${treatmentPlans[0].version} (${treatmentPlans[0].status})` : tr("Brak planu z Medical CRM", "Нет плана из Medical CRM"))}
        </dl></section>
        <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{tr("Kanały kontaktu", "Каналы связи")}</h3>{view.identities.length === 0 && <p className="text-sm text-muted-foreground">{tr("Brak kontaktów.", "Нет контактов.")}</p>}{view.identities.map(item => <div key={item.id} className="flex flex-wrap gap-2 text-sm"><strong>{channelText(item.channel, language)}</strong><span className="break-all">{item.displayName ?? item.value} {item.displayName && `· ${item.value}`}</span><Badge variant="outline">{item.verified ? tr("Zweryfikowany · tylko do odczytu", "Подтверждён · только чтение") : tr("Lokalny / niezweryfikowany", "Локальный / неподтверждённый")}</Badge>{!item.patientId && <Badge variant="outline">{tr("Kontakt niepowiązany", "Несвязанный контакт")}</Badge>}</div>)}<p className="whitespace-pre-wrap break-words text-sm">{patient.localNote || tr("Brak lokalnej notatki.", "Нет локальной заметки.")}</p></section>
      </TabsContent>
      {hasPermission("case:view") && <TabsContent value="cases" className="space-y-3">
        {!view.cases.length && <p className="rounded border p-4 text-sm">{tr("Pacjent nie ma spraw. Utwórz nową sprawę z istniejącym kontaktem.", "У пациента нет кейсов. Создайте новый кейс с существующим контактом.")}</p>}
        {view.cases.map(item => {
          const caseTasks = view.tasks.filter(task => task.caseId === item.id)
          const next = caseTasks.find(task => !["completed", "cancelled", "failed"].includes(task.status))
          const last = view.interactions.find(interaction => interaction.caseId === item.id)
          const unread = view.threads.filter(thread => thread.caseId === item.id).reduce((sum, thread) => sum + thread.unread, 0)
          const matching = view.matches.filter(decision => decision.caseId === item.id).at(-1)
          return <article key={item.id} className={cn("space-y-3 rounded-lg border-l-4 bg-card p-4", getClinicTone(item.clinicId).chip)}>
            <div className="flex flex-wrap justify-between gap-2"><strong>{item.id} · {item.board}</strong><span>{(() => { const stage = BOARD_COLUMNS[item.board].find(column => column.id === item.status); return stage ? t(stage.labelKey) : item.status })()} · {isCaseActive(item) ? tr("Aktywna", "Активен") : tr("Zamknięta", "Закрыт")}</span></div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{detail(tr("Klinika / usługa", "Клиника / услуга"), `${getClinic(item.clinicId)?.name ?? tr("Nieprzypisana", "Не назначена")} / ${getProcedure(item.serviceInterest)?.name ?? tr("Brak", "Нет")}`)}{detail(tr("Lekarz", "Врач"), getDoctor(item.doctorId)?.name)}{detail(tr("Źródło / kanał", "Источник / канал"), `${item.attribution.caseCreationTouch.source} / ${channelText(item.attribution.caseCreationTouch.channel, language)}`)}{detail(tr("Odpowiedzialny", "Ответственный"), actor(item.responsibleTeamId))}{detail(tr("Utworzono", "Создан"), dateTime(item.createdAt))}{detail(tr("Ostatnie działanie", "Последнее действие"), last ? `${taskTypeText(last.type, language)} · ${dateTime(last.at)}` : undefined)}{detail(tr("Następna czynność / zadanie", "Следующее действие / задача"), next ? <>{taskTitle(next)} · {next.dueAt ? dateTime(next.dueAt) : tr("Bez terminu", "Без срока")}</> : tr("Nie ustalono", "Не определено"))}{detail(tr("Powiązanie pacjenta / nieprzeczytane", "Связь с пациентом / непрочитанные"), `${patientLinkLabel(resolvePatientLinkState(item, patient, matching), language)} / ${unread}`)}</dl>
            {caseTasks.some(task => isOverdue(task)) && <Badge variant="destructive">{tr("Przeterminowane zadanie", "Просроченная задача")}</Badge>}
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openCase(item.id)}>{tr("Otwórz kartę sprawy", "Открыть карточку кейса")}</Button>{hasPermission("communication:view") && <Button size="sm" variant="outline" onClick={() => communication(item.id)}>{tr("Komunikacja sprawy", "Коммуникации кейса")}</Button>}<Patient360Actions patientId={patientId} caseId={item.id} /></div>
          </article>
        })}
      </TabsContent>}
      {hasPermission("task:view") && <TabsContent value="tasks" className="space-y-4">
        {!view.tasks.length && <p className="rounded border p-4 text-sm">{tr("Brak zadań pacjenta.", "У пациента нет задач.")}</p>}
        {Object.entries(taskGroups).map(([group, label]) => {
          const tasks = view.tasks.filter(item => patientTaskGroup(item) === group)
          return <section key={group} className="space-y-2"><h3 className="font-semibold">{localized(label)} ({tasks.length})</h3>{tasks.map(task => <article key={task.id} className="space-y-2 rounded border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{task.priority} · {taskTitle(task)}</strong><span>{task.dueAt ? dateTime(task.dueAt) : tr("Bez terminu", "Без срока")}</span></div>
            <p>{task.caseId} · {taskStatusText(task.status, language)} · {tr("odpowiedzialny", "ответственный")}: {actor(task.ownerId)} · {tr("typ", "тип")}: {taskTypeText(taskType(task), language)} · {tr("wymaga telefonu", "нужен звонок")}: {task.requiresCall ? tr("Tak", "Да") : tr("Nie", "Нет")} · {tr("próby", "попытки")}: {task.attempts}</p>
            <p className="text-sm text-muted-foreground">{taskDescription(task)}</p><TaskActions task={task}/><p>{tr("Ostatnie", "Последнее")}: {task.outcome ?? task.skipReason ?? tr("Brak wyniku", "Нет результата")} · {tr("Następne", "Следующее")}: {["completed", "cancelled", "failed"].includes(task.status) ? tr("Zachowane w historii", "Сохранено в истории") : task.requiresCall ? tr("Połączenie + wynik w podsumowaniu", "Звонок + результат в итогах") : taskTitle(task)}</p>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openCase(task.caseId)}>{tr("Sprawa", "Кейс")}</Button>

            </div>
          </article>)}</section>
        })}
      </TabsContent>}
      {hasPermission("communication:view") && <TabsContent value="communications"><div className="h-[min(760px,80vh)] min-h-[460px] overflow-hidden rounded-xl border"><PatientConversationWorkspace key={`${patientId}/${communicationCase}/${communicationSms}`} patientId={patientId} currentCaseId={communicationCase || primaryCase?.id || ""} authorId={store.currentUser.id} initialView={communicationSms ? "sms" : undefined} /></div></TabsContent>}
      {(hasPermission("communication:view") || hasPermission("audit:view")) && <TabsContent value="activity" className="space-y-2">
        {!view.activity.length && <p className="p-4 text-sm text-muted-foreground">{tr("Brak aktywności w dozwolonym zakresie.", "Нет доступной активности.")}</p>}
        {view.activity.map(entry => <article key={entry.id} className="space-y-1 rounded border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{entry.interaction ? `${entry.interaction.type} · ${entry.interaction.direction ?? tr("System", "Система")}` : tr("Operacja CRM", "Операция CRM")}</strong><span className="text-xs">{dateTime(entry.at)}</span></div><p className="whitespace-pre-wrap break-words">{entry.interaction?.text ?? entry.events[0]?.summary ?? tr("Połączenie", "Звонок")}</p>{entry.interaction && <p className="text-xs">{actor(entry.interaction.authorId)} {isSmsMessage(entry.interaction) && `· ${getSmsStatusLabel(entry.interaction)}`}</p>}{entry.caseId && <button className="text-xs underline" onClick={() => openCase(entry.caseId!)}>{entry.caseId}</button>}{entry.events.length > 0 && <details className="text-xs"><summary>{entry.events.length} {tr("powiązanych zdarzeń audytu · jedna operacja", "связанных событий аудита · одна операция")}</summary>{entry.events.map(event => <p key={event.id}>{actor(event.actorId)} · {event.summary}</p>)}</details>}</article>)}
      </TabsContent>}
      {hasPermission("case:view") && <TabsContent value="comments" className="space-y-3">
        {hasPermission("case:edit") && <div className="space-y-2 rounded border p-3"><select aria-label={tr("Sprawa komentarza", "Кейс комментария")} className="max-w-full rounded border bg-background p-2 text-sm" value={commentCase} onChange={event => setCommentCase(event.target.value)}><option value="">{tr("Wybierz sprawę komentarza", "Выберите кейс для комментария")}</option>{view.cases.map(item => <option key={item.id}>{item.id}</option>)}</select><Textarea aria-label={tr("Komentarz pracownika", "Комментарий сотрудника")} value={comment} onChange={event => setComment(event.target.value)} /><Button size="sm" disabled={!comment.trim() || !commentCase} onClick={() => command(() => { store.addCaseComment(commentCase, comment); setComment("") })}>{tr("Dodaj komentarz", "Добавить комментарий")}</Button></div>}
        {!view.comments.length && <p className="text-sm text-muted-foreground">{tr("Brak komentarzy pracowników.", "Нет комментариев сотрудников.")}</p>}{view.comments.map(item => <article key={item.id} className="rounded border p-3 text-sm"><p className="text-xs">{actor(item.authorId)} · {dateTime(item.at)} · <button className="underline" onClick={() => openCase(item.caseId)}>{item.caseId}</button></p><p className="whitespace-pre-wrap break-words">{item.text}</p></article>)}
      </TabsContent>}
      {hasPermission("patient:view_medical") && <TabsContent value="medical" className="space-y-4"><section className="space-y-4 rounded border p-4"><h3 className="font-semibold">Medical CRM · {tr("tylko do odczytu", "только чтение")}</h3><p className="text-xs text-muted-foreground">{tr("Medical CRM jest źródłem prawdy. Dane poniżej nie są edytowane lokalnie.", "Medical CRM — источник достоверных данных. Данные ниже нельзя редактировать локально.")}</p><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{detail(tr("Zewnętrzny ID pacjenta", "Внешний ID пациента"), patient.externalPatientId)}{detail(tr("Stan integracji", "Состояние интеграции"), integrationLabel(patient.integrationState))}{detail(tr("Ostatnia synchronizacja", "Последняя синхронизация"), patient.lastSyncAt ? dateTime(patient.lastSyncAt) : undefined)}{detail("PESEL", patient.pesel)}{detail(tr("Klinika główna", "Основная клиника"), getClinic(patient.primaryClinicId)?.name)}{detail(tr("Adres zamieszkania", "Адрес проживания"), address)}{detail(tr("Telefon", "Телефон"), phone?.value)}{detail("E-mail", email?.value)}{detail(tr("Konto pacjenta", "Аккаунт пациента"), localized(portalStatus[patient.portalAccount?.status ?? "none"]))}{detail(tr("Ostatnie logowanie", "Последний вход"), patient.portalAccount?.lastLoginAt ? dateTime(patient.portalAccount.lastLoginAt) : undefined)}</dl>
        {["sync_failed", "unlinked", "sync_pending"].includes(patient.integrationState) && <p role="status" className="text-amber-700">{integrationLabel(patient.integrationState)} — {tr("dane mogą być nieaktualne lub niedostępne.", "данные могут быть неактуальны или недоступны.")}</p>}
        {patient.conflicts?.map(item => <p key={item.field} className="break-words text-sm text-destructive">{tr("Konflikt", "Конфликт")} {item.field}: {item.localValue} / Medical CRM: {item.medicalValue}</p>)}
        <div className="space-y-2"><h4 className="font-medium">{tr("Alergie", "Аллергии")}</h4>{patient.allergies?.length ? patient.allergies.map(item => <p key={item.id} className="rounded border p-2 text-sm"><strong>{item.substance}</strong> · {item.severity ?? tr("nieznane", "неизвестно")} · {item.status}{item.reaction ? ` · ${item.reaction}` : ""}</p>) : <p className="text-sm text-muted-foreground">{tr("Brak danych o alergiach.", "Нет данных об аллергиях.")}</p>}</div>
        <div className="space-y-3"><h4 className="font-medium">{tr("Plany leczenia", "Планы лечения")} ({treatmentPlans.length})</h4>{treatmentPlans.length ? treatmentPlans.map(plan => <article key={`${plan.id}/${plan.version}`} className="space-y-1 rounded border p-3 text-sm"><strong>v{plan.version} · {plan.status}</strong>{plan.items.map(item => <p key={item.id}>{item.name}{item.price !== undefined ? ` · ${item.price} ${plan.currency}` : ""}</p>)}<p>{tr("Razem", "Итого")}: {plan.totalValue} {plan.currency} · {tr("aktualizacja", "обновление")}: {dateTime(plan.date)}</p><p>{tr("Dokument", "Документ")}: {plan.documentName ?? tr("Brak dokumentu", "Нет документа")}</p></article>) : <p className="text-sm text-muted-foreground">{tr("Brak planu leczenia / dokumentów z Medical CRM.", "Нет плана лечения / документов из Medical CRM.")}</p>}{patient.treatmentPlan && primaryCase && hasPermission("task:work") && <Button size="sm" variant="outline" onClick={() => command(() => { store.sendTreatmentPlanTask(patientId, primaryCase.id, store.currentUser.id); setNotice(tr("Utworzono istniejące zadanie wysyłki planu.", "Создана задача отправки плана лечения.")) })}>{tr("Utwórz zadanie wysyłki planu", "Создать задачу отправки плана")}</Button>}</div>
        <div className="space-y-2"><h4 className="font-medium">{tr("Wizyty", "Визиты")} ({medicalVisits.length})</h4>{medicalVisits.length ? medicalVisits.map(visit => <article key={visit.id} className="grid gap-2 rounded border p-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><strong>{dateTime(visit.startsAt)}</strong><span>{localized(visitStatus[visit.status])}</span><span>{getClinic(visit.clinicId)?.name ?? visit.clinicId}</span><span>{tr("Lekarz", "Врач")}: {getDoctor(visit.doctorId)?.name ?? tr("Brak danych", "Нет данных")}</span><span>{tr("Procedura", "Процедура")}: {getProcedure(visit.procedureId)?.name ?? tr("Brak danych", "Нет данных")}</span><span>{tr("Plan", "План")}: {visit.treatmentPlanId ?? tr("Brak", "Нет")}</span><span className="text-xs text-muted-foreground">Medical CRM: {visit.externalVisitId} · {tr("synchronizacja", "синхронизация")} {dateTime(visit.lastSyncAt)}</span></article>) : <p className="text-sm text-muted-foreground">{tr("Brak wizyt w projekcji Medical CRM.", "В Medical CRM нет визитов.")}</p>}</div>
        <h4 className="font-medium">{tr("Lekarze i procedury powiązanych spraw", "Врачи и процедуры связанных кейсов")}</h4>{view.cases.map(item => <p key={item.id} className="text-sm">{item.id} · {getDoctor(item.doctorId)?.name ?? tr("Brak lekarza", "Нет врача")} · {getProcedure(item.serviceInterest)?.name ?? tr("Brak procedury", "Нет процедуры")}</p>)}
        <h4 className="font-medium">{tr("Pochodzenie dostępnych danych", "Происхождение доступных данных")}</h4>{patient.provenance.map((item, index) => <p key={`${item.field}/${index}`} className="break-words text-xs">{item.field}: {item.value} · {item.source}</p>)}
      </section></TabsContent>}
    </Tabs>
  </div>
}
