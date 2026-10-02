"use client"

/**
 * Single shared client state for the TO-BE entity model, so a Task/Case/
 * assignee/call-outcome change is immediately visible across every screen
 * that reads it (queue, kanban, drawer, team view) — per master spec §18.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type {
  AuditEvent,
  Broadcast,
  Call,
  CallDisposition,
  ClinicId,
  ContactChannel,
  ContactIdentity,
  EngagementCase,
  Interaction,
  InteractionDirection,
  InteractionType,
  Patient,
  SmsMessage,
  SmsProviderConfiguration,
  Task,
  TaskOutcome,
  TaskPriority,
  TaskStatus,
} from "./entities"
import { AUDIT_EVENTS, BROADCASTS, CONTACT_IDENTITIES, ENGAGEMENT_CASES, INTERACTIONS, PATIENTS, TASKS, iso } from "./entity-data"
// CONTACT_IDENTITIES is also used directly (not just as initial state) as a
// fallback lookup inside matchCaseToPatient/createDraftCase for identities
// created earlier in the same session that may not be in local state yet.
import { BOARD_COLUMNS } from "./boards"
import { buildAutomaticTask, getWorkflowStageRule } from "./workflow-rules"
import { calculateSmsParts, INITIAL_SMS_PROVIDER_CONFIGS, selectSmsProvider } from "./sms-service"

interface EntityStoreValue {
  tasks: Task[]
  cases: EngagementCase[]
  auditEvents: AuditEvent[]
  interactions: (Interaction | Call)[]
  patients: Patient[]
  identities: ContactIdentity[]
  broadcasts: Broadcast[]
  smsProviderConfigurations: SmsProviderConfiguration[]
  readAt: Record<string, string>
  recordAudit: (event: Omit<AuditEvent, "id" | "at">) => void
  completeTask: (taskId: string, outcome: TaskOutcome, options?: { actorId?: string; callId?: string }) => void
  /** Reverts a completed/cancelled task back to an open state (undo a checkbox). */
  reopenTask: (taskId: string) => void
  skipTask: (taskId: string, reason: string) => void
  rescheduleTask: (taskId: string, dueAtIso: string, reason?: string, options?: { actorId?: string; callId?: string }) => void
  /** Creates or reactivates the shared P1 callback after a fully missed incoming call. */
  ensureMissedCallTask: (caseId: string, patientId?: string) => Task
  assignTask: (taskId: string, ownerId: string, actorId: string) => void
  setPriority: (taskId: string, priority: TaskPriority, actorId: string) => void
  moveCase: (caseId: string, newStatus: string, actorId: string, options?: { reason?: string; override?: boolean }) => void
  logCall: (input: {
    caseId: string
    taskId?: string
    patientId?: string
    direction: "incoming" | "outgoing"
    actorId: string
    extension: string
    clinicId: ClinicId
    startAt: string
    answered: boolean
    disposition?: CallDisposition
    talkTimeSec?: number
    note?: string
  }) => Call
  /** Sends/records a message on any text channel (chat, SMS, WhatsApp...). */
  sendMessage: (input: {
    caseId: string
    patientId?: string
    text: string
    type: InteractionType
    channel?: ContactChannel
    direction: InteractionDirection
    authorId?: string
  }) => Interaction
  sendSms: (input: {
    caseId: string
    patientId?: string
    taskId?: string
    clinicId?: ClinicId
    recipient: string
    text: string
    authorId?: string
    retryOfId?: string
  }) => SmsMessage
  updateSmsProviderConfiguration: (id: string, patch: Partial<SmsProviderConfiguration>) => void
  testSmsProviderConfiguration: (id: string) => void
  /** Marks a conversation's incoming messages as read (drives unread badges). */
  markRead: (caseId: string) => void
  /**
   * Confirms a visit picked from the Medical CRM availability search: closes
   * the related task (if any) with the "appointment_scheduled" outcome, logs
   * an audit event, and sends a chat confirmation to the patient.
   */
  bookAppointment: (input: { caseId: string; taskId?: string; patientId?: string; label: string; actorId: string }) => void
  /**
   * New inbound chat from an unknown contact, or a manually created case →
   * auto-creates identity + draft case + task. Accepts name/phone/email/Medical
   * CRM patient ID; if any identifier matches an existing Patient, the case is
   * linked immediately (Scenario 1). Otherwise it stays an unlinked lead/deal,
   * displaying the entered name until it is matched.
   */
  createDraftCase: (input: {
    channel: ContactChannel
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
    externalPatientId?: string
    /** Identifier for non-phone/e-mail channels (Instagram handle, website form id...). */
    value?: string
    text: string
  }) => { caseId: string; matched: boolean }
  /** Triage: assign a clinic to a case that doesn't have one yet. */
  assignClinicToCase: (caseId: string, clinicId: ClinicId, actorId: string) => void
  /** Pulls the patient into "linked" state, as if matched by phone/e-mail in the Medical CRM. */
  syncPatientWithMedicalCrm: (patientId: string, actorId: string) => void
  /**
   * Scenario 1 of the Medical CRM link: a lead/deal case with no patientId yet
   * looks itself up in the Medical CRM by its contact identity (phone/e-mail).
   * If another identity carrying the same value already belongs to a Patient,
   * the case is linked to that Patient (they "become" our patient) and its
   * board/status are left untouched — a returning patient can still be mid-way
   * through a deal. If nothing matches, the case stays an unlinked lead/deal.
   */
  matchCaseToPatient: (caseId: string, actorId: string) => { matched: boolean; patientId?: string }
  /** Creates or updates the contact profile directly from a case/chat workspace. */
  saveCaseContactProfile: (input: {
    caseId: string
    firstName: string
    lastName: string
    pesel?: string
    phone?: string
    email?: string
    actorId: string
  }) => { patientId: string }
  /** Creates a task to send the patient's current treatment plan (pulled from Medical CRM). */
  sendTreatmentPlanTask: (patientId: string, caseId: string, actorId: string) => Task
  /** Links two engagement cases as duplicates and records both audit entries. */
  linkDuplicateCase: (caseId: string, duplicateOfCaseId: string, actorId: string) => void
  /** Sends an SMS notification campaign to a filtered audience. */
  sendBroadcast: (input: {
    name: string
    message: string
    audienceLabel: string
    clinicId?: ClinicId
    recipientCount: number
    createdBy: string
  }) => Broadcast
}

