"use client"

/**
 * Single shared client state for the TO-BE entity model, so a Task/Case/
 * assignee/call-outcome change is immediately visible across every screen
 * that reads it (queue, kanban, drawer, team view) — per master spec §18.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  MatchDecision,
  PatientMatchInput,
  SmsMessage,
  SmsProviderConfiguration,
  Task,
  TaskOutcome,
  TaskPriority,
  TaskStatus,
} from "./entities"
import { AUDIT_EVENTS, BROADCASTS, CONTACT_IDENTITIES, ENGAGEMENT_CASES, INTERACTIONS, PATIENTS, TASKS, iso } from "./entity-data"
import { AccessCommandError } from "./permissions"
import { assessPatientMatch, assertMatchingAccess, caseMatchingInput, normalizedIdentityValue, normalizeMatchInput,
  normalizeMatchingEmail, normalizeMatchingPhone, normalizeMatchingPesel, patientWithinMatchingScope, redactMatchingReason,
  type MatchingAccess } from "./patient-matching-service"
import { BOARD_COLUMNS } from "./boards"
import { buildAutomaticTask, getWorkflowStageRule } from "./workflow-rules"
import { calculateSmsParts, emulatedSmsAdapter, isSmsMessage, INITIAL_SMS_PROVIDER_CONFIGS, selectSmsProvider } from "./sms-service"

export interface SmsSendInput {
  caseId?: string
  patientId?: string
  taskId?: string
  clinicId?: ClinicId
  recipient: string
  text: string
  authorId: string
  retryOfId?: string
  simulateError?: boolean
}

interface EntityStoreValue {
  tasks: Task[]
  cases: EngagementCase[]
  auditEvents: AuditEvent[]
  interactions: (Interaction | Call)[]
  patients: Patient[]
  identities: ContactIdentity[]
  broadcasts: Broadcast[]
  smsProviderConfigurations: SmsProviderConfiguration[]
  matchDecisions: MatchDecision[]
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
  }, access?: MatchingAccess) => Interaction
  sendSms: (input: SmsSendInput) => SmsMessage
  retrySms: (id: string, authorId: string, simulateError?: boolean) => SmsMessage
  updateSmsProviderConfiguration: (id: string, patch: Partial<SmsProviderConfiguration>, actorId: string) => void
  testSmsProviderConfiguration: (id: string, actorId: string) => void
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
    pesel?: string
    clinicId?: ClinicId
    /** Identifier for non-phone/e-mail channels (Instagram handle, website form id...). */
    value?: string
    text: string
  }, access?: MatchingAccess) => { caseId: string; matched: boolean }
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
  matchCaseToPatient: (caseId: string, actorId: string, access?: MatchingAccess, source?: "manual" | "incoming_call" | "incoming_message") => { matched: boolean; patientId?: string; decisionId: string }
  approvePatientMatch: (decisionId: string, patientId: string, reason: string, access?: MatchingAccess) => void
  rejectPatientMatch: (decisionId: string, reason: string, access?: MatchingAccess) => void
  /** Saves case-local matching input; never creates Patient or overwrites Medical CRM fields. */
  saveCaseContactProfile: (input: {
    caseId: string
    firstName: string
    lastName: string
    pesel?: string
    phone?: string
    email?: string
    externalPatientId?: string
    actorId: string
  }, access?: MatchingAccess) => { patientId?: string }
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

