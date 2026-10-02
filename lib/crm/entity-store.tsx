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
  CaseBoard,
  Comment,
  ClinicId,
  ContactChannel,
  ContactIdentity,
  ConversationControl,
  ConversationMode,
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
  TaskType,
  InteractionSenderKind,
} from "./entities"
import { AUDIT_EVENTS, BROADCASTS, COMMENTS, CONTACT_IDENTITIES, ENGAGEMENT_CASES, INTERACTIONS, PATIENTS, TASKS, iso } from "./entity-data"
import { AccessCommandError } from "./permissions"
import { assessPatientMatch, assertMatchingAccess, caseMatchingInput, normalizedIdentityValue, normalizeMatchInput,
  normalizeMatchingEmail, normalizeMatchingPhone, normalizeMatchingPesel, patientWithinMatchingScope, redactMatchingReason,
  type MatchingAccess } from "./patient-matching-service"
import { CLINICS, getProcedure } from "./catalog"
import { isActive, taskType } from "./entity-queue"
import { BOARD_COLUMNS } from "./boards"
import { TASK_TYPE_LABELS, buildAutomaticTask, getWorkflowStageRule } from "./workflow-rules"
import { calculateSmsParts, emulatedSmsAdapter, isSmsMessage, INITIAL_SMS_PROVIDER_CONFIGS, selectSmsProvider } from "./sms-service"
import { interactionSenderKind } from "./conversation-control"

export const TASK_TYPES: TaskType[] = ["call","message","sms","email","qualification","appointment_confirmation","appointment_booking","post_visit_follow_up","waitlist_contact","patient_care_handoff","treatment_plan_review","send_treatment_plan","custom"]

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

export interface PatientCaseInput {
  patientId: string; contactIdentityId: string; clinicId: ClinicId; serviceInterest?: string; board: CaseBoard; channel: ContactChannel; initialTaskDueAt?: string
}
export interface PatientTaskInput {
  caseId: string; title: string; dueAt: string; priority: TaskPriority; requiresCall?: boolean; description?: string; type?: TaskType; ownerId?: string; channel?: ContactChannel; allowPast?: boolean
}
export interface PatientContactInput {
  patientId: string; caseId?: string; channel: ContactChannel; value: string; displayName?: string
}
export interface TaskChangeInput {
  caseId: string; action: "edit" | "reschedule" | "reassign" | "reprioritize" | "replace" | "cancel" | "complete" | "reopen";
  reason: string; patch?: Partial<Pick<Task, "title" | "description" | "dueAt" | "priority" | "ownerId" | "type" | "channel">>;
  replacement?: PatientTaskInput; outcome?: TaskOutcome; allowPast?: boolean; nextTask?: PatientTaskInput
}
export interface StageTransitionOptions { reason?: string; override?: boolean; dueAt?: string; taskType?: TaskType; skipAutomatic?: boolean; activeTaskDecision?: "keep" | "cancel"; allowPast?: boolean; ownerId?: string; taskTitle?: string; taskDescription?: string }
interface EntityStoreValue {
  changeTask: (id: string, input: TaskChangeInput, access?: MatchingAccess) => Task

