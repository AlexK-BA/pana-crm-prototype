"use client"

/**
 * Single shared client state for the TO-BE entity model, so a Task/Case/
 * assignee/call-outcome change is immediately visible across every screen
 * that reads it (queue, kanban, drawer, team view) — per master spec §18.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type {
  AuditEvent,
  AiConversationPolicy,
  AiResponseTrace,
  BotActivationSchedule,
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
import { INITIAL_AI_CONVERSATION_POLICIES, isAiEnabledForConversation, makeBotActivationSchedule, resolveAiConversationPolicy, validateAiPolicy, validateAiResponseTrace } from "./ai-governance"
import { rebaseDemoTasks } from "./demo-fixtures"

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
  aiConversationPolicies: AiConversationPolicy[]
  botActivationSchedules: BotActivationSchedule[]
  setConversationMode: (input: { threadKey: string; caseId: string; patientId?: string; contactIdentityId?: string; channel: ContactChannel | "sms"; mode: ConversationMode; botId?: string; reason: string }, access?: MatchingAccess) => ConversationControl
  setConversationAiEnabled: (input: { threadKey: string; caseId: string; patientId?: string; contactIdentityId?: string; channel: ContactChannel; enabled: boolean; reason: string }, access?: MatchingAccess) => ConversationControl
  updateAiConversationPolicy: (id: string, patch: Partial<Omit<AiConversationPolicy, "id" | "version" | "updatedAt" | "updatedBy">>, reason: string, access?: MatchingAccess) => AiConversationPolicy
  activateDueBot: (threadKey: string, access?: MatchingAccess) => ConversationControl | undefined
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
    aiTrace?: AiResponseTrace
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

let botActivationSeq = 0
function nextBotActivationId() {
  botActivationSeq += 1
  return `bot-activation-live-${botActivationSeq}`
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
  const [aiConversationPolicies, setAiConversationPoliciesState] = useState<AiConversationPolicy[]>(INITIAL_AI_CONVERSATION_POLICIES)
  const aiPolicyRef = useRef(aiConversationPolicies); aiPolicyRef.current = aiConversationPolicies
  const setAiConversationPolicies = (next: AiConversationPolicy[] | ((prev: AiConversationPolicy[]) => AiConversationPolicy[])) => { const value = typeof next === "function" ? next(aiPolicyRef.current) : next; aiPolicyRef.current = value; setAiConversationPoliciesState(value) }
  const [botActivationSchedules, setBotActivationSchedulesState] = useState<BotActivationSchedule[]>([])
  const botActivationRef = useRef(botActivationSchedules); botActivationRef.current = botActivationSchedules
  const setBotActivationSchedules = (next: BotActivationSchedule[] | ((prev: BotActivationSchedule[]) => BotActivationSchedule[])) => { const value = typeof next === "function" ? next(botActivationRef.current) : next; botActivationRef.current = value; setBotActivationSchedulesState(value) }
  const setConversationControls = (next: ConversationControl[] | ((prev: ConversationControl[]) => ConversationControl[])) => {
    const value = typeof next === "function" ? next(conversationControlRef.current) : next
    conversationControlRef.current = value
    setConversationControlsState(value)
  }

  // Seed timestamps stay fixed during SSR. Once mounted, replace only the
  // untouched seed task array with a session-relative copy so Calendar and
  // Queue always demonstrate overdue, current and future work.
  useEffect(() => {
    setTasks(rebaseDemoTasks(TASKS, Date.now()))
  }, [])

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
      && (!target?.patientId || !matchingState.current.identities.some(identity => identity.id === input.cont…11773 tokens truncated…(h.store.tasks,'c1'),h.store.tasks[0])
})
test('all stage IDs retain one existing workflow catalog with type, due policy and suggestions',()=>{
 const h=create(),rules=h.load('lib/crm/workflow-rules.ts').WORKFLOW_STAGE_RULES,boards=h.load('lib/crm/boards.ts').BOARD_COLUMNS
 for(const [board,columns] of Object.entries(boards))for(const column of columns)assert.ok(rules.some(rule=>rule.board===board&&rule.status===column.id))
 assert.ok(rules.filter(rule=>!rule.terminal).every(rule=>rule.nextActionMandatory))
})
test('stage and starter task commit together; same retained command/double click creates one active task',()=>{
 const h=create(),move=h.store.moveCase,a=access();const touch=JSON.stringify(h.store.cases[0].attribution)
 move('c1','qualification','spoofed',{},a);move('c1','qualification','spoofed',{},a);h.render()
 assert.equal(h.store.cases[0].status,'qualification');assert.equal(h.store.tasks.length,1);assert.equal(h.store.tasks[0].workflowRuleId,'leads.qualification.complete');assert.equal(h.store.tasks[0].source,'workflow');assert.equal(JSON.stringify(h.store.cases[0].attribution),touch)
 const events=h.store.auditEvents;assert.ok(events.every(event=>event.actorId==='usr-test'));assert.equal(new Set(events.map(event=>event.correlationId)).size,1)
})
test('invalid transition due / stage / permissions reject atomically',()=>{
 const h=create()
 for(const fn of [()=>h.store.moveCase('c1','waiting','spoofed'),()=>h.store.moveCase('c1','unknown','spoofed',{},access()),()=>h.store.moveCase('c1','call_later','spoofed',{},access()),()=>h.store.moveCase('c1','qualification','spoofed',{dueAt:'invalid'},access()),()=>h.store.moveCase('c1','failed','spoofed',{},access())])rejects(h,fn)
})
test('callback explicit type/due creates call-required task; returning to stage reuses active rule task',()=>{
 const h=create(),a=access();h.store.moveCase('c1','call_later','ignored',{taskType:'call',dueAt:future()},a);h.render();assert.equal(h.store.tasks[0].requiresCall,true)
 h.store.moveCase('c1','qualification','ignored',{},a);h.render();h.store.moveCase('c1','call_later','ignored',{taskType:'call',dueAt:future()},a);h.render();assert.equal(h.store.tasks.filter(task=>task.workflowRuleId==='leads.call_later.call').length,1)
})
test('terminal stage creates no task and requires explicit resolution of active tasks',()=>{
 const h=create({tasks:[task({requiresCall:true})]});rejects(h,()=>h.store.moveCase('c1','closed','ignored',{reason:'Closure'},access()))
 rejects(h,()=>h.store.moveCase('c1','closed','ignored',{reason:'Closure',activeTaskDecision:'cancel'},access('operator')))
 h.store.moveCase('c1','closed','ignored',{reason:'Confirmed cancellation',activeTaskDecision:'cancel'},access());h.render();assert.equal(h.store.tasks.length,1);assert.equal(h.store.tasks[0].status,'cancelled');assert.equal(h.store.cases[0].status,'closed')
})
test('manual skip override requires permission/reason and exposes missing-next-action control state',()=>{
 const h=create();for(const a of [access('operator'),access()])rejects(h,()=>h.store.moveCase('c1','qualification','ignored',{skipAutomatic:true},a))
 h.store.moveCase('c1','qualification','ignored',{skipAutomatic:true,override:true,reason:'Approved exception'},access());h.render();assert.equal(h.store.tasks.length,0)
 const q=h.load('lib/crm/entity-queue.ts');assert.equal(q.getCaseWorkState(h.store.cases[0],h.store.tasks).missingNextAction,true);assert.equal(q.selectTaskAnalytics(h.store.tasks,h.store.auditEvents).manualOverrideCount,1)
})
test('Appointment/clinical stages reject invented dates; explicit manual date is stored',()=>{
 const cs=cases();cs[0].board='patients';cs[0].status='new_patient';const h=create({cases:cs})
 for(const stage of ['appt_scheduled','returning','in_treatment','control'])rejects(h,()=>h.store.moveCase('c1',stage,'ignored',{},access()))
 h.store.moveCase('c1','appt_scheduled','ignored',{dueAt:future()},access());h.render();assert.equal(h.store.tasks[0].type,'appointment_confirmation')
})
test('effective ranking puts overdue mandatory then other overdue ahead of future P0/P1',()=>{
 const h=create(),q=h.load('lib/crm/entity-queue.ts'),now=Date.now()
 const ts=[task({id:'futureP0',priority:'P0'}),task({id:'late',priority:'P4',dueAt:new Date(now-1000).toISOString()}),task({id:'mandatory',priority:'P4',mandatory:true,dueAt:new Date(now-500).toISOString()}),task({id:'undated',dueAt:undefined})]
 assert.deepEqual(Array.from(q.getQueue(ts),task=>task.id),['mandatory','late','futureP0','undated']);assert.equal(q.getCaseWorkState(cases()[0],ts).overdueTaskCount,2)
})
test('business priority wins inside the same operational bucket before due time',()=>{
 const h=create(),q=h.load('lib/crm/entity-queue.ts'),now=Date.now()
 const ts=[
  task({id:'older-new-lead',priority:'P3',dueAt:new Date(now-7200000).toISOString(),createdAt:'2026-01-01'}),
  task({id:'missed-call-p1',priority:'P1',requiresCall:true,dueAt:new Date(now-3600000).toISOString(),createdAt:'2026-01-02'}),
  task({id:'older-mandatory-p4',priority:'P4',mandatory:true,dueAt:new Date(now-10800000).toISOString(),createdAt:'2026-01-01'}),
  task({id:'newer-mandatory-p1',priority:'P1',mandatory:true,dueAt:new Date(now-1800000).toISOString(),createdAt:'2026-01-02'}),
 ]
 assert.deepEqual(Array.from(q.getQueue(ts,{},now),item=>item.id),['newer-mandatory-p1','older-mandatory-p4','missed-call-p1','older-new-lead'])
})
test('demo task rebasing preserves relative deadlines without mutating seed tasks',()=>{
 const h=create(),fixtures=h.load('lib/crm/demo-fixtures.ts'),reference=Date.parse(fixtures.DEMO_REFERENCE_AT),sessionNow=Date.parse('2030-05-10T09:15:00.000Z')
 const seed=[task({id:'overdue',createdAt:new Date(reference-7200000).toISOString(),dueAt:new Date(reference-3600000).toISOString(),slaAt:new Date(reference-1800000).toISOString()}),task({id:'future',createdAt:new Date(reference-1000).toISOString(),dueAt:new Date(reference+604800000).toISOString()})]
 const before=JSON.stringify(seed),rebased=fixtures.rebaseDemoTasks(seed,sessionNow)
 assert.equal(JSON.stringify(seed),before);assert.notEqual(rebased[0],seed[0])
 assert.equal(Date.parse(rebased[0].dueAt)-sessionNow,-3600000);assert.equal(Date.parse(rebased[1].dueAt)-sessionNow,604800000)
 assert.equal(Date.parse(rebased[0].slaAt)-sessionNow,-1800000);assert.equal(Date.parse(rebased[0].createdAt)-sessionNow,-7200000)
})
test('completed/cancelled/failed tasks remain in canonical history and never appear as active',()=>{
 const h=create({tasks:['completed','cancelled','failed'].map((status,index)=>task({id:String(index),status}))}),q=h.load('lib/crm/entity-queue.ts')
 assert.equal(q.getQueue(h.store.tasks).length,0);assert.equal(q.selectTaskCalendar(h.store.tasks).dated.length,3);assert.equal(q.getCaseWorkState(h.store.cases[0],h.store.tasks).missingNextAction,true)
})
test('custom requires title/description/date/type; inherits Patient from Case',()=>{
 const h=create();for(const patch of [{title:''},{description:''},{dueAt:'invalid'},{dueAt:''},{type:'not-real'},{patientId:'p2',description:''}])rejects(h,()=>h.store.createPatientTask(input(patch),access()))
 const created=h.store.createPatientTask(input({patientId:'p2'}),access());h.render();assert.equal(created.patientId,'p1');assert.equal(created.createdBy,'usr-test');assert.equal(created.originalDueAt,created.dueAt)
})
test('past dates require explicit consent, including reschedule',()=>{
 const h=create({tasks:[task()]}),dueAt=new Date(Date.now()-3600000).toISOString();rejects(h,()=>h.store.createPatientTask(input({dueAt}),access()))
 const made=h.store.createPatientTask(input({dueAt,allowPast:true}),access());h.render();assert.equal(made.dueAt,dueAt)
 rejects(h,()=>change(h,'reschedule',{dueAt}));change(h,'reschedule',{dueAt},{allowPast:true});h.render();assert.equal(h.store.tasks[0].dueAt,dueAt)
})
test('reschedule preserves original due, increments count, changes queue/calendar and never stage',()=>{
 const original=new Date(Date.now()+1000).toISOString(),h=create({tasks:[task({dueAt:original}),task({id:'t2',dueAt:new Date(Date.now()+2000).toISOString()})]}),q=h.load('lib/crm/entity-queue.ts')
 assert.equal(q.getNextTaskForCase(h.store.tasks,'c1').id,'t1');change(h,'reschedule',{dueAt:future()});h.render();change(h,'reschedule',{dueAt:future()});h.render()
 assert.equal(h.store.tasks[0].originalDueAt,original);assert.equal(h.store.tasks[0].rescheduleCount,2);assert.equal(q.getNextTaskForCase(h.store.tasks,'c1').id,'t2');assert.equal(h.store.cases[0].status,'new');assert.equal(q.selectTaskCalendar(h.store.tasks).dated[0].id,'t1')
})
test('overdue Calendar projection retains actual original date instead of moving to today',()=>{
 const due='2020-01-01T10:00:00Z',h=create({tasks:[task({dueAt:due})]}),q=h.load('lib/crm/entity-queue.ts');const projection=q.selectTaskCalendar(h.store.tasks)
 assert.equal(projection.overdue[0].dueAt,due);assert.equal(projection.dated[0].dueAt,due)
})
test('replacement links new/old and retains cancelled history',()=>{
 const h=create({tasks:[task()]});change(h,'replace',{}, {replacement:input({title:'Replacement'})});h.render()
 assert.equal(h.store.tasks[0].status,'cancelled');assert.equal(h.store.tasks[1].previousTaskId,'t1');assert.equal(h.store.tasks[0].replacementTaskId,h.store.tasks[1].id);assert.equal(h.store.tasks[1].patientId,'p1')
})
test('replacement / edit cannot move task to a different case or destroy call constraints',()=>{
 const h=create({tasks:[task({requiresCall:true,type:'call'})]});rejects(h,()=>change(h,'replace',{}, {replacement:input({caseId:'c2'})}));rejects(h,()=>change(h,'edit',{type:'custom'}));rejects(h,()=>h.store.changeTask('t1',{caseId:'c2',action:'edit',reason:'No',patch:{title:'Injected'}},access()))
})
test('all lifecycle commands require active context/permission before state or audit',()=>{
 const h=create({tasks:[task()]})
 for(const action of ['edit','reschedule','reassign','reprioritize','replace','cancel','complete','reopen'])rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action,reason:'Denied',patch:{dueAt:future()}},undefined))
 for(const fn of [()=>h.store.completeTask('t1','done'),()=>h.store.rescheduleTask('t1',future(),'No'),()=>h.store.reopenTask('t1'),()=>h.store.skipTask('t1','No'),()=>h.store.assignTask('t1','other','spoofed'),()=>h.store.setPriority('t1','P0','spoofed'),()=>h.store.changeTask('missing',{caseId:'c1',action:'complete',reason:'No'},access()),()=>h.store.changeTask('t1',{caseId:'c1',action:'complete',reason:'No'},{...access(),active:false})])rejects(h,fn)
})
test('Operator cannot reassign/reprioritize/foreign work; manager cannot mutate foreign clinic',()=>{
 const h=create({tasks:[task({ownerId:'other'}),task({id:'foreign',caseId:'c2',patientId:'p2'})]})
 for(const action of ['reassign','reprioritize','edit'])rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action,reason:'No',patch:{ownerId:'usr-test',priority:'P0'}},access('operator')))
 rejects(h,()=>h.store.changeTask('foreign',{caseId:'c2',action:'cancel',reason:'No'},access('clinic_manager')))
})
test('reassign/reprioritize validate owner/priority, with canonical actor metadata',()=>{
 const h=create({tasks:[task()]});rejects(h,()=>change(h,'reassign',{ownerId:'unknown'}));rejects(h,()=>change(h,'reprioritize',{priority:'P9'}))
 change(h,'reassign',{ownerId:'other'});h.render();change(h,'reprioritize',{priority:'P0'});h.render();assert.equal(h.store.tasks[0].ownerId,'other');assert.equal(h.store.tasks[0].priority,'P0')
 const event=h.store.auditEvents.at(-1);for(const field of ['taskId','caseId','patientId','clinicId','actorId','actorRole','before','after','reason','correlationId','at'])assert.ok(event[field]);assert.equal(event.actorId,'usr-test')
})
test('closed task cannot be edited silently; explicit reopen preserves reschedule history',()=>{
 const h=create({tasks:[task({status:'completed',completedAt:'2026-01-01',rescheduleCount:3,originalDueAt:'2025-01-01'})]});rejects(h,()=>change(h,'edit',{title:'No'}));change(h,'reopen');h.render();assert.equal(h.store.tasks[0].status,'planned');assert.equal(h.store.tasks[0].rescheduleCount,3);assert.equal(h.store.tasks[0].originalDueAt,'2025-01-01')
})
test('send treatment plan snapshots Medical CRM ID/version and does not complete by creation',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:7,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const created=h.store.sendTreatmentPlanTask('p1','c1','spoofed',access());h.render()
 assert.equal(created.type,'send_treatment_plan');assert.equal(created.treatmentPlanId,'plan');assert.equal(created.treatmentPlanVersion,7);assert.equal(created.status,'planned')
 rejects(h,()=>h.store.completePatientTask(created.id,access()));h.store.changeTask(created.id,{caseId:'c1',action:'complete',reason:'Emulated dispatch acknowledged',outcome:'sent'},access());h.render();assert.equal(h.store.tasks[0].outcome,'sent');assert.equal(h.store.tasks[0].treatmentPlanVersion,7)
})
test('missing plan / medical permission rejects without fictional plan/task',()=>{
 const h=create();rejects(h,()=>h.store.sendTreatmentPlanTask('p1','c1','ignored',access()));rejects(h,()=>h.store.createPatientTask(input({type:'send_treatment_plan',channel:'email'}),access('operator')))
})
test('plan failed result requires next action atomically or explicit cancellation reason',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:1,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const created=h.store.sendTreatmentPlanTask('p1','c1','ignored',access());h.render()
 rejects(h,()=>h.store.changeTask(created.id,{caseId:'c1',action:'complete',reason:'Failure',outcome:'failed'},access()))
 h.store.changeTask(created.id,{caseId:'c1',action:'complete',reason:'Provider emulator failure; next contact',outcome:'failed',nextTask:input()},access());h.render();assert.equal(h.store.tasks[0].status,'failed');assert.equal(h.store.tasks.length,2)
})
test('requiresCall manual complete/reschedule is rejected even for Admin; cancel/replace require supervisor reason',()=>{
 const h=create({tasks:[task({requiresCall:true,type:'call'})]});for(const action of ['complete','reschedule'])rejects(h,()=>change(h,action,{dueAt:future()}));rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action:'cancel',reason:'No'},access('operator')))
 change(h,'cancel');h.render();assert.equal(h.store.tasks[0].status,'cancelled')
})
test('real call wrap-up retry preserves Task ID/original due and increments reschedule counter',()=>{
 const due=future(),h=create({tasks:[task({requiresCall:true,ownerId:'usr-test',dueAt:due})]});h.scoped('operator');h.callRender();h.call.startOutgoingCall({caseId:'c1',taskId:'t1'});h.callRender();h.call.hangUp();h.callRender()
 assert.equal(h.call.submitWrapUp('no_answer',{rescheduleAt:future()}),true);h.render();assert.equal(h.store.tasks[0].id,'t1');assert.equal(h.store.tasks[0].status,'planned');assert.equal(h.store.tasks[0].originalDueAt,due);assert.equal(h.store.tasks[0].rescheduleCount,1)
})
test('Marketing receives neither task records nor Patient PII; retained command uses live role',()=>{
 const h=create({tasks:[task()]}),scoped=h.scoped('admin');h.scoped('marketing');rejects(h,()=>scoped.changeTask('t1',{caseId:'c1',action:'cancel',reason:'Denied'}));const m=h.scoped('marketing');assert.equal(m.tasks.length,0);assert.equal(m.patients.length,0)
})
test('analytics preserves replacement/cancellation/reschedule/manual/workflow and actor totals',()=>{
 const h=create({tasks:[task()]});change(h,'reschedule',{dueAt:future()});h.render();change(h,'replace',{}, {replacement:input()});h.render();const q=h.load('lib/crm/entity-queue.ts'),analytics=q.selectTaskAnalytics(h.store.tasks,h.store.auditEvents)
 assert.equal(analytics.rescheduleCount,1);assert.equal(analytics.replacementCount,1);assert.equal(analytics.cancellationCount,1);assert.equal(analytics.manualCreated,1);assert.equal(analytics.byActor['usr-test'],3)
})

test('invalid calendar dates and inactive/out-of-clinic assignees reject before mutations',()=>{
 const h=create({tasks:[task()]});for(const dueAt of ['2027-02-30T12:00','2027-01-01T25:00','tomorrow'])rejects(h,()=>h.store.createPatientTask(input({dueAt}),access()))
 const scoped={...access(),assignableUserScopes:{other:['pana-comfort']}};rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action:'reassign',reason:'Denied',patch:{ownerId:'other'}},scoped))
})
test('patient-care handoff remains pending until its receiving owner accepts',()=>{
 const cs=cases();cs[0].board='deals';cs[0].status='post_visit';const h=create({cases:cs});h.store.moveCase('c1','care','ignored',{ownerId:'other'},access());h.render();assert.equal(h.store.tasks[0].handoffState,'pending')
 const id=h.store.tasks[0].id;rejects(h,()=>h.store.changeTask(id,{caseId:'c1',action:'complete',reason:'Sender cannot accept'},access()))
 h.store.changeTask(id,{caseId:'c1',action:'complete',reason:'Receiving user accepts'},{...access('patient_care'),actorId:'other'});h.render();assert.equal(h.store.tasks[0].handoffState,'accepted')
})
test('booking emulator cannot silently complete a call-required task or mutate a foreign task',()=>{
 const h=create({tasks:[task({requiresCall:true}),task({id:'foreign',caseId:'c2',patientId:'p2'})]});rejects(h,()=>h.store.bookAppointment({caseId:'c1',taskId:'foreign',label:'Synthetic slot',actorId:'spoof'},access()))
 h.store.bookAppointment({caseId:'c1',taskId:'t1',label:'Synthetic slot',actorId:'spoof'},access());h.render();assert.equal(h.store.tasks[0].status,'ready');assert.equal(h.store.tasks[0].outcome,undefined)
})
test('explicit plan cancellation with failure reason records outcome without inventing a retry',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:1,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const task=h.store.sendTreatmentPlanTask('p1','c1','ignored',access());h.render()
 h.store.changeTask(task.id,{caseId:'c1',action:'cancel',reason:'No usable address; explicitly closed',outcome:'no_valid_channel'},access());h.render();assert.equal(h.store.tasks[0].outcome,'no_valid_channel');assert.equal(h.store.tasks[0].status,'cancelled');assert.equal(h.store.tasks.length,1)
})

test('phone wrap-up never claims a treatment plan was sent',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:2,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const planTask=h.store.sendTreatmentPlanTask('p1','c1','ignored',access());h.render();h.scoped('admin');h.callRender()
 h.call.startOutgoingCall({caseId:'c1',taskId:planTask.id});h.callRender();h.call.hangUp();h.callRender();assert.equal(h.call.submitWrapUp('appointment_scheduled'),true);h.render();assert.equal(h.store.tasks[0].status,'planned');assert.equal(h.store.tasks[0].outcome,undefined)
})
test('invalid foreign/closed call task rejects before starting telephone state or audit',()=>{
 const h=create({tasks:[task({status:'completed'}),task({id:'foreign',caseId:'c2'})]});h.scoped('operator');h.callRender();const before=snapshot(h)
 assert.throws(()=>h.call.startOutgoingCall({caseId:'c1',taskId:'foreign'}));assert.throws(()=>h.call.startOutgoingCall({caseId:'c1',taskId:'t1'}));h.callRender();assert.equal(h.call.phase,'idle');assert.equal(snapshot(h),before)
})
test('legacy assign/priority/reopen APIs cannot substitute a default reason',()=>{
 const h=create({tasks:[task(),task({id:'done',status:'completed'})]}),a=access();for(const fn of [()=>h.store.assignTask('t1','other','spoofed',a),()=>h.store.setPriority('t1','P0','spoofed',a),()=>h.store.reopenTask('done',a)])rejects(h,fn)
})

test('suggested plan task retains workflow origin, snapshot and selected receiving owner',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:3,status:'presented',items:[],date:'2026-01-01'};const cs=cases();cs[0].board='patients';cs[0].status='new_patient';const h=create({patients:ps,cases:cs})
 h.store.moveCase('c1','in_treatment','ignored',{taskType:'send_treatment_plan',dueAt:future(),ownerId:'other'},access());h.render();assert.equal(h.store.tasks[0].source,'workflow');assert.equal(h.store.tasks[0].workflowRuleId,'patients.in_treatment.send_treatment_plan');assert.equal(h.store.tasks[0].treatmentPlanVersion,3);assert.equal(h.store.tasks[0].ownerId,'other')
})
test('plan command cannot read a Patient outside its medical clinic scope through a visible case',()=>{
 const ps=structuredClone(patients);ps[1].treatmentPlan={id:'foreign-plan',version:1,status:'presented',items:[],date:'2026-01-01'};const cs=cases();cs[0].patientId='p2';const h=create({patients:ps,cases:cs})
 rejects(h,()=>h.store.createPatientTask(input({type:'send_treatment_plan',channel:'email'}),access('clinic_manager')))
})

test('supervisor alternate custom stage task requires override reason and description atomically',()=>{
 const h=create(),opts={override:true,taskType:'custom',taskTitle:'Clinical coordination',taskDescription:'Coordinate the agreed operational handoff',dueAt:future(),reason:'Approved alternative'}
 rejects(h,()=>h.store.moveCase('c1','qualification','ignored',opts,access('operator')));rejects(h,()=>h.store.moveCase('c1','qualification','ignored',{...opts,taskDescription:''},access()))
 h.store.moveCase('c1','qualification','ignored',opts,access());h.render();assert.equal(h.store.cases[0].status,'qualification');assert.equal(h.store.tasks[0].title,'Clinical coordination');assert.equal(h.store.tasks[0].type,'custom');assert.equal(h.store.tasks[0].source,'workflow');assert.equal(h.store.auditEvents[0].action,'override')
})

test('editing a custom call-required task preserves its type and mandatory wrap-up',()=>{
 const h=create({tasks:[task({type:'custom',requiresCall:true})]});change(h,'edit',{title:'Updated call purpose',description:'Updated description',type:'custom'});h.render();assert.equal(h.store.tasks[0].requiresCall,true);rejects(h,()=>change(h,'complete'))
})
test('first scheduling of an undated historical task establishes immutable original deadline',()=>{
 const h=create({tasks:[task({dueAt:undefined})]}),dueAt=future();change(h,'reschedule',{dueAt});h.render();assert.equal(h.store.tasks[0].originalDueAt,dueAt)
 change(h,'reschedule',{dueAt:future()});h.render();assert.equal(h.store.tasks[0].originalDueAt,dueAt)
})

test('clinic manager cannot mutate unassigned-clinic work outside its scoped case view',()=>{
 const cs=cases();cs[0].clinicId=undefined;const h=create({cases:cs,tasks:[task()]})
 rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action:'cancel',reason:'Not in clinic scope'},access('clinic_manager')))
 rejects(h,()=>h.store.moveCase('c1','qualification','ignored',{},access('clinic_manager')))
 rejects(h,()=>h.store.createPatientTask(input(),access('clinic_manager')))
})

test('missed-call callback enforces access and canonical patient and deduplicates retained commands',()=>{
 const h=create();rejects(h,()=>h.store.ensureMissedCallTask('c1','p1'));rejects(h,()=>h.store.ensureMissedCallTask('c1','p1',access('marketing')));rejects(h,()=>h.store.ensureMissedCallTask('missing',undefined,access()));rejects(h,()=>h.store.ensureMissedCallTask('c1','p2',access()));
 const command=h.store.ensureMissedCallTask;const first=command('c1','p1',access());const second=command('c1','p1',access());h.render();assert.equal(first.id,second.id);assert.equal(h.store.tasks.length,1);assert.equal(h.store.tasks[0].patientId,'p1');assert.equal(h.store.auditEvents[0].actorId,'usr-test')
})