export function EntityStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(TASKS)
  const [cases, setCases] = useState<EngagementCase[]>(ENGAGEMENT_CASES)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(AUDIT_EVENTS)
  const [interactions, setInteractions] = useState<(Interaction | Call)[]>(INTERACTIONS)
  const [patients, setPatients] = useState<Patient[]>(PATIENTS)
  const [identities, setIdentities] = useState<ContactIdentity[]>(CONTACT_IDENTITIES)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(BROADCASTS)
  const [smsProviderConfigurations, setSmsProviderConfigurations] = useState<SmsProviderConfiguration[]>(INITIAL_SMS_PROVIDER_CONFIGS)
  const [matchDecisions, setMatchDecisions] = useState<MatchDecision[]>([])
  const matchingState = useRef({ cases, patients, identities, matchDecisions })
  matchingState.current = { cases, patients, identities, matchDecisions }
  const [readAt, setReadAt] = useState<Record<string, string>>({})

  const smsRequests = useRef(new Set<AbortController>())
  useEffect(() => () => {
    smsRequests.current.forEach((request) => request.abort())
    smsRequests.current.clear()
  }, [])

  const patchTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
  }, [])

  const addAudit = useCallback((event: Omit<AuditEvent, "id" | "at">) => {
    setAuditEvents((prev) => [...prev, { ...event, id: nextAuditId(), at: iso(0) }])
  }, [])

  const assessCase = (targetCase: EngagementCase) => assessPatientMatch(caseMatchingInput(targetCase, matchingState.current.identities),
    matchingState.current.patients, matchingState.current.identities, { casePatientId: targetCase.patientId,
      contactValues: matchingState.current.identities.filter(item => (targetCase.contactIdentityIds ?? [targetCase.contactIdentityId]).includes(item.id)),
      identityPatientIds: matchingState.current.identities.filter(item => (targetCase.contactIdentityIds ?? [targetCase.contactIdentityId]).includes(item.id)).map(item => item.patientId).filter((id): id is string => Boolean(id)) })
  const writeDecisions = (next: MatchDecision[]) => { matchingState.current.matchDecisions = next; setMatchDecisions(next) }
  const matchAudit = (type: AuditEvent["type"], decision: MatchDecision, actorId: string, patientId?: string, before?: string, after?: string) => {
    addAudit({ type, caseId: decision.caseId, patientId, actorId, matchDecisionId: decision.id, confidence: decision.confidence,
      matchedSignals: decision.matchedSignals, reason: redactMatchingReason(decision.reason), before: before ?? "search_requested", after: after ?? decision.decision, correlationId: decision.id,
      summary: `${type} · ${decision.decision} · ${decision.confidence} · ${decision.matchedSignals.join(", ")} · ${redactMatchingReason(decision.reason)}` })
  }
  const linkPatient = (decision: MatchDecision, patientId: string, actorId: string) => {
    const snapshot = matchingState.current
    const targetCase = snapshot.cases.find(item => item.id === decision.caseId)
    if (!targetCase || !snapshot.patients.some(item => item.id === patientId)) throw new AccessCommandError("Nie znaleziono sprawy lub pacjenta.")
    if (targetCase.patientId && targetCase.patientId !== patientId) throw new AccessCommandError("Sprawa jest już powiązana z innym pacjentem. Nie wykonano przeniesienia.")
    const ids = targetCase.contactIdentityIds ?? [targetCase.contactIdentityId]
    const contacts = snapshot.identities.filter(item => ids.includes(item.id))
    if (contacts.some(item => item.patientId && item.patientId !== patientId)) throw new AccessCommandError("Kontakt należy do innego pacjenta. Nie wykonano scalenia.")
    const replacements = new Map<string, string>()
    const linkedIds = new Set<string>()
    for (const identity of contacts) {
      const normalized = normalizedIdentityValue(identity)
      const reusable = normalized ? snapshot.identities.find(item => item.patientId === patientId && item.channel === identity.channel && normalizedIdentityValue(item) === normalized) : undefined
      if (reusable) { replacements.set(identity.id, reusable.id); matchAudit("contact_identity_reused", decision, actorId, patientId, identity.id, reusable.id) }
      else { linkedIds.add(identity.id); matchAudit("contact_identity_linked", decision, actorId, patientId, "unlinked", identity.id) }
    }
    const nextCases = snapshot.cases.map(item => item.id === targetCase.id ? { ...item, patientId,
      contactIdentityId: replacements.get(item.contactIdentityId) ?? item.contactIdentityId,
      contactIdentityIds: [...new Set(ids.map(id => replacements.get(id) ?? id))] } : item)
    const nextIdentities = snapshot.identities.map(item => linkedIds.has(item.id) ? { ...item, patientId } : item)
    snapshot.cases = nextCases; snapshot.identities = nextIdentities
    setCases(nextCases); setIdentities(nextIdentities)
    setTasks(prev => prev.map(item => item.caseId === targetCase.id && !item.patientId ? { ...item, patientId } : item))
    setInteractions(prev => prev.map(item => item.caseId === targetCase.id && !item.patientId ? { ...item, patientId } : item))
    // No Patient/medical fields, attribution, task lifecycle, case status or other cases are changed.
  }
  const matchCaseToPatient = useCallback((caseId: string, _actorId: string, access?: MatchingAccess, source: "manual" | "incoming_call" | "incoming_message" = "manual") => {
    const targetCase = matchingState.current.cases.find(item => item.id === caseId)
    assertMatchingAccess(access, source === "incoming_call" ? "call:handle" : source === "incoming_message" ? "case:edit" : "patient:edit_local", targetCase)
    if (!targetCase) throw new AccessCommandError("Nie znaleziono sprawy.")
    const result = assessCase(targetCase)
    const candidate = result.candidates[0] ? matchingState.current.patients.find(item => item.id === result.candidates[0].candidatePatientId) : undefined
    const outsideScope = result.decision === "auto_link" && candidate && !patientWithinMatchingScope(candidate, access)
    const outcome = outsideScope ? "suggested_match" : result.decision
    const now = new Date().toISOString()
    const decision: MatchDecision = { id: `match-${nextAuditId()}`, caseId, candidates: result.candidates,
      candidatePatientId: result.candidates.length === 1 ? result.candidates[0].candidatePatientId : undefined,
      confidence: result.candidates[0]?.confidence ?? 0, matchedSignals: result.candidates[0]?.matchedSignals ?? [],
      conflictingSignals: [...new Set(result.candidates.flatMap(item => item.conflictingSignals))],
      status: outcome === "auto_link" ? "auto_linked" : outcome === "conflict" ? "conflict" : "pending",
      createdAt: now, decision: outcome, reason: outsideScope ? "Kandydat wymaga sprawdzenia przez użytkownika z odpowiednim zakresem klinik." : result.reason,
      fingerprint: result.fingerprint, ...(outcome === "auto_link" ? { resolvedAt: now, resolvedBy: "system" } : {}) }
    if (outcome === "auto_link" && candidate) linkPatient(decision, candidate.id, "system")
    writeDecisions([...matchingState.current.matchDecisions.map(item => item.caseId === caseId && ["pending", "conflict"].includes(item.status)
      ? { ...item, status: "expired" as const, resolvedAt: now, resolvedBy: "system" } : item), decision])
    matchAudit("patient_match_searched", decision, source === "manual" ? access.actorId : "system")
    if (outcome === "auto_link") matchAudit("patient_auto_linked", decision, "system", candidate?.id, targetCase.patientId ?? "unlinked", candidate?.id)
    else if (outcome !== "no_match") matchAudit(outcome === "conflict" ? "patient_match_conflict" : "patient_match_suggested", decision, "system")
    return { matched: outcome === "auto_link", patientId: outcome === "auto_link" ? candidate?.id : undefined, decisionId: decision.id }
  }, [addAudit])
  const approvePatientMatch = useCallback((id: string, patientId: string, reason: string, access?: MatchingAccess) => {
    const decision = matchingState.current.matchDecisions.find(item => item.id === id)
    const targetCase = matchingState.current.cases.find(item => item.id === decision?.caseId)
    const patient = matchingState.current.patients.find(item => item.id === patientId)
    assertMatchingAccess(access, "patient:match_approve", targetCase, patient)
    if (!decision || !targetCase || !patient || !["pending", "conflict"].includes(decision.status)) throw new AccessCommandError("Decyzja nie jest już dostępna do zatwierdzenia.")
    const latest = matchingState.current.matchDecisions.filter(item => item.caseId === decision.caseId).at(-1)
    const result = assessCase(targetCase)
    if (latest?.id !== id || result.fingerprint !== decision.fingerprint) throw new AccessCommandError("Dane dopasowania zmieniły się. Wykonaj ponowne wyszukiwanie.")
    const candidate = result.candidates.find(item => item.candidatePatientId === patientId)
    if (!candidate || !reason.trim()) throw new AccessCommandError("Wybierz aktualnego kandydata i podaj uzasadnienie.")
    const approved: MatchDecision = { ...decision, candidatePatientId: patientId, confidence: candidate.confidence,
      matchedSignals: candidate.matchedSignals, conflictingSignals: candidate.conflictingSignals, status: "approved", decision: "approved",
      resolvedAt: new Date().toISOString(), resolvedBy: access.actorId, reason: reason.trim() }
    linkPatient(approved, patientId, access.actorId)
    writeDecisions(matchingState.current.matchDecisions.map(item => item.id === id ? approved : item))
    matchAudit("patient_match_approved", approved, access.actorId, patientId, targetCase.patientId ?? "unlinked", patientId)
  }, [addAudit])
  const rejectPatientMatch = useCallback((id: string, reason: string, access?: MatchingAccess) => {
    const decision = matchingState.current.matchDecisions.find(item => item.id === id)
    const targetCase = matchingState.current.cases.find(item => item.id === decision?.caseId)
    assertMatchingAccess(access, "patient:match_approve", targetCase)
    if (!decision || !targetCase || !["pending", "conflict"].includes(decision.status) || !reason.trim()) throw new AccessCommandError("Wybierz nierozstrzygnięte dopasowanie i podaj uzasadnienie.")
    if (!access.globalScope && decision.candidates.some(candidate => !matchingState.current.patients.some(patient => patient.id === candidate.candidatePatientId && patientWithinMatchingScope(patient, access)))) throw new AccessCommandError("Decyzja obejmuje pacjenta poza zakresem klinik. Wymagana ocena globalna.")
    const rejected: MatchDecision = { ...decision, status: "rejected", decision: "rejected", resolvedAt: new Date().toISOString(), resolvedBy: access.actorId, reason: reason.trim() }
    writeDecisions(matchingState.current.matchDecisions.map(item => item.id === id ? rejected : item))
    matchAudit("patient_match_rejected", rejected, access.actorId, undefined, decision.status, "rejected")
  }, [addAudit])
  const saveCaseContactProfile = useCallback((input: PatientMatchInput & { caseId: string; firstName: string; lastName: string; actorId: string }, access?: MatchingAccess) => {
    const targetCase = matchingState.current.cases.find(item => item.id === input.caseId)
    assertMatchingAccess(access, "patient:edit_local", targetCase)
    if (!targetCase) throw new AccessCommandError("Nie znaleziono sprawy.")
    if (input.phone?.trim() && !normalizeMatchingPhone(input.phone)) throw new AccessCommandError("Nieprawidłowy telefon.")
    if (input.email?.trim() && !normalizeMatchingEmail(input.email)) throw new AccessCommandError("Nieprawidłowy e-mail.")
    if (input.pesel?.trim() && !normalizeMatchingPesel(input.pesel)) throw new AccessCommandError("PESEL musi zawierać 11 cyfr.")
    const profile = { ...normalizeMatchInput(input), firstName: input.firstName.trim(), lastName: input.lastName.trim() }
    const ids = [...(targetCase.contactIdentityIds ?? [targetCase.contactIdentityId])]
    const nextIdentities = [...matchingState.current.identities]
    for (const channel of ["phone", "email"] as const) {
      const value = profile[channel]
      if (!value || ids.some(id => nextIdentities.some(item => item.id === id && item.channel === channel && normalizedIdentityValue(item) === value))) continue
      const reusable = targetCase.patientId && nextIdentities.find(item => item.patientId === targetCase.patientId && item.channel === channel && normalizedIdentityValue(item) === value)
      if (reusable) { ids.push(reusable.id); continue }
      const id = `ci-profile-${nextDraftSeq()}-${channel}`
      nextIdentities.push({ id, channel, value, isPrimary: false, verified: false, displayName: `${profile.firstName} ${profile.lastName}`.trim() })
      ids.push(id)
    }
    matchingState.current.identities = nextIdentities; setIdentities(nextIdentities)
    const nextCases = matchingState.current.cases.map(item => item.id === input.caseId ? { ...item, contactProfile: profile, contactIdentityIds: ids } : item)
    matchingState.current.cases = nextCases; setCases(nextCases)
    addAudit({ type: "patient_match_searched", actorId: access.actorId, caseId: input.caseId, summary: "Zapisano lokalne dane kontaktu do ponownego wyszukania. Patient w Medical CRM bez zmian.", before: "contact_profile", after: "contact_profile_updated" })
    const result = matchCaseToPatient(input.caseId, access.actorId, access)
    return { patientId: result.patientId ?? targetCase.patientId }
  }, [addAudit, matchCaseToPatient])

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
    (input: { caseId: string; patientId?: string; text: string; type: InteractionType; channel?: ContactChannel; direction: InteractionDirection; authorId?: string }, access?: MatchingAccess) => {
      const matched = input.direction === "incoming" ? matchCaseToPatient(input.caseId, access?.actorId ?? "system", access, "incoming_message") : undefined
      const interaction: Interaction = {
        id: nextInteractionId(),
        caseId: input.caseId,
        patientId: input.direction === "incoming" ? matched?.patientId ?? matchingState.current.cases.find(item => item.id === input.caseId)?.patientId : input.patientId,
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
    [matchCaseToPatient],
  )

  const sendSms = useCallback(
    (input: SmsSendInput) => {
      if (input.retryOfId) {
        const original = interactions.find((item) => item.id === input.retryOfId)
        if (!original || !isSmsMessage(original) || original.direction !== "outgoing" || original.deliveryStatus !== "failed"
          || original.caseId !== input.caseId || original.patientId !== input.patientId || original.taskId !== input.taskId
          || original.recipient !== emulatedSmsAdapter.normalizeRecipient(input.recipient) || original.text !== input.text.trim()) {
          throw new Error("Nieprawidłowe powiązanie ponowienia SMS.")
        }
      }
      const targetCase = input.caseId ? cases.find((item) => item.id === input.caseId) : undefined
      const patientId = input.patientId ?? targetCase?.patientId
      const patient = patients.find((item) => item.id === patientId)
      if (input.caseId && !targetCase) throw new Error("Nie znaleziono sprawy.")
      if (targetCase?.patientId && input.patientId && targetCase.patientId !== input.patientId) throw new Error("Pacjent nie należy do sprawy.")
      if (!targetCase && !patient) throw new Error("Wybierz pacjenta lub sprawę.")
      if (patient && !patient.contactable) throw new Error("Kontakt z pacjentem jest niedozwolony.")
      const task = input.taskId ? tasks.find((item) => item.id === input.taskId) : undefined
      if (input.taskId && (!task || task.caseId !== input.caseId)) throw new Error("Zadanie nie należy do sprawy.")
      const recipient = emulatedSmsAdapter.normalizeRecipient(input.recipient)
      if (!recipient || !input.text.trim() || !input.authorId) throw new Error("Sprawdź numer, tekst i nadawcę SMS.")
      const clinicId = targetCase?.clinicId ?? input.clinicId ?? patient?.primaryClinicId
      const provider = selectSmsProvider(smsProviderConfigurations, clinicId)
      const id = nextInteractionId()
      const message: SmsMessage = {
        id, caseId: input.caseId, patientId, taskId: input.taskId, clinicId,
        type: "sms", channel: "phone", direction: "outgoing", at: new Date().toISOString(),
        authorId: input.authorId, text: input.text.trim(), recipient,
        sender: provider?.senderValue ?? "", providerType: provider?.providerType ?? "emulator",
        providerConfigurationId: provider?.id ?? "missing-provider", deliveryStatus: "queued",
        partsCount: calculateSmsParts(input.text.trim()), retryOfId: input.retryOfId,
      }
      setInteractions((prev) => [...prev, message])
      if (input.caseId) setReadAt((prev) => ({ ...prev, [input.caseId!]: message.at }))
      addAudit({ caseId: message.caseId, patientId, type: "sms_send", actorId: input.authorId,
        correlationId: id, summary: `SMS dodany do kolejki · ${provider?.name ?? "brak konfiguracji"}` })
      if (input.retryOfId) addAudit({ caseId: message.caseId, patientId, type: "sms_retry", actorId: input.authorId,
        correlationId: id, before: input.retryOfId, after: id, summary: `Ponowiono SMS ${input.retryOfId} jako ${id}` })
      const request = new AbortController()
      smsRequests.current.add(request)
      void emulatedSmsAdapter.send(message, provider, { simulateError: input.simulateError ?? false, signal: request.signal }, (event) => {
        setInteractions((prev) => prev.map((item) => item.id === id ? { ...item, ...event } : item))
        if (event.deliveryStatus === "failed") addAudit({ caseId: message.caseId, patientId, type: "sms_failed",
          actorId: input.authorId, correlationId: id, summary: `Błąd SMS ${id}: ${event.errorMessage}` })
      }).finally(() => smsRequests.current.delete(request))
      // Sending never completes, cancels or hides a Task.
      return message
    },
    [addAudit, cases, patients, tasks, interactions, smsProviderConfigurations],
  )

  const retrySms = useCallback((id: string, authorId: string, simulateError = false) => {
    const original = interactions.find((item) => item.id === id)
    if (!original || !isSmsMessage(original) || original.direction !== "outgoing" || original.deliveryStatus !== "failed") {
      throw new Error("Ponowić można wyłącznie nieudany wychodzący SMS.")
    }
    return sendSms({ caseId: original.caseId, patientId: original.patientId, taskId: original.taskId,
      clinicId: original.clinicId, recipient: original.recipient, text: original.text ?? "", authorId, retryOfId: id, simulateError })
  }, [interactions, sendSms])

  const updateSmsProviderConfiguration = useCallback((id: string, patch: Partial<SmsProviderConfiguration>, actorId: string) => {
    const previous = smsProviderConfigurations.find((item) => item.id === id)
    if (!previous) return
    // Explicit allowlist: frontend mutations cannot add credentials or arbitrary secret fields.
    const next: SmsProviderConfiguration = { ...previous,
      name: patch.name ?? previous.name, providerType: patch.providerType ?? previous.providerType,
      enabled: patch.enabled ?? previous.enabled, senderValue: patch.senderValue ?? previous.senderValue,
      defaultMessageText: patch.defaultMessageText ?? previous.defaultMessageText, mode: "emulation" }
    if (JSON.stringify(previous) === JSON.stringify(next)) return
    setSmsProviderConfigurations((prev) => prev.map((item) => item.id === id ? next : item))
    addAudit({ type: "sms_provider_config", actorId, correlationId: id, summary: `Zapisano konfigurację SMS · ${next.name}` })
    if (next.providerType !== previous.providerType || next.enabled !== previous.enabled) {
      addAudit({ type: "sms_provider_change", actorId, correlationId: id,
        before: `${previous.providerType}/${previous.enabled}`, after: `${next.providerType}/${next.enabled}`,
        summary: `Zmieniono aktywnego dostawcę SMS · ${next.name}` })
    }
  }, [addAudit, smsProviderConfigurations])

  const testSmsProviderConfiguration = useCallback((id: string, actorId: string) => {
    const config = smsProviderConfigurations.find((item) => item.id === id)
    if (!config) return
    const result = emulatedSmsAdapter.test(config)
    setSmsProviderConfigurations((prev) => prev.map((item) => item.id === id
      ? { ...item, lastTestAt: new Date().toISOString(), lastTestStatus: result.status } : item))
    addAudit({ type: "sms_provider_test", actorId, correlationId: id,
      summary: `Test emulatora SMS · ${config.name} · ${result.status}${result.error ? ` · ${result.error}` : ""}` })
  }, [addAudit, smsProviderConfigurations])

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

  const createDraftCase = useCallback((input: PatientMatchInput & { channel: ContactChannel; value?: string; text: string }, access?: MatchingAccess) => {
    assertMatchingAccess(access, "case:edit", { clinicId: input.clinicId } as EngagementCase)
    const n = nextDraftSeq()
    const displayName = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(" ") || undefined
    const profile: PatientMatchInput = { externalPatientId: input.externalPatientId?.trim(), pesel: input.pesel?.trim(), phone: input.phone?.trim(), email: input.email?.trim(), clinicId: input.clinicId,
      firstName: input.firstName?.trim(), lastName: input.lastName?.trim() }
    const assessment = assessPatientMatch(profile, matchingState.current.patients, matchingState.current.identities, { contactValues: input.value ? [{ channel: input.channel, value: input.value }] : [] })
    const candidate = assessment.decision === "auto_link" ? matchingState.current.patients.find(item => item.id === assessment.candidates[0]?.candidatePatientId) : undefined
    const safePatient = candidate && patientWithinMatchingScope(candidate, access) ? candidate : undefined
    const newIdentities: ContactIdentity[] = []
    const contactIds: string[] = []
    for (const channel of ["phone", "email"] as const) {
      const value = input[channel]?.trim()
      if (!value) continue
      const normalized = channel === "phone" ? normalizeMatchingPhone(value) : normalizeMatchingEmail(value)
      const reusable = safePatient && normalized ? matchingState.current.identities.find(item => item.patientId === safePatient.id && item.channel === channel && normalizedIdentityValue(item) === normalized) : undefined
      if (reusable) contactIds.push(reusable.id)
      else { const identity: ContactIdentity = { id: `ci-live-${n}-${channel}`, channel, value, isPrimary: contactIds.length === 0, verified: false, displayName }; newIdentities.push(identity); contactIds.push(identity.id) }
    }
    if (!contactIds.length) {
      const value = input.value?.trim() || input.externalPatientId?.trim() || displayName || `contact-${n}`
      const reusable = safePatient ? matchingState.current.identities.find(item => item.patientId === safePatient.id && item.channel === input.channel && normalizedIdentityValue(item) === normalizedIdentityValue({ channel: input.channel, value })) : undefined
      if (reusable) contactIds.push(reusable.id)
      else { const identity: ContactIdentity = { id: `ci-live-${n}-contact`, channel: input.channel, value, isPrimary: true, verified: false, displayName }; newIdentities.push(identity); contactIds.push(identity.id) }
    }
    const caseId = `case-live-${n}`
    const now = new Date().toISOString()
    const draft: EngagementCase = { id: caseId, contactIdentityId: contactIds[0], contactIdentityIds: contactIds,
      contactProfile: profile, board: "leads", status: "new", clinicId: input.clinicId,
      responsibleTeamId: "system", createdAt: now,
      attribution: { firstTouch: { type: "first_touch", source: "Czat", channel: input.channel, language: "pl", clinicIntentId: input.clinicId ?? "pana-medica", at: now, sourceRecordId: contactIds[0] },
        caseCreationTouch: { type: "case_creation", source: "Czat", channel: input.channel, language: "pl", clinicIntentId: input.clinicId ?? "pana-medica", at: now, sourceRecordId: contactIds[0] } } }
    const nextIdentities = [...matchingState.current.identities, ...newIdentities]
    matchingState.current.identities = nextIdentities; setIdentities(nextIdentities)
    const nextCases = [...matchingState.current.cases, draft]
    matchingState.current.cases = nextCases; setCases(nextCases)
    const result = matchCaseToPatient(caseId, access.actorId, access, "incoming_message")
    const patientId = matchingState.current.cases.find(item => item.id === caseId)?.patientId
    setInteractions(prev => [...prev, { id: nextInteractionId(), caseId, patientId, type: input.channel === "phone" ? "note" : "chat", channel: input.channel, direction: "incoming", at: now, text: input.text }])
    setTasks(prev => [...prev, { id: nextTaskId(), caseId, patientId, title: patientId ? "Skontaktuj się z pacjentem w sprawie nowej sprawy" : "Sprawdź kontakt, odpowiedz i przypisz klinikę", status: "ready", priority: patientId ? "P2" : "P3", dueAt: iso(0.2), createdAt: now, attempts: 0, requiresCall: input.channel === "phone" }])
    return { caseId, matched: result.matched }
  }, [matchCaseToPatient])

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
      matchDecisions,
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
      retrySms,
      updateSmsProviderConfiguration,
      testSmsProviderConfiguration,
      markRead,
      bookAppointment,
      createDraftCase,
      assignClinicToCase,
      syncPatientWithMedicalCrm,
      matchCaseToPatient,
      approvePatientMatch,
      rejectPatientMatch,
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
      matchDecisions,
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
      retrySms,
      updateSmsProviderConfiguration,
      testSmsProviderConfiguration,
      markRead,
      createDraftCase,
      assignClinicToCase,
      syncPatientWithMedicalCrm,
      matchCaseToPatient,
      approvePatientMatch,
      rejectPatientMatch,
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