  tasks: Task[]
  cases: EngagementCase[]
  auditEvents: AuditEvent[]
  interactions: (Interaction | Call)[]
  patients: Patient[]
  identities: ContactIdentity[]
  broadcasts: Broadcast[]
  smsProviderConfigurations: SmsProviderConfiguration[]
  matchDecisions: MatchDecision[]
  comments: Comment[]
  conversationControls: ConversationControl[]
  setConversationMode: (input: { threadKey: string; caseId: string; patientId?: string; contactIdentityId?: string; channel: ContactChannel | "sms"; mode: ConversationMode; botId?: string; reason: string }, access?: MatchingAccess) => ConversationControl
  createPatientCase: (input: PatientCaseInput, access?: MatchingAccess) => EngagementCase
  createPatientTask: (input: PatientTaskInput, access?: MatchingAccess) => Task
  completePatientTask: (taskId: string, access?: MatchingAccess) => void
  addPatientContact: (input: PatientContactInput, access?: MatchingAccess) => { identityId?: string; conflictCaseId?: string }
  updatePatientLocal: (patientId: string, input: { localTags: string[]; localNote: string }, access?: MatchingAccess) => void
  addCaseComment: (caseId: string, text: string, access?: MatchingAccess) => Comment
  readAt: Record<string, string>
  recordAudit: (event: Omit<AuditEvent, "id" | "at">) => void
  completeTask: (taskId: string, outcome: TaskOutcome, options?: { actorId?: string; callId?: string; access?: MatchingAccess }) => void
  /** Reverts a completed/cancelled task back to an open state (undo a checkbox). */
  reopenTask: (taskId: string, access?: MatchingAccess, reason?: string) => void
  skipTask: (taskId: string, reason: string, access?: MatchingAccess) => void
  rescheduleTask: (taskId: string, dueAtIso: string, reason?: string, options?: { actorId?: string; callId?: string; access?: MatchingAccess }) => void
  /** Creates or reactivates the shared P1 callback after a fully missed incoming call. */
  ensureMissedCallTask: (caseId: string, patientId?: string, access?: MatchingAccess) => Task
  assignTask: (taskId: string, ownerId: string, actorId: string, access?: MatchingAccess, reason?: string) => void
  setPriority: (taskId: string, priority: TaskPriority, actorId: string, access?: MatchingAccess, reason?: string) => void
  moveCase: (caseId: string, newStatus: string, actorId: string, options?: StageTransitionOptions, access?: MatchingAccess) => void
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
    contactIdentityId?: string
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
    senderKind?: InteractionSenderKind
    contactIdentityId?: string
    threadKey?: string
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
  bookAppointment: (input: { caseId: string; taskId?: string; patientId?: string; label: string; actorId: string }, access?: MatchingAccess) => void
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
    requestedPatientId?: string
    pesel?: string
    clinicId?: ClinicId
    /** Identifier for non-phone/e-mail channels (Instagram handle, website form id...). */
    value?: string
    text: string
  }, access?: MatchingAccess) => { caseId: string; matched: boolean }
  /** Triage: assign a clinic to a case that doesn't have one yet. */
  assignClinicToCase: (caseId: string, clinicId: ClinicId, actorId: string) => void
  /** Pulls the patient into "linked" state, as if matched by phone/e-mail in the Medical CRM. */
  syncPatientWithMedicalCrm: (patientId: string, actorId: string, access?: MatchingAccess) => void
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
  sendTreatmentPlanTask: (patientId: string, caseId: string, actorId: string, access?: MatchingAccess) => Task
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
  const [tasks, setTasksState] = useState<Task[]>(TASKS)
  const taskRef = useRef(tasks); taskRef.current = tasks
  const setTasks = (next: Task[] | ((prev: Task[]) => Task[])) => { const value = typeof next === "function" ? next(taskRef.current) : next; taskRef.current = value; setTasksState(value) }
  const [cases, setCases] = useState<EngagementCase[]>(ENGAGEMENT_CASES)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(AUDIT_EVENTS)
  const [interactions, setInteractionsState] = useState<(Interaction | Call)[]>(INTERACTIONS)
  const interactionRef = useRef(interactions); interactionRef.current = interactions
  const setInteractions = (next: (Interaction | Call)[] | ((prev: (Interaction | Call)[]) => (Interaction | Call)[])) => { const value = typeof next === "function" ? next(interactionRef.current) : next; interactionRef.current = value; setInteractionsState(value) }
  const [patients, setPatients] = useState<Patient[]>(PATIENTS)
  const [identities, setIdentities] = useState<ContactIdentity[]>(CONTACT_IDENTITIES)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(BROADCASTS)
  const [smsProviderConfigurations, setSmsProviderConfigurations] = useState<SmsProviderConfiguration[]>(INITIAL_SMS_PROVIDER_CONFIGS)
  const [matchDecisions, setMatchDecisions] = useState<MatchDecision[]>([])
  const matchingState = useRef({ cases, patients, identities, matchDecisions })
  matchingState.current = { cases, patients, identities, matchDecisions }
  const [comments, setComments] = useState<Comment[]>(COMMENTS ?? [])
  const [readAt, setReadAt] = useState<Record<string, string>>({})
  const [conversationControls, setConversationControlsState] = useState<ConversationControl[]>([])
  const conversationControlRef = useRef(conversationControls); conversationControlRef.current = conversationControls
  const setConversationControls = (next: ConversationControl[] | ((prev: ConversationControl[]) => ConversationControl[])) => {
    const value = typeof next === "function" ? next(conversationControlRef.current) : next
    conversationControlRef.current = value
    setConversationControlsState(value)
  }

  const smsRequests = useRef(new Set<AbortController>())
  useEffect(() => () => {
    smsRequests.current.forEach((request) => request.abort())
    smsRequests.current.clear()
  }, [])

  const patchTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
  }, [])

  const addAudit = useCallback((event: Omit<AuditEvent, "id" | "at">) => {
    setAuditEvents((prev) => [...prev, { ...event, id: nextAuditId(), at: new Date().toISOString() }])
  }, [])

  const assessCase = (targetCase: EngagementCase) => assessPatientMatch(caseMatchingInput(targetCase, matchingState.current.identities),
    matchingState.current.patients, matchingState.current.identities, { casePatientId: targetCase.patientId ?? targetCase.requestedPatientId,
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

  const taskAudit = (action: string, before: Task | undefined, after: Task, access: MatchingAccess, reason: string, correlationId = `task-op:${nextAuditId()}`) => {
    const target = matchingState.current.cases.find(item => item.id === after.caseId)
    addAudit({ type: "task_change", action, taskId: after.id, caseId: after.caseId, patientId: target?.patientId, clinicId: target?.clinicId,
      actorId: access.actorId, actorRole: (access as MatchingAccess & { actorRole?: import("./roles").RoleId }).actorRole,
      before: before ? JSON.stringify(before) : "no_task", after: JSON.stringify(after), reason, source: after.source ?? "manual", workflowRuleId: after.workflowRuleId,
      correlationId, summary: `${action} · ${after.title} · ${reason}` })
  }
  const assertTaskClinicScope = (target:EngagementCase,access:MatchingAccess) => {
    const role=(access as MatchingAccess & {actorRole?:import("./roles").RoleId}).actorRole
    if(!target.clinicId && !access.globalScope && role!=="operator" && role!=="patient_care")throw new AccessCommandError("Sprawa bez kliniki poza zakresem tego użytkownika.")
  }
  const requireTask = (id: string, access?: MatchingAccess, permission: "task:work" | "task:assign" = "task:work") => {
    const task = taskRef.current.find(item => item.id === id)
    const target = matchingState.current.cases.find(item => item.id === task?.caseId)
    assertMatchingAccess(access, permission, target)
    if (!task || !target) throw new AccessCommandError("Nie znaleziono zadania / sprawy.")
    assertTaskClinicScope(target,access)
    if (!access.hasPermission("task:assign") && task.ownerId && task.ownerId !== access.actorId) throw new AccessCommandError("Zadanie innego pracownika. Wymagane task:assign.")
    return task
  }
  const validateDue = (value: string | undefined, allowPast?: boolean) => {
    if(typeof value!=="string")throw new AccessCommandError("Podaj termin tekstowy ISO / datetime-local.")
    if(value){
      const parts=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/)
      if(!parts)throw new AccessCommandError("Termin musi być ISO / datetime-local.")
      const calendar=new Date(Date.UTC(+parts[1],+parts[2]-1,+parts[3]))
      if(calendar.getUTCFullYear()!==+parts[1]||calendar.getUTCMonth()!==+parts[2]-1||calendar.getUTCDate()!==+parts[3]||+parts[4]>23||+parts[5]>59)throw new AccessCommandError("Nieprawidłowa data kalendarzowa.")
      if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)){const local=new Date(value);if(local.getHours()!==+parts[4]||local.getMinutes()!==+parts[5])throw new AccessCommandError("Nieistniejąca godzina lokalna (zmiana czasu). Wybierz inną godzinę.")}
    }
    if (!value || !Number.isFinite(Date.parse(value))) throw new AccessCommandError("Podaj poprawny termin.")
    if (Date.parse(value) < Date.now() && !allowPast) throw new AccessCommandError("Termin w przeszłości — potwierdź świadomie.")
    return new Date(value).toISOString()
  }
  const assertTaskOwner = (ownerId:string|undefined, target:EngagementCase, access:MatchingAccess) => {
    if (!ownerId || ownerId===access.actorId) return
    const capability=access as MatchingAccess & {assignableUserIds?:string[];assignableUserScopes?:Record<string,string[]>}
    if(!access.hasPermission("task:assign") || !capability.assignableUserIds?.includes(ownerId) || (target.clinicId && capability.assignableUserScopes && !capability.assignableUserScopes[ownerId]?.includes(target.clinicId)))throw new AccessCommandError("Właściciel nieaktywny lub poza zakresem kliniki.")
  }
  const prepareTask = (input: PatientTaskInput, access?: MatchingAccess, transition = false): Task => {
    const target = matchingState.current.cases.find(item => item.id === input.caseId)
    assertMatchingAccess(access, "task:work", target)
    if (!target || !access.hasPermission("case:edit")) throw new AccessCommandError("Wybierz dostępną sprawę.")
    assertTaskClinicScope(target,access)
    const type = input.type ?? "custom"
    if (!TASK_TYPES.includes(type) || typeof input.title!=="string" || !input.title.trim() || typeof input.description!=="string" || !input.description.trim() || !["P0","P1","P2","P3","P4"].includes(input.priority)) throw new AccessCommandError("Podaj tytuł, opis, typ i priorytet zadania.")
    const dueAt = validateDue(input.dueAt, input.allowPast)
    assertTaskOwner(input.ownerId,target,access)
    if (!transition && getWorkflowStageRule(target.board,target.status)?.terminal) throw new AccessCommandError("Sprawa końcowa — najpierw otwórz etap operacyjny.")
    if(input.channel && !["phone","email","website","whatsapp","instagram","facebook","telegram","tiktok","viber","personal_account"].includes(input.channel))throw new AccessCommandError("Nieprawidłowy kanał.")
    const planPatient=matchingState.current.patients.find(item => item.id === target.patientId)
    const plan = planPatient?.treatmentPlan
    if (type === "send_treatment_plan") {
      assertMatchingAccess(access, "patient:view_medical", target, planPatient)
      if(input.requiresCall)throw new AccessCommandError("Wysyłka planu nie jest zadaniem połączenia. Utwórz osobną call task.")
      if (!plan) throw new AccessCommandError("Brak planu leczenia w Medical CRM.")
      if (!input.channel) throw new AccessCommandError("Wybierz kanał wysyłki planu.")
    }
    return { id: nextTaskId(), caseId: target.id, patientId: target.patientId, title: input.title.trim(), description: input.description.trim(), type,
      priority: input.priority, dueAt, originalDueAt: dueAt, ownerId: input.ownerId || access.actorId, requiresCall: type === "call" || Boolean(input.requiresCall),
      attempts: 0, status: "planned", source: type === "send_treatment_plan" ? "medical_crm" : "manual", channel: input.channel,
      handoffState: type==="patient_care_handoff"?"pending":undefined, createdAt: new Date().toISOString(), createdBy: access.actorId, updatedBy: access.actorId, rescheduleCount: 0,
      treatmentPlanId: type === "send_treatment_plan" ? plan?.id : undefined, treatmentPlanVersion: type === "send_treatment_plan" ? plan?.version : undefined }
  }
  const changeTask = useCallback((id: string, input: TaskChangeInput, access?: MatchingAccess) => {
    const before = requireTask(id,access,["reassign","reprioritize"].includes(input.action) ? "task:assign" : "task:work")
    if (before.caseId !== input.caseId || typeof input.reason!=="string" || !input.reason.trim()) throw new AccessCommandError("Nieprawidłowa sprawa lub brak powodu.")
    if (input.action !== "reopen" && !isActive(before)) throw new AccessCommandError("Zamknięte zadanie wymaga jawnego ponownego otwarcia.")
    if (input.action === "reopen" && isActive(before)) throw new AccessCommandError("Zadanie jest już aktywne.")
    if (before.requiresCall && ["complete","reschedule"].includes(input.action)) throw new AccessCommandError("Zadanie requiresCall wymaga istniejącego call wrap-up / disposition.")
    if (before.requiresCall && ["cancel","replace"].includes(input.action) && !access!.hasPermission("task:assign")) throw new AccessCommandError("Anulowanie / zastąpienie requiresCall wymaga task:assign i powodu.")
    const now = new Date().toISOString(); let after: Task = { ...before, updatedBy: access!.actorId, lastChangeReason: input.reason.trim() }
    const patch = input.patch ?? {}; let added: Task | undefined
    if (input.action === "edit") {
      if (patch.title !== undefined && !patch.title.trim() || patch.description !== undefined && !patch.description.trim()) throw new AccessCommandError("Tytuł / opis nie mogą być puste.")
      if (patch.type && (!TASK_TYPES.includes(patch.type) || (before.requiresCall && patch.type !== taskType(before) && patch.type !== "call") || taskType(before) === "send_treatment_plan" && patch.type !== "send_treatment_plan" || patch.type === "send_treatment_plan" && taskType(before) !== "send_treatment_plan")) throw new AccessCommandError("Zmiana typu narusza workflow. Zastąp zadanie.")
      after = { ...after, title: patch.title?.trim() ?? after.title, description: patch.description?.trim() ?? after.description, type: patch.type ?? after.type, requiresCall: before.requiresCall || patch.type === "call" }
    } else if (input.action === "reschedule") {const dueAt=validateDue(patch.dueAt,input.allowPast);after = { ...after, dueAt, originalDueAt: before.originalDueAt ?? before.dueAt ?? dueAt, rescheduleCount: (before.rescheduleCount ?? 0)+1, outcome: "rescheduled", status: "planned" }}
    else if (input.action === "reassign") { if (!patch.ownerId?.trim() || (patch.ownerId!==access!.actorId && !(access as MatchingAccess & {assignableUserIds?:string[]}).assignableUserIds?.includes(patch.ownerId))) throw new AccessCommandError("Wybierz aktywnego właściciela w zakresie kliniki."); assertTaskOwner(patch.ownerId,matchingState.current.cases.find(item=>item.id===before.caseId)!,access!); after.ownerId = patch.ownerId; after.currentWorkerId = undefined }
    else if (input.action === "reprioritize") { if (!patch.priority || !["P0","P1","P2","P3","P4"].includes(patch.priority)) throw new AccessCommandError("Nieprawidłowy priorytet."); after.priority = patch.priority }
    else if (input.action === "replace") { if (!input.replacement || input.replacement.caseId !== before.caseId) throw new AccessCommandError("Nowe zadanie musi należeć do tej samej sprawy."); added = prepareTask(input.replacement,access); after.status = "cancelled"; after.replacementTaskId = added.id; added.previousTaskId = before.id; added.lastChangeReason = input.reason }
    else if (input.action === "cancel") { after.status = "cancelled"; if(taskType(before)==="send_treatment_plan" && input.outcome && ["patient_declined","failed","no_valid_channel"].includes(input.outcome))after.outcome=input.outcome }
    else if (input.action === "reopen") { if (getWorkflowStageRule(matchingState.current.cases.find(item=>item.id===before.caseId)!.board,matchingState.current.cases.find(item=>item.id===before.caseId)!.status)?.terminal) throw new AccessCommandError("Najpierw otwórz sprawę."); after.status="planned"; after.completedAt=undefined; after.outcome=undefined }
    else if (input.action === "complete") {
      const outcome = input.outcome ?? "done"
      if(taskType(before)==="patient_care_handoff"){if(before.ownerId!==access!.actorId)throw new AccessCommandError("Przekazanie potwierdza użytkownik przyjmujący.");after.handoffState="accepted"}
      if (taskType(before) === "send_treatment_plan") {
        if (!["sent","failed","patient_declined","no_valid_channel"].includes(outcome)) throw new AccessCommandError("Wybierz wynik wysyłki planu.")
        assertMatchingAccess(access,"patient:view_medical",matchingState.current.cases.find(item=>item.id===before.caseId))
        if (["failed","no_valid_channel"].includes(outcome)) { if (!input.nextTask) throw new AccessCommandError("Błąd wysyłki wymaga następnego zadania lub jawnego anulowania z powodem."); if (input.nextTask.caseId!==before.caseId) throw new AccessCommandError("Następna task poza sprawą."); added=prepareTask(input.nextTask,access) }
      }
      if(!["done","appointment_scheduled","sent","patient_declined","failed","no_valid_channel"].includes(outcome))throw new AccessCommandError("Niedozwolony wynik zadania.")
      after.status = ["failed","no_valid_channel"].includes(outcome) ? "failed" : "completed"; after.outcome=outcome; after.completedAt=now
    } else throw new AccessCommandError("Nieznana operacja.")
    setTasks(prev => [...prev.map(task=>task.id===id?after:task),...(added?[added]:[])])
    const correlation=`task-op:${nextAuditId()}`; taskAudit(`task_${input.action}`,before,after,access!,input.reason,correlation)
    if(added) taskAudit("task_created",undefined,added,access!,input.reason,correlation)
    return after
  }, [addAudit])
  const callAccess = (_id:string,_callId?:string,access?:MatchingAccess) => {
    assertMatchingAccess(access,"task:work")
    return access
  }
  const completeTask = useCallback((id: string,outcome: TaskOutcome,options?: {actorId?: string;callId?: string;access?: MatchingAccess}) => {
    const access=callAccess(id,options?.callId,options?.access); const task=requireTask(id,access)
    if(options?.callId) { if(taskType(task)==="send_treatment_plan")throw new AccessCommandError("Call disposition nie potwierdza wysyłki planu.");if(taskType(task)==="patient_care_handoff" && task.ownerId!==access.actorId)throw new AccessCommandError("Przekazanie potwierdza odbiorca."); assertMatchingAccess(access,"call:handle",matchingState.current.cases.find(item=>item.id===task.caseId)); const call=interactionRef.current.find(item=>item.id===options.callId) as Call|undefined; if (!call || call.taskId!==id || call.caseId!==task.caseId || call.authorId!==access.actorId || call.disposition!==outcome || !isActive(task)) throw new AccessCommandError("Nieprawidłowy wynik call wrap-up."); const after:Task={...task,status:["wrong_number","resignation"].includes(outcome)?"cancelled":"completed",outcome,callId:call.id,completedAt:new Date().toISOString(),attempts:task.attempts+1,updatedBy:access.actorId,handoffState:taskType(task)==="patient_care_handoff"?"accepted":task.handoffState};patchTask(id,after);taskAudit("task_completed",task,after,access,"call wrap-up",call.id);return }
    changeTask(id,{caseId:task.caseId,action:"complete",reason:"Realizacja zadania",outcome},access)
  },[changeTask])
  const reopenTask = useCallback((id:string,access?:MatchingAccess,reason="")=>{const task=requireTask(id,access);changeTask(id,{caseId:task.caseId,action:"reopen",reason},access)},[changeTask])
  const skipTask = useCallback((id:string,reason:string,access?:MatchingAccess)=>{const task=requireTask(id,access);if(!reason.trim())throw new AccessCommandError("Podaj powód.");if(task.requiresCall)throw new AccessCommandError("RequiresCall wymaga call wrap-up.");if(!isActive(task))throw new AccessCommandError("Zamknięte zadanie.");const after={...task,skipReason:reason,updatedBy:access!.actorId,lastChangeReason:reason};patchTask(id,after);taskAudit("task_override",task,after,access!,reason)},[])
  const rescheduleTask = useCallback((id:string,due:string,reason?:string,options?:{actorId?:string;callId?:string;access?:MatchingAccess})=>{
    const access=callAccess(id,options?.callId,options?.access);const task=requireTask(id,access)
    if(options?.callId){assertMatchingAccess(access,"call:handle",matchingState.current.cases.find(item=>item.id===task.caseId));const call=interactionRef.current.find(item=>item.id===options.callId) as Call|undefined;if(!call || call.taskId!==id || call.caseId!==task.caseId || call.authorId!==access.actorId || !["call_later","no_answer","not_reached","contact_failed"].includes(call.disposition??"") || !isActive(task))throw new AccessCommandError("Nieprawidłowy call wrap-up retry.");if(!reason?.trim())throw new AccessCommandError("Podaj powód.");const after:Task={...task,status:"planned",dueAt:validateDue(due),originalDueAt:task.originalDueAt??task.dueAt,rescheduleCount:(task.rescheduleCount??0)+1,outcome:"rescheduled",callId:options.callId,attempts:task.attempts+1,updatedBy:access.actorId,lastChangeReason:reason};patchTask(id,after);taskAudit("task_reschedule",task,after,access,reason,options.callId);return}
    changeTask(id,{caseId:task.caseId,action:"reschedule",reason:reason??"",patch:{dueAt:due}},access)
  },[changeTask])

  const ensureMissedCallTask = useCallback(
    (caseId: string, patientId?: string, access?: MatchingAccess) => {
      const target = matchingState.current.cases.find(item => item.id === caseId)
      assertMatchingAccess(access, "call:handle", target)
      if (!target) throw new AccessCommandError("Nie znaleziono sprawy.")
      assertTaskClinicScope(target, access)
      if (patientId && patientId !== target.patientId) throw new AccessCommandError("Pacjent nie należy do sprawy.")
      const now = new Date().toISOString()
      const existing = taskRef.current.find(task => task.caseId === caseId && task.requiresCall && isActive(task))
      if (existing) {
        const next: Task = { ...existing, status: "ready", priority: "P1", dueAt: now, originalDueAt: existing.originalDueAt ?? existing.dueAt ?? now, updatedBy: access.actorId }
        setTasks(prev => prev.map(task => task.id === existing.id ? next : task))
        taskAudit("task_callback_requested", existing, next, access, "Nieodebrane połączenie")
        return next
      }
      const task: Task = {
        id: nextTaskId(), caseId, patientId: target.patientId,
        type: "call", source: "call", description: "Oddzwonienie po nieodebranym wspólnym połączeniu", mandatory: true, rescheduleCount: 0,
        title: "Oddzwoń po nieodebranym połączeniu", status: "ready", priority: "P1",
        dueAt: now, originalDueAt: now, slaAt: new Date(Date.now() + 6 * 60000).toISOString(), createdAt: now,
        createdBy: access.actorId, updatedBy: access.actorId, attempts: 0, requiresCall: true,
      }
      setTasks(prev => [...prev, task])
      taskAudit("task_created", undefined, task, access, "Nieodebrane połączenie")
      return task
    }, [],
  )

  const assignTask = useCallback((id:string,ownerId:string,_actorId:string,access?:MatchingAccess,reason="")=>{const task=requireTask(id,access,"task:assign");changeTask(id,{caseId:task.caseId,action:"reassign",reason,patch:{ownerId}},access)},[changeTask])
  const setPriority = useCallback((id:string,priority:TaskPriority,_actorId:string,access?:MatchingAccess,reason="")=>{const task=requireTask(id,access,"task:assign");changeTask(id,{caseId:task.caseId,action:"reprioritize",reason,patch:{priority}},access)},[changeTask])

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
      contactIdentityId?: string
    }) => {
      const endAt = new Date().toISOString()
      const call: Call = {
        id: nextCallId(),
        caseId: input.caseId,
        patientId: input.patientId,
        taskId: input.taskId,
        contactIdentityId: input.contactIdentityId,
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
        correlationId: call.id,
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

  const moveCase = useCallback((caseId:string,newStatus:string,_actorId:string,options:StageTransitionOptions={},access?:MatchingAccess)=>{
    const before=matchingState.current.cases.find(item=>item.id===caseId)
    assertMatchingAccess(access,"case:move",before)
    if(!before)throw new AccessCommandError("Nie znaleziono sprawy.")
    assertTaskClinicScope(before,access)
    const rule=getWorkflowStageRule(before.board,newStatus)
    if(!rule || !rule.enabled)throw new AccessCommandError("Nieprawidłowy / wyłączony etap.")
    if(before.status===newStatus)return
    const active=taskRef.current.filter(task=>task.caseId===caseId && isActive(task))
    if(rule.requiresReason && !options.reason?.trim())throw new AccessCommandError("Etap wymaga powodu.")
    const privileged=access.hasPermission("task:assign")
    if((options.override || options.skipAutomatic || options.activeTaskDecision==="cancel") && (!privileged || !options.reason?.trim()))throw new AccessCommandError("Override wymaga task:assign i powodu.")
    if(rule.terminal && active.length && options.activeTaskDecision!=="cancel")throw new AccessCommandError("Etap końcowy ma aktywne zadania. Wybierz jawne anulowanie z powodem / rozwiąż zadania.")
    const kept=options.activeTaskDecision==="cancel"?[]:active
    let generated:Task|undefined
    const automatic=rule.automaticTask
    const chosenType=options.taskType??automatic?.type
    const workflowId=options.taskType && options.taskType!==automatic?.type ? `${before.board}.${newStatus}.${options.taskType}` : automatic?.id??`${before.board}.${newStatus}.${chosenType}`
    const duplicate=kept.find(task=>task.workflowRuleId===workflowId)
    if(!rule.terminal && !options.skipAutomatic && !duplicate){
      if(automatic || options.taskType){
        const selected=options.taskType ?? automatic!.type ?? "custom"
        if(options.taskType && !rule.suggestedTasks?.includes(selected) && selected!==automatic?.type && !(privileged && options.override && TASK_TYPES.includes(selected)))throw new AccessCommandError("Zadanie nie jest dostępne na tym etapie.")
        const requiresDue=!automatic || automatic.duePolicy!=="sla" || options.taskType
        const due=options.dueAt ? validateDue(options.dueAt,options.allowPast) : requiresDue ? undefined : new Date(Date.now()+automatic!.dueInMinutes*60000).toISOString()
        if(!due)throw new AccessCommandError(automatic?.duePolicy==="appointment"?"Appointment nie istnieje w modelu. Podaj jawny termin potwierdzenia.":"Podaj zalecany / ręczny termin następnej czynności.")
        if(selected==="custom"){generated=prepareTask({caseId,title:options.taskTitle??"",description:options.taskDescription??"",type:"custom",dueAt:due,priority:automatic?.priority??"P2",allowPast:options.allowPast},access,true)}
        else if(selected==="send_treatment_plan") generated=prepareTask({caseId,title:"Wyślij plan leczenia",description:"Zarejestruj wynik wysyłki wersji planu Medical CRM",type:selected,channel:"email",dueAt:due,priority:automatic?.priority??"P2",allowPast:options.allowPast},access,true)
        else generated={...(automatic?buildAutomaticTask(automatic,before):{id:"",caseId,patientId:before.patientId,title:`Następne działanie: ${selected}`,status:"planned" as const,priority:"P2" as const,createdAt:new Date().toISOString(),attempts:0}),id:nextTaskId(),title:selected===automatic?.type?automatic.title:TASK_TYPE_LABELS[selected],type:selected,description:selected===automatic?.type?automatic.description??automatic.title:TASK_TYPE_LABELS[selected],requiresCall:selected==="call",handoffState:selected==="patient_care_handoff"?"pending":undefined,dueAt:due,originalDueAt:due,source:"workflow",mandatory:true,workflowRuleId:workflowId,ownerId:options.ownerId??access.actorId,createdBy:access.actorId,updatedBy:access.actorId,rescheduleCount:0}
      }
    }
    assertTaskOwner(options.ownerId,before,access)
    if(generated){generated.ownerId=options.ownerId??access.actorId;generated.source="workflow";generated.workflowRuleId=workflowId;generated.mandatory=true}
    if(newStatus==="call_later" && !generated && !options.skipAutomatic && !kept.some(task=>task.dueAt && Number.isFinite(Date.parse(task.dueAt))))throw new AccessCommandError("Callback wymaga task z poprawnym dueAt.")
    if(rule.nextActionMandatory && !kept.length && !generated && !options.skipAutomatic)throw new AccessCommandError("Brak następnego działania. Wybierz zadanie / termin.")
    const correlation=`transition:${caseId}:${nextAuditId()}`
    const nextTasks=taskRef.current.map(task=>options.activeTaskDecision==="cancel" && active.some(item=>item.id===task.id)?{...task,status:"cancelled" as const,lastChangeReason:options.reason,updatedBy:access.actorId}:task)
    if(generated)nextTasks.push(generated)
    const nextCase={...before,status:newStatus,nextTaskId:generated?.id??kept[0]?.id}
    matchingState.current.cases=matchingState.current.cases.map(item=>item.id===caseId?nextCase:item)
    setCases(matchingState.current.cases);setTasks(nextTasks)
    addAudit({type:"status_change",action:options.override?"override":"stage_transition",caseId,patientId:before.patientId,clinicId:before.clinicId,actorId:access.actorId,actorRole:(access as MatchingAccess & {actorRole?:import("./roles").RoleId}).actorRole,before:before.status,after:newStatus,reason:options.reason,correlationId:correlation,summary:`Etap: ${BOARD_COLUMNS[before.board].find(column=>column.id===before.status)?.label??before.status} → ${BOARD_COLUMNS[before.board].find(column=>column.id===newStatus)?.label??newStatus}`})
    if(options.activeTaskDecision==="cancel")for(const old of active)taskAudit("task_cancelled",old,nextTasks.find(task=>task.id===old.id)!,access,options.reason!,correlation)
    if(generated)taskAudit("workflow_task_created",undefined,generated,access,options.reason??"Reguła etapu",correlation)
    if(options.skipAutomatic)addAudit({type:"task_change",action:"workflow_task_skipped",caseId,patientId:before.patientId,clinicId:before.clinicId,actorId:access.actorId,actorRole:(access as MatchingAccess & {actorRole?:import("./roles").RoleId}).actorRole,source:"workflow",workflowRuleId:automatic?.id,before:automatic?.id??"next_action_required",after:"skipped",reason:options.reason,correlationId:correlation,summary:"Override: pominięto automatyczną task; brak następnego działania pozostaje w kolejce kontrolnej"})
  },[addAudit])

  const setConversationMode = useCallback((input: { threadKey: string; caseId: string; patientId?: string; contactIdentityId?: string; channel: ContactChannel | "sms"; mode: ConversationMode; botId?: string; reason: string }, access?: MatchingAccess) => {
    const target = matchingState.current.cases.find(item => item.id === input.caseId)
    assertMatchingAccess(access, "communication:send", target)
    if (!input.threadKey || !input.reason.trim()) throw new AccessCommandError("Podaj rozmowę i powód zmiany obsługi.")
    if (input.contactIdentityId && !(target?.contactIdentityIds ?? [target?.contactIdentityId]).includes(input.contactIdentityId)
      && (!target?.patientId || !matchingState.current.identities.some(identity => identity.id === input.contactIdentityId && identity.patientId === target.patientId))) {
      throw new AccessCommandError("Kontakt nie należy do tej sprawy lub pacjenta.")
    }
    const before = conversationControlRef.current.find(item => item.threadKey === input.threadKey)
    const role = (access as MatchingAccess & { actorRole?: import("./roles").RoleId }).actorRole
    if (before?.mode === "operator_active" && before.ownerId && before.ownerId !== access!.actorId && !["admin", "team_leader"].includes(role ?? "")) {
      throw new AccessCommandError("Rozmowę prowadzi inny operator.")
    }
    const after: ConversationControl = {
      threadKey: input.threadKey, caseId: input.caseId, patientId: input.patientId ?? target?.patientId,
      contactIdentityId: input.contactIdentityId, channel: input.channel, mode: input.mode,
      ownerId: input.mode === "operator_active" || input.mode === "bot_paused" ? access!.actorId : undefined,
      botId: input.mode === "bot_active" ? input.botId ?? before?.botId ?? "bot-pana" : before?.botId,
      updatedAt: new Date().toISOString(), updatedBy: access!.actorId,
    }
    setConversationControls(prev => [...prev.filter(item => item.threadKey !== input.threadKey), after])
    addAudit({ type: "conversation_handoff", action: input.mode, caseId: input.caseId, patientId: after.patientId,
      actorId: access!.actorId, actorRole: role, before: before?.mode ?? "unmanaged", after: input.mode,
      reason: input.reason.trim(), correlationId: `conversation:${input.threadKey}:${Date.now()}`,
      summary: `Obsługa rozmowy: ${before?.mode ?? "unmanaged"} → ${input.mode}` })
    return after
  }, [addAudit])

  const sendMessage = useCallback(
    (input: { caseId: string; patientId?: string; text: string; type: InteractionType; channel?: ContactChannel; direction: InteractionDirection; authorId?: string; senderKind?: InteractionSenderKind; contactIdentityId?: string; threadKey?: string }, access?: MatchingAccess) => {
      if (access && input.direction === "outgoing") assertMatchingAccess(access, "communication:send", matchingState.current.cases.find(item => item.id === input.caseId))
      const control = input.threadKey ? conversationControls.find(item => item.threadKey === input.threadKey) : undefined
      const senderKind = input.senderKind ?? interactionSenderKind(input)
      if (input.direction === "outgoing" && control?.mode === "closed") throw new AccessCommandError("Rozmowa jest zamknięta.")
      if (input.direction === "outgoing" && senderKind === "bot" && control?.mode !== "bot_active") throw new AccessCommandError("Bot nie jest aktywnym właścicielem rozmowy.")
      if (input.direction === "outgoing" && senderKind !== "bot" && control && (control.mode !== "operator_active" || control.ownerId !== access?.actorId)) {
        throw new AccessCommandError(control.mode === "operator_active" ? "Rozmowę prowadzi inny operator." : "Najpierw przejmij rozmowę od bota.")
      }
      if (input.contactIdentityId) {
        const target = matchingState.current.cases.find(item => item.id === input.caseId)
        const identity = matchingState.current.identities.find(item => item.id === input.contactIdentityId)
        if (!target || !identity || (!(target.contactIdentityIds ?? [target.contactIdentityId]).includes(identity.id) && (!target.patientId || identity.patientId !== target.patientId)) || (input.channel && identity.channel !== input.channel)) throw new AccessCommandError("Kontakt nie należy do kanału tej sprawy.")
      }
      const matched = input.direction === "incoming" ? matchCaseToPatient(input.caseId, access?.actorId ?? "system", access, "incoming_message") : undefined
      const interaction: Interaction = {
        id: nextInteractionId(),
        caseId: input.caseId,
        patientId: input.direction === "incoming" ? matched?.patientId ?? matchingState.current.cases.find(item => item.id === input.caseId)?.patientId : input.patientId,
        contactIdentityId: input.contactIdentityId,
        type: input.type,
        channel: input.channel,
        direction: input.direction,
        at: new Date().toISOString(),
        authorId: input.authorId,
        senderKind,
        text: input.text,
      }
      setInteractions((prev) => [...prev, interaction])
      if (input.direction === "outgoing") {
        setReadAt((prev) => ({ ...prev, [input.caseId]: interaction.at }))
      }
      return interaction
    },
    [conversationControls, matchCaseToPatient],
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
    setReadAt((prev) => ({ ...prev, [caseId]: new Date().toISOString() }))
  }, [])

  const bookAppointment = useCallback(
    (input: { caseId: string; taskId?: string; patientId?: string; label: string; actorId: string }, access?:MatchingAccess) => {
      const target=matchingState.current.cases.find(item=>item.id===input.caseId)
      assertMatchingAccess(access,"case:edit",target)
      if(!target || !access.hasPermission("communication:send"))throw new AccessCommandError("Brak dostępnej sprawy / komunikacji.")
      assertTaskClinicScope(target,access)
      input={...input,patientId:target.patientId,actorId:access.actorId}
      if (input.taskId) {
        const task=requireTask(input.taskId,access)
        if(task.caseId!==input.caseId)throw new AccessCommandError("Task innej sprawy.")
        // Booking is not a call disposition. Call-required work stays open until wrap-up.
        if(!task.requiresCall && taskType(task)!=="send_treatment_plan" && taskType(task)!=="patient_care_handoff")changeTask(task.id,{caseId:task.caseId,action:"complete",outcome:"appointment_scheduled",reason:"Wizyta wybrana w istniejącej emulacji"},access)
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

  const createDraftCase = useCallback((input: PatientMatchInput & { channel: ContactChannel; value?: string; text: string; requestedPatientId?: string }, access?: MatchingAccess) => {
    assertMatchingAccess(access, "case:edit", { clinicId: input.clinicId } as EngagementCase)
    if (input.requestedPatientId) {
      const requested = matchingState.current.patients.find(item => item.id === input.requestedPatientId)
      assertMatchingAccess(access, "patient:edit_local", undefined, requested)
      if (!requested) throw new AccessCommandError("Nie znaleziono pacjenta do oceny kontaktu.")
    }
    const n = nextDraftSeq()
    const displayName = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(" ") || undefined
    const profile: PatientMatchInput = { externalPatientId: input.externalPatientId?.trim(), pesel: input.pesel?.trim(), phone: input.phone?.trim(), email: input.email?.trim(), clinicId: input.clinicId,
      firstName: input.firstName?.trim(), lastName: input.lastName?.trim() }
    const assessment = assessPatientMatch(profile, matchingState.current.patients, matchingState.current.identities, { casePatientId: input.requestedPatientId, contactValues: input.value ? [{ channel: input.channel, value: input.value }] : [] })
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
      contactProfile: profile, requestedPatientId: input.requestedPatientId, board: "leads", status: "new", clinicId: input.clinicId,
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
    const starter=buildAutomaticTask(getWorkflowStageRule("leads","new")!.automaticTask!,draft,new Date(now))
    starter.id=nextTaskId();starter.status="ready";starter.patientId=patientId;starter.requiresCall=input.channel==="phone";starter.type=starter.requiresCall?"call":"message";starter.createdBy=access.actorId;starter.updatedBy=access.actorId
    setTasks(prev=>[...prev,starter]);taskAudit("workflow_task_created",undefined,starter,access,"Nowa sprawa / pierwszy kontakt",result.decisionId)

    return { caseId, matched: result.matched }
  }, [matchCaseToPatient])

  const assignClinicToCase = useCallback(
    (caseId: string, clinicId: ClinicId, actorId: string) => {
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, clinicId } : c)))
      addAudit({ caseId, type: "link", actorId, summary: "Sprawa przypisana do kliniki", after: clinicId })
    },
    [addAudit],
  )

  const requirePatient = (patientId: string, permission: Parameters<MatchingAccess["hasPermission"]>[0], access?: MatchingAccess) => {
    const patient = matchingState.current.patients.find(item => item.id === patientId)
    assertMatchingAccess(access, permission, undefined, patient)
    if (!patient || !access.hasPermission("patient:view_basic")) throw new AccessCommandError("Pacjent nie istnieje lub nie masz dostępu do profilu.")
    return patient
  }
  const createPatientCase = useCallback((input: PatientCaseInput, access?: MatchingAccess) => {
    const patient = requirePatient(input.patientId, "case:edit", access)
    assertMatchingAccess(access, "case:edit", { clinicId: input.clinicId } as EngagementCase, patient)
    if (!CLINICS.some(item => item.id === input.clinicId)) throw new AccessCommandError("Wybierz istniejącą klinikę.")
    const identity = matchingState.current.identities.find(item => item.id === input.contactIdentityId)
    if (!identity || identity.patientId !== patient.id || identity.channel !== input.channel) throw new AccessCommandError("Wybierz kontakt należący do tego pacjenta i zgodny z kanałem.")
    if (input.serviceInterest && getProcedure(input.serviceInterest)?.clinicId !== input.clinicId) throw new AccessCommandError("Usługa nie należy do wybranej kliniki.")
    const initial = { leads: "new", deals: "scheduled", patients: "new_patient" }[input.board]
    const initialRule = initial ? getWorkflowStageRule(input.board, initial) : undefined
    const rule = initialRule?.enabled ? initialRule.automaticTask : undefined
    if (!rule) throw new AccessCommandError("Brak początkowej reguły workflow dla tej lejka.")
    const initialDue = rule.duePolicy !== "sla" ? validateDue(input.initialTaskDueAt) : undefined
    const now = new Date().toISOString()
    const id = `case-live-${nextDraftSeq()}`
    const touch: EngagementCase["attribution"]["caseCreationTouch"] = { type: "case_creation", source: "Patient 360", channel: input.channel, language: patient.preferredLanguage, clinicIntentId: input.clinicId, serviceIntent: input.serviceInterest, at: now, sourceRecordId: id }
    const original = matchingState.current.cases.filter(item => item.patientId === patient.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]?.attribution.firstTouch
    const engagementCase: EngagementCase = { id, patientId: patient.id, contactIdentityId: identity.id, contactIdentityIds: [identity.id], clinicId: input.clinicId, serviceInterest: input.serviceInterest,
      board: input.board, status: initial, responsibleTeamId: access.actorId, createdAt: now, attribution: { firstTouch: original ?? { ...touch, type: "first_touch" }, caseCreationTouch: touch } }
    const generated = buildAutomaticTask(rule, engagementCase, new Date(now)); generated.id = nextTaskId(); generated.createdBy=access.actorId; generated.updatedBy=access.actorId; generated.ownerId=access.actorId
    if(initialDue){generated.dueAt=initialDue;generated.originalDueAt=initialDue}
    matchingState.current.cases = [...matchingState.current.cases, engagementCase]; setCases(matchingState.current.cases)
    setTasks(prev => [...prev, generated])
    addAudit({ type: "case_created", caseId: id, patientId: patient.id, actorId: access.actorId, summary: "Utworzono kolejny Engagement Case z Patient 360", before: "no_case", after: id, correlationId: id })
    taskAudit("workflow_task_created",undefined,generated,access,"Nowa sprawa Patient 360",id)
    return engagementCase
  }, [addAudit])
  const createPatientTask = useCallback((input:PatientTaskInput,access?:MatchingAccess)=>{const task=prepareTask(input,access);setTasks(prev=>[...prev,task]);taskAudit("task_created",undefined,task,access!,"Ręcznie utworzono zadanie");return task},[addAudit])
  const completePatientTask = useCallback((id:string,access?:MatchingAccess)=>{const task=requireTask(id,access);changeTask(id,{caseId:task.caseId,action:"complete",reason:"Realizacja w Patient 360",outcome:"done"},access)},[changeTask])
  const addPatientContact = useCallback((input: PatientContactInput, access?: MatchingAccess) => {
    const patient = requirePatient(input.patientId, "patient:edit_local", access)
    const target = input.caseId ? matchingState.current.cases.find(item => item.id === input.caseId) : undefined
    assertMatchingAccess(access, "patient:edit_local", target, patient)
    if (input.caseId && (!target || target.patientId !== patient.id)) throw new AccessCommandError("Sprawa nie należy do tego pacjenta.")
    if (!["phone", "email", "instagram", "facebook", "whatsapp", "telegram", "tiktok", "viber", "website", "personal_account"].includes(input.channel)) throw new AccessCommandError("Nieznany kanał.")
    if (typeof input.value !== "string") throw new AccessCommandError("Podaj identyfikator kontaktu.")
    const normalized = normalizedIdentityValue({ channel: input.channel, value: input.value })
    if (!normalized) throw new AccessCommandError("Podaj poprawny telefon, e-mail lub handle.")
    const same = matchingState.current.identities.filter(item => item.channel === input.channel && normalizedIdentityValue(item) === normalized)
    if (same.some(item => item.patientId && item.patientId !== patient.id)) {
      if (!access.hasPermission("case:edit")) throw new AccessCommandError("Konflikt kontaktu. Zleć ocenę w Patient Matching osobie uprawnionej do pracy ze sprawą.")
      const draft = createDraftCase({ channel: input.channel, value: normalized, phone: input.channel === "phone" ? normalized : undefined, email: input.channel === "email" ? normalized : undefined,
        requestedPatientId: patient.id, externalPatientId: patient.externalPatientId, firstName: patient.firstName, lastName: patient.lastName, clinicId: target?.clinicId ?? patient.primaryClinicId, text: "Kontakt lokalny wymaga oceny Patient Matching; nie przeniesiono istniejącej identity." }, access)
      addAudit({ type: "patient_match_conflict", patientId: patient.id, caseId: draft.caseId, actorId: access.actorId, summary: "Konflikt lokalnego kontaktu przekazano do Patient Matching", correlationId: matchingState.current.matchDecisions.filter(item => item.caseId === draft.caseId).at(-1)?.id ?? draft.caseId })
      return { conflictCaseId: draft.caseId }
    }
    const reused = same.find(item => item.patientId === patient.id)
    const identity: ContactIdentity = reused ?? { id: `ci-local-${nextDraftSeq()}`, patientId: patient.id, channel: input.channel, value: normalized, displayName: input.displayName?.trim() || undefined, verified: false, isPrimary: !matchingState.current.identities.some(item => item.patientId === patient.id && item.channel === input.channel) }
    if (!reused) { matchingState.current.identities = [...matchingState.current.identities, identity]; setIdentities(matchingState.current.identities) }
    if (target) { matchingState.current.cases = matchingState.current.cases.map(item => item.id === target.id ? { ...item, contactIdentityIds: [...new Set([...(item.contactIdentityIds ?? [item.contactIdentityId]), identity.id])] } : item); setCases(matchingState.current.cases) }
    addAudit({ type: reused ? "contact_identity_reused" : "contact_identity_linked", caseId: target?.id, patientId: patient.id, actorId: access.actorId, summary: reused ? "Użyto istniejącej identity pacjenta" : "Dodano niezweryfikowany lokalny kontakt pacjenta", before: reused ? identity.id : "no_contact", after: identity.id, correlationId: `contact:${nextAuditId()}` })
    return { identityId: identity.id }
  }, [addAudit, createDraftCase])
  const updatePatientLocal = useCallback((id: string, input: { localTags: string[]; localNote: string }, access?: MatchingAccess) => {
    const patient = requirePatient(id, "patient:edit_local", access)
    assertMatchingAccess(access, "patient:edit_local", undefined, patient)
    if (!Array.isArray(input.localTags) || input.localTags.some(tag => typeof tag !== "string") || typeof input.localNote !== "string") throw new AccessCommandError("Nieprawidłowe pola lokalne.")
    const patch = { localTags: [...new Set(input.localTags.map(tag => tag.trim()).filter(Boolean))].slice(0, 20), localNote: input.localNote.trim().slice(0, 2000) }
    matchingState.current.patients = matchingState.current.patients.map(item => item.id === id ? { ...item, ...patch } : item); setPatients(matchingState.current.patients)
    addAudit({ type: "patient_local_updated", patientId: id, actorId: access.actorId, summary: "Zapisano lokalne tagi i notatkę operacyjną", before: "local_annotations", after: "local_annotations_updated", correlationId: `patient-local:${nextAuditId()}` })
  }, [addAudit])
  const addCaseComment = useCallback((id: string, text: string, access?: MatchingAccess) => {
    const target = matchingState.current.cases.find(item => item.id === id)
    assertMatchingAccess(access, "case:edit", target)
    if (!target || typeof text !== "string" || !text.trim() || !access.hasPermission("patient:view_basic")) throw new AccessCommandError("Wybierz sprawę i wpisz komentarz.")
    const comment: Comment = { id: `comment-${nextAuditId()}`, caseId: id, authorId: access.actorId, at: new Date().toISOString(), text: text.trim().slice(0, 4000) }
    setComments(prev => [...prev, comment])
    addAudit({ type: "comment_added", caseId: id, patientId: target.patientId, actorId: access.actorId, summary: "Dodano komentarz pracownika", after: comment.id, correlationId: comment.id })
    return comment
  }, [addAudit])

  const syncPatientWithMedicalCrm = useCallback(
    (patientId: string, _actorId: string, access?: MatchingAccess) => {
      requirePatient(patientId, "patient:view_medical", access)
      assertMatchingAccess(access, "patient:edit_local")
      const actorId = access.actorId
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, integrationState: "linked", lastSyncAt: iso(0), conflicts: undefined } : p)))
      addAudit({ patientId, type: "sync", actorId, summary: "Pacjent zsynchronizowany z Medical CRM (dopasowanie po numerze/e-mailu)" })
    },
    [addAudit],
  )

  const sendTreatmentPlanTask = useCallback((patientId:string,caseId:string,_actorId:string,access?:MatchingAccess)=>{
    requirePatient(patientId,"patient:view_medical",access)
    if(matchingState.current.cases.find(item=>item.id===caseId)?.patientId!==patientId)throw new AccessCommandError("Sprawa nie należy do pacjenta.")
    return createPatientTask({caseId,title:"Wyślij aktualny plan leczenia",description:"Wybierz poprawny kanał i zarejestruj wynik wysyłki wersji planu z Medical CRM.",type:"send_treatment_plan",channel:"email",dueAt:new Date(Date.now()+4*3600000).toISOString(),priority:"P2"},access)
  },[createPatientTask])

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
      comments,
      conversationControls,
      changeTask, createPatientCase, createPatientTask, completePatientTask, addPatientContact, updatePatientLocal, addCaseComment,
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
      setConversationMode,
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
      comments,
      conversationControls,
      changeTask, createPatientCase, createPatientTask, completePatientTask, addPatientContact, updatePatientLocal, addCaseComment,
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
      setConversationMode,
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