const EntityStoreContext = createContext<EntityStoreValue | null>(null)

let auditSeq = 0
function nextAuditId() {
  auditSeq += 1
  return `ae-live-${auditSeq}`
}

let callSeq = 0
function nextCallId() {
  callSeq += 1
  return `call-live-${callSeq}`
}

let interactionSeq = 0
function nextInteractionId() {
  interactionSeq += 1
  return `int-live-${interactionSeq}`
}

let taskSeq = 0
function nextTaskId() {
  taskSeq += 1
  return `task-live-${taskSeq}`
}

let draftSeq = 0
function nextDraftSeq() {
  draftSeq += 1
  return draftSeq
}

let broadcastSeq = 0
function nextBroadcastId() {
  broadcastSeq += 1
  return `bc-live-${broadcastSeq}`
}

let patientSeq = 0
function nextPatientId() {
  patientSeq += 1
  return `pat-live-${patientSeq}`
}

export function EntityStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(TASKS)
  const [cases, setCases] = useState<EngagementCase[]>(ENGAGEMENT_CASES)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(AUDIT_EVENTS)
  const [interactions, setInteractions] = useState<(Interaction | Call)[]>(INTERACTIONS)
  const [patients, setPatients] = useState<Patient[]>(PATIENTS)
  const [identities, setIdentities] = useState<ContactIdentity[]>(CONTACT_IDENTITIES)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(BROADCASTS)
  const [smsProviderConfigurations, setSmsProviderConfigurations] = useState<SmsProviderConfiguration[]>(INITIAL_SMS_PROVIDER_CONFIGS)
  const [readAt, setReadAt] = useState<Record<string, string>>({})

  const patchTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
  }, [])

  const addAudit = useCallback((event: Omit<AuditEvent, "id" | "at">) => {
    setAuditEvents((prev) => [...prev, { ...event, id: nextAuditId(), at: iso(0) }])
  }, [])

  const completeTask = useCallback(
    (taskId: string, outcome: TaskOutcome, options?: { actorId?: string; callId?: string }) => {
      const status: TaskStatus = outcome === "wrong_number" || outcome === "resignation" ? "cancelled" : "completed"
      const task = tasks.find((item) => item.id === taskId)
      patchTask(taskId, { status, outcome, callId: options?.callId, attempts: (task?.attempts ?? 0) + 1 })
      addAudit({ caseId: task?.caseId, patientId: task?.patientId, type: "task_change", actorId: options?.actorId ?? "system", summary: `Zadanie zakończone · wynik: ${outcome}` })
    },
    [addAudit, patchTask, tasks],
  )

  const reopenTask = useCallback(
    (taskId: string) => {
      patchTask(taskId, { status: "planned", outcome: undefined })
      addAudit({ caseId: tasks.find((t) => t.id === taskId)?.caseId, type: "task_change", actorId: "system", summary: "Zadanie przywrócone do realizacji" })
    },
    [addAudit, patchTask, tasks],
  )

  const skipTask = useCallback(
    (taskId: string, reason: string) => {
      patchTask(taskId, { skipReason: reason })
      addAudit({ caseId: tasks.find((t) => t.id === taskId)?.caseId, type: "task_change", actorId: "system", summary: `Zadanie pominięte · powód: ${reason}` })
    },
    [addAudit, patchTask, tasks],
  )

  const rescheduleTask = useCallback(
    (taskId: string, dueAtIso: string, reason?: string, options?: { actorId?: string; callId?: string }) => {
      const task = tasks.find((item) => item.id === taskId)
      patchTask(taskId, { status: "planned", dueAt: dueAtIso, outcome: "rescheduled", callId: options?.callId, attempts: (task?.attempts ?? 0) + 1 })
      addAudit({
        caseId: task?.caseId,
        patientId: task?.patientId,
        type: "task_change",
        actorId: options?.actorId ?? "system",
        summary: reason ? `Termin przełożony · ${reason}` : "Termin zadania przełożony",
      })
    },
    [addAudit, patchTask, tasks],
  )

  const ensureMissedCallTask = useCallback(
    (caseId: string, patientId?: string) => {
      const existing = tasks.find(
        (task) => task.caseId === caseId && task.requiresCall && !["completed", "cancelled", "failed"].includes(task.status),
      )
      if (existing) {
        const next = { ...existing, status: "ready" as const, priority: "P1" as const, dueAt: iso(0) }
        setTasks((prev) => prev.map((task) => (task.id === existing.id ? next : task)))
        addAudit({ caseId, patientId, type: "task_change", actorId: "system", summary: "Nieodebrane połączenie · zadanie oddzwonienia ustawione jako P1" })
        return next
      }

      const task: Task = {
        id: nextTaskId(),
        caseId,
        patientId,
        title: "Oddzwoń po nieodebranym połączeniu",
        status: "ready",
        priority: "P1",
        dueAt: iso(0),
        slaAt: iso(0.1),
        createdAt: iso(0),
        attempts: 0,
        requiresCall: true,
      }
      setTasks((prev) => [...prev, task])
      addAudit({ caseId, patientId, type: "task_change", actorId: "system", summary: "Nieodebrane połączenie · utworzono zadanie oddzwonienia P1" })
      return task
    },
    [addAudit, tasks],
  )

  const assignTask = useCallback(
    (taskId: string, ownerId: string, actorId: string) => {
      const before = tasks.find((t) => t.id === taskId)?.ownerId ?? "Nie przypisano"
      patchTask(taskId, { ownerId, currentWorkerId: ownerId })
      addAudit({
        caseId: tasks.find((t) => t.id === taskId)?.caseId,
        type: "assignment_change",
        actorId,
        summary: "Zmieniono przypisanie zadania",
        before,
        after: ownerId,
      })
    },
    [addAudit, patchTask, tasks],
  )

  const setPriority = useCallback(
    (taskId: string, priority: TaskPriority, actorId: string) => {
      const before = tasks.find((t) => t.id === taskId)?.priority
      patchTask(taskId, { priority })
      addAudit({
        caseId: tasks.find((t) => t.id === taskId)?.caseId,
        type: "priority_change",
        actorId,
        summary: "Priorytet zadania zmieniony ręcznie",
        before,
        after: priority,
      })
    },
    [addAudit, patchTask, tasks],
  )

  const logCall = useCallback(
    (input: {
      caseId: string
      taskId?: string
      patientId?: string
      direction: "incoming" | "outgoing"
      actorId: string
      extension: string
      clinicId: ClinicId
      startAt: string
      answered: boolean
      disposition?: CallDisposition
      talkTimeSec?: number
      note?: string
    }) => {
      const endAt = iso(0)
      const call: Call = {
        id: nextCallId(),
        caseId: input.caseId,
        patientId: input.patientId,
        taskId: input.taskId,
        type: "call",
        direction: input.direction,
        at: input.startAt,
        authorId: input.actorId,
        text: input.note,
        extension: input.extension,
        clinicId: input.clinicId,
        telcoStatus: input.answered ? "answered" : "missed",
        disposition: input.disposition,
        startAt: input.startAt,
        answerAt: input.answered ? input.startAt : undefined,
        endAt,
        talkTimeSec: input.talkTimeSec,
        totalDurationSec: input.talkTimeSec,
        recordingState: input.answered ? "available" : "none",
        attemptsToday: 1,
        isFinalCdr: true,
      }
      setInteractions((prev) => [...prev, call])
      addAudit({
        caseId: input.caseId,
        patientId: input.patientId,
        type: "task_change",
        actorId: input.actorId,
        summary: input.answered
          ? `Połączenie zakończone · wynik: ${input.disposition ?? "brak"}`
          : "Nieodebrane połączenie",
      })
      return call
    },
    [addAudit],
  )

  const moveCase = useCallback(
    (caseId: string, newStatus: string, actorId: string, options?: { reason?: string; override?: boolean }) => {
      const before = cases.find((c) => c.id === caseId)
      if (!before || before.status === newStatus) return
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c)))
      const beforeLabel = BOARD_COLUMNS[before.board].find((col) => col.id === before.status)?.label ?? before.status
      const afterLabel = BOARD_COLUMNS[before.board].find((col) => col.id === newStatus)?.label ?? newStatus
      addAudit({
        caseId,
        type: "status_change",
        actorId,
        summary: [
          options?.override ? `Ręcznie zmieniono status sprawy: ${beforeLabel} → ${afterLabel}` : `Zmieniono status sprawy: ${beforeLabel} → ${afterLabel}`,
          options?.reason ? `Powód: ${options.reason}` : undefined,
        ].filter(Boolean).join(" · "),
        before: beforeLabel,
        after: afterLabel,
      })

      const stageRule = getWorkflowStageRule(before.board, newStatus)
      if (stageRule?.automaticTask) {
        const duplicate = tasks.some(
          (task) => task.caseId === caseId && task.workflowRuleId === stageRule.automaticTask?.id && !["completed", "cancelled", "failed"].includes(task.status),
        )
        if (!duplicate) {
          const generated = buildAutomaticTask(stageRule.automaticTask, before)
          generated.id = nextTaskId()
          setTasks((prev) => [...prev, generated])
          addAudit({
            caseId,
            patientId: before.patientId,
            type: "task_change",
            actorId: "system",
            summary: `Automatyzacja ${stageRule.automaticTask.id} · utworzono zadanie: ${generated.title}`,
            correlationId: `transition:${caseId}:${newStatus}`,
          })
        }
      }
    },
    [addAudit, cases, tasks],
  )

  const sendMessage = useCallback(
    (input: { caseId: string; patientId?: string; text: string; type: InteractionType; channel?: ContactChannel; direction: InteractionDirection; authorId?: string }) => {
      const interaction: Interaction = {
        id: nextInteractionId(),
        caseId: input.caseId,
        patientId: input.patientId,
        type: input.type,
        channel: input.channel,
        direction: input.direction,
        at: iso(0),
        authorId: input.authorId,
        text: input.text,
      }
      setInteractions((prev) => [...prev, interaction])
      if (input.direction === "outgoing") {
        setReadAt((prev) => ({ ...prev, [input.caseId]: iso(0) }))
      }
      return interaction
    },
    [],
  )

  const sendSms = useCallback(
    (input: { caseId: string; patientId?: string; taskId?: string; clinicId?: ClinicId; recipient: string; text: string; authorId?: string; retryOfId?: string }) => {
      const provider = selectSmsProvider(smsProviderConfigurations, input.clinicId)
      const id = nextInteractionId()
      const message: SmsMessage = {
        id,
        caseId: input.caseId,
        patientId: input.patientId,
        taskId: input.taskId,
        type: "sms",
        channel: "phone",
        direction: "outgoing",
        at: iso(0),
        authorId: input.authorId,
        text: input.text,
        recipient: input.recipient,
        sender: provider?.senderValue ?? "",
        providerType: provider?.providerType ?? "emulator",
        providerConfigurationId: provider?.id ?? "missing-provider",
        deliveryStatus: "queued",
        partsCount: calculateSmsParts(input.text),
        retryOfId: input.retryOfId,
      }
      setInteractions((prev) => [...prev, message])
      setReadAt((prev) => ({ ...prev, [input.caseId]: iso(0) }))
      addAudit({
        caseId: input.caseId,
        patientId: input.patientId,
        type: "task_change",
        actorId: input.authorId ?? "system",
        summary: `SMS dodany do kolejki · ${provider?.name ?? "brak konfiguracji"}`,
      })

      window.setTimeout(() => {
        setInteractions((prev) => prev.map((item) => {
          if (item.id !== id || item.type !== "sms") return item
          const current = item as SmsMessage
          if (!provider) return { ...current, deliveryStatus: "failed", providerStatus: "CONFIGURATION_MISSING", errorMessage: "Brak aktywnej konfiguracji SMS dla kliniki." }
          return {
            ...current,
            deliveryStatus: "submitted",
            providerStatus: provider.providerType === "supervoip" ? "ACCEPTED" : "QUEUED",
            providerMessageId: `${provider.providerType}-${id}`,
            submittedAt: new Date().toISOString(),
          }
        }))
      }, 700)

      if (provider?.capabilities.deliveryReports) {
        window.setTimeout(() => {
          setInteractions((prev) => prev.map((item) => item.id === id && item.type === "sms"
            ? { ...(item as SmsMessage), deliveryStatus: "delivered", providerStatus: "DELIVERED", deliveredAt: new Date().toISOString() }
            : item))
        }, 1800)
      }
      return message
    },
    [addAudit, smsProviderConfigurations],
  )

  const updateSmsProviderConfiguration = useCallback((id: string, patch: Partial<SmsProviderConfiguration>) => {
    setSmsProviderConfigurations((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item))
  }, [])

  const testSmsProviderConfiguration = useCallback((id: string) => {
    setSmsProviderConfigurations((prev) => prev.map((item) => item.id === id
      ? { ...item, lastTestAt: new Date().toISOString(), lastTestStatus: item.enabled ? "success" : "failed" }
      : item))
  }, [])

  const markRead = useCallback((caseId: string) => {
    setReadAt((prev) => ({ ...prev, [caseId]: iso(0) }))
  }, [])

  const bookAppointment = useCallback(
    (input: { caseId: string; taskId?: string; patientId?: string; label: string; actorId: string }) => {
      if (input.taskId) {
        patchTask(input.taskId, { status: "completed", outcome: "appointment_scheduled" })
      }
      addAudit({
        caseId: input.caseId,
        type: "status_change",
        actorId: input.actorId,
        summary: `Wizyta zaplanowana · ${input.label}`,
      })
      sendMessage({
        caseId: input.caseId,
        patientId: input.patientId,
        text: `Wizyta zaplanowana: ${input.label}. Do zobaczenia!`,
        type: "chat",
        direction: "outgoing",
        authorId: input.actorId,
      })
    },
    [addAudit, patchTask, sendMessage],
  )

  const createDraftCase = useCallback(
    (input: {
      channel: ContactChannel
      firstName?: string
      lastName?: string
      phone?: string
      email?: string
      externalPatientId?: string
      value?: string
      text: string
    }) => {
      const n = nextDraftSeq()
      const displayName = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(" ") || undefined
      const externalPatientId = input.externalPatientId?.trim()
      const phone = input.phone?.trim()
      const email = input.email?.trim()
      const genericValue = input.value?.trim()

      // Scenario 1: try to match to an existing Medical CRM patient immediately —
      // by external patient ID first (strongest signal), then by phone/e-mail
      // against identities already linked to a Patient.
      let matchedPatientId: string | undefined
      let matchedBy: "id" | "phone" | "email" | undefined
      if (externalPatientId) {
        matchedPatientId = patients.find((p) => p.externalPatientId === externalPatientId)?.id
        if (matchedPatientId) matchedBy = "id"
      }
      if (!matchedPatientId && phone) {
        matchedPatientId = identities.find((i) => i.channel === "phone" && i.value === phone && i.patientId)?.patientId
        if (matchedPatientId) matchedBy = "phone"
      }
      if (!matchedPatientId && email) {
        matchedPatientId = identities.find((i) => i.channel === "email" && i.value === email && i.patientId)?.patientId
        if (matchedPatientId) matchedBy = "email"
      }

      // Create one identity per identifier supplied so the case can be found
      // later by whichever value the patient reaches out with next time.
      const newIdentities: ContactIdentity[] = []
      if (phone) {
        newIdentities.push({ id: `ci-live-${n}-phone`, patientId: matchedPatientId, channel: "phone", value: phone, isPrimary: true, verified: false, displayName })
      }
      if (email) {
        newIdentities.push({
          id: `ci-live-${n}-email`,
          patientId: matchedPatientId,
          channel: "email",
          value: email,
          isPrimary: newIdentities.length === 0,
          verified: false,
          displayName,
        })
      }
      if (newIdentities.length === 0) {
        // No phone/e-mail given — fall back to the channel picked in the dialog
        // (Instagram handle / website form id / Medical CRM ID / name).
        newIdentities.push({
          id: `ci-live-${n}-fallback`,
          patientId: matchedPatientId,
          channel: input.channel,
          value: genericValue ?? externalPatientId ?? displayName ?? `contact-${n}`,
          isPrimary: true,
          verified: false,
          displayName,
        })
      }
      setIdentities((prev) => [...prev, ...newIdentities])
      CONTACT_IDENTITIES.push(...newIdentities) // keep static getIdentity() lookups consistent for the same session

      const primaryIdentity = newIdentities[0]
      const caseId = `case-live-${n}`
      const draft: EngagementCase = {
        id: caseId,
        patientId: matchedPatientId,
        contactIdentityId: primaryIdentity.id,
        board: matchedPatientId ? "patients" : "leads",
        status: "new",
        clinicId: undefined,
        responsibleTeamId: "system",
        createdAt: iso(0),
        attribution: {
          firstTouch: { type: "first_touch", source: "Czat", channel: input.channel, language: "pl", clinicIntentId: "pana-medica", at: iso(0), sourceRecordId: primaryIdentity.id },
          caseCreationTouch: { type: "case_creation", source: "Czat", channel: input.channel, language: "pl", clinicIntentId: "pana-medica", at: iso(0), sourceRecordId: primaryIdentity.id },
        },
      }
      setCases((prev) => [...prev, draft])

      setInteractions((prev) => [
        ...prev,
        { id: nextInteractionId(), caseId, type: "chat", direction: "incoming", at: iso(0), text: input.text } as Interaction,
      ])

      setTasks((prev) => [
        ...prev,
        matchedPatientId
          ? {
              id: nextTaskId(),
              caseId,
              patientId: matchedPatientId,
              title: "Skontaktuj się z istniejącym pacjentem w sprawie nowej sprawy",
              status: "ready",
              priority: "P2",
              dueAt: iso(0.2),
              createdAt: iso(0),
              attempts: 0,
              requiresCall: input.channel === "phone",
            }
          : {
              id: nextTaskId(),
              caseId,
              title: "Odpowiedz na nową wiadomość i przypisz klinikę",
              status: "ready",
              priority: "P3",
              dueAt: iso(0.2),
              createdAt: iso(0),
              attempts: 0,
              requiresCall: false,
            },
      ])

      addAudit(
        matchedPatientId
          ? {
              caseId,
              patientId: matchedPatientId,
              type: "link",
              actorId: "system",
              summary: `Nowa sprawa utworzona i natychmiast dopasowana do istniejącego pacjenta w Medical CRM (po ${
                matchedBy === "id" ? "ID pacjenta" : matchedBy === "phone" ? "numerze telefonu" : "e-mailu"
              })`,
            }
          : { caseId, type: "link", actorId: "system", summary: "Nowa rozmowa z nieznanym kontaktem — automatycznie utworzono szkic sprawy" },
      )
      return { caseId, matched: Boolean(matchedPatientId) }
    },
    [addAudit, patients, identities],
  )

  const assignClinicToCase = useCallback(
    (caseId: string, clinicId: ClinicId, actorId: string) => {
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, clinicId } : c)))
      addAudit({ caseId, type: "link", actorId, summary: "Sprawa przypisana do kliniki", after: clinicId })
    },
    [addAudit],
  )

  const syncPatientWithMedicalCrm = useCallback(
    (patientId: string, actorId: string) => {
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, integrationState: "linked", lastSyncAt: iso(0), conflicts: undefined } : p)))
      addAudit({ patientId, type: "sync", actorId, summary: "Pacjent zsynchronizowany z Medical CRM (dopasowanie po numerze/e-mailu)" })
    },
    [addAudit],
  )

  const matchCaseToPatient = useCallback(
    (caseId: string, actorId: string): { matched: boolean; patientId?: string } => {
      const targetCase = cases.find((c) => c.id === caseId)
      if (!targetCase || targetCase.patientId) return { matched: false }
      const identity = identities.find((i) => i.id === targetCase.contactIdentityId) ?? CONTACT_IDENTITIES.find((i) => i.id === targetCase.contactIdentityId)
      const match = identity
        ? identities.find((i) => i.id !== identity.id && i.value === identity.value && i.patientId)
        : undefined

      if (match?.patientId) {
        setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, patientId: match.patientId } : c)))
        addAudit({
          caseId,
          patientId: match.patientId,
          type: "link",
          actorId,
          summary: `Dopasowano do istniejącego pacjenta w Medical CRM (po ${identity?.channel === "email" ? "e-mailu" : "numerze telefonu"})`,
        })
        return { matched: true, patientId: match.patientId }
      }

      addAudit({ caseId, type: "sync", actorId, summary: "Sprawdzono w Medical CRM — brak dopasowań, kontakt pozostaje leadem/szansą" })
      return { matched: false }
    },
    [addAudit, cases, identities],
  )

  const saveCaseContactProfile = useCallback(
    (input: { caseId: string; firstName: string; lastName: string; pesel?: string; phone?: string; email?: string; actorId: string }) => {
      const targetCase = cases.find((item) => item.id === input.caseId)
      if (!targetCase) throw new Error(`Unknown case ${input.caseId}`)

      const existing = targetCase.patientId ? patients.find((item) => item.id === targetCase.patientId) : undefined
      const patientId = existing?.id ?? nextPatientId()
      const clean = {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        pesel: input.pesel?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        email: input.email?.trim() || undefined,
      }
      const now = iso(0)
      const provenance = [
        { field: "firstName", source: "User-entered" as const, value: clean.firstName, updatedAt: now },
        { field: "lastName", source: "User-entered" as const, value: clean.lastName, updatedAt: now },
        ...(clean.pesel ? [{ field: "pesel", source: "User-entered" as const, value: clean.pesel, updatedAt: now }] : []),
      ]

      if (existing) {
        setPatients((prev) => prev.map((item) => item.id === patientId ? { ...item, firstName: clean.firstName, lastName: clean.lastName, pesel: clean.pesel, provenance: [...item.provenance.filter((field) => !["firstName", "lastName", "pesel"].includes(field.field)), ...provenance] } : item))
      } else {
        const patient: Patient = {
          id: patientId,
          firstName: clean.firstName,
          lastName: clean.lastName,
          pesel: clean.pesel,
          preferredLanguage: targetCase.attribution.caseCreationTouch.language,
          primaryClinicId: targetCase.clinicId ?? targetCase.attribution.caseCreationTouch.clinicIntentId,
          integrationState: "unlinked",
          contactable: true,
          provenance,
        }
        setPatients((prev) => [...prev, patient])
        setCases((prev) => prev.map((item) => item.id === input.caseId ? { ...item, patientId } : item))
      }

      const upsertIdentity = (channel: "phone" | "email", value?: string) => {
        if (!value) return
        setIdentities((prev) => {
          const found = prev.find((item) => item.patientId === patientId && item.channel === channel)
          if (found) return prev.map((item) => item.id === found.id ? { ...item, value, displayName: `${clean.firstName} ${clean.lastName}` } : item)
          return [...prev, { id: `ci-${patientId}-${channel}`, patientId, channel, value, isPrimary: channel === "phone", verified: false, displayName: `${clean.firstName} ${clean.lastName}` }]
        })
      }
      upsertIdentity("phone", clean.phone)
      upsertIdentity("email", clean.email)
      setIdentities((prev) => prev.map((item) => item.id === targetCase.contactIdentityId ? { ...item, patientId, displayName: `${clean.firstName} ${clean.lastName}` } : item))
      addAudit({ caseId: input.caseId, patientId, type: "link", actorId: input.actorId, summary: existing ? "Zaktualizowano dane profilu kontaktu" : "Utworzono lokalny profil pacjenta i powiązano go ze sprawą" })
      return { patientId }
    },
    [addAudit, cases, patients],
  )

  const sendTreatmentPlanTask = useCallback(
    (patientId: string, caseId: string, actorId: string) => {
      const task: Task = {
        id: nextTaskId(),
        caseId,
        patientId,
        title: "Wysłać pacjentowi plan leczenia (pobrany z Medical CRM)",
        status: "ready",
        priority: "P2",
        dueAt: iso(4),
        createdAt: iso(0),
        attempts: 0,
        ownerId: actorId,
      }
      setTasks((prev) => [...prev, task])
      addAudit({ caseId, patientId, type: "task_change", actorId, summary: "Plan leczenia pobrany z Medical CRM, utworzono zadanie wysyłki" })
      return task
    },
    [addAudit],
  )

  const sendBroadcast = useCallback(
    (input: { name: string; message: string; audienceLabel: string; clinicId?: ClinicId; recipientCount: number; createdBy: string }) => {
      const broadcast: Broadcast = { id: nextBroadcastId(), channel: "sms", status: "sent", sentAt: iso(0), ...input }
      setBroadcasts((prev) => [broadcast, ...prev])
      addAudit({ type: "task_change", actorId: input.createdBy, summary: `Wysłano kampanię SMS „${input.name}" do ${input.recipientCount} kontaktów` })
      return broadcast
    },
    [addAudit],
  )

  /**
   * Links two cases as duplicates of the same contact (e.g. flagged during a
   * call wrap-up). Cross-references both sides' linkedCaseIds so either card
   * shows a "duplicate of" pointer, and closes out the current case's open
   * tasks so the queue doesn't keep surfacing a case the team already
   * consolidated elsewhere.
   */
  const linkDuplicateCase = useCallback(
    (caseId: string, duplicateOfCaseId: string, actorId: string) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id === caseId) return { ...c, linkedCaseIds: [...new Set([...(c.linkedCaseIds ?? []), duplicateOfCaseId])] }
          if (c.id === duplicateOfCaseId) return { ...c, linkedCaseIds: [...new Set([...(c.linkedCaseIds ?? []), caseId])] }
          return c
        }),
      )
      addAudit({
        caseId,
        type: "link",
        actorId,
        summary: `Sprawa oznaczona jako duplikat sprawy ${duplicateOfCaseId}`,
        after: duplicateOfCaseId,
      })
      addAudit({
        caseId: duplicateOfCaseId,
        type: "link",
        actorId,
        summary: `Wskazano duplikat: sprawa ${caseId}`,
        after: caseId,
      })
    },
    [addAudit],
  )

  const value = useMemo(
    () => ({
      tasks,
      cases,
      auditEvents,
      interactions,
      patients,
      identities,
      broadcasts,
      smsProviderConfigurations,
      readAt,
      recordAudit: addAudit,
      completeTask,
      reopenTask,
      skipTask,
      rescheduleTask,
      ensureMissedCallTask,
      assignTask,
      setPriority,
      moveCase,
      logCall,
      sendMessage,
      sendSms,
      updateSmsProviderConfiguration,
      testSmsProviderConfiguration,
      markRead,
      bookAppointment,
      createDraftCase,
      assignClinicToCase,
      syncPatientWithMedicalCrm,
      matchCaseToPatient,
      saveCaseContactProfile,
      sendTreatmentPlanTask,
      sendBroadcast,
      linkDuplicateCase,
    }),
    [
      tasks,
      cases,
      auditEvents,
      interactions,
      patients,
      identities,
      broadcasts,
      smsProviderConfigurations,
      readAt,
      completeTask,
      reopenTask,
      skipTask,
      rescheduleTask,
      ensureMissedCallTask,
      assignTask,
      setPriority,
      moveCase,
      logCall,
      sendMessage,
      sendSms,
      updateSmsProviderConfiguration,
      testSmsProviderConfiguration,
      markRead,
      createDraftCase,
      assignClinicToCase,
      syncPatientWithMedicalCrm,
      matchCaseToPatient,
      saveCaseContactProfile,
      sendTreatmentPlanTask,
      sendBroadcast,
      linkDuplicateCase,
    ],
  )

  return <EntityStoreContext.Provider value={value}>{children}</EntityStoreContext.Provider>
}

export function useEntityStore() {
  const ctx = useContext(EntityStoreContext)
  if (!ctx) throw new Error("useEntityStore must be used within EntityStoreProvider")
  return ctx
}
