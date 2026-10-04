/**
 * Join layer: Task → EngagementCase → Patient/ContactIdentity → Clinic/Doctor/Procedure → Operator.
 * Screens should read through these selectors instead of reaching into the raw
 * arrays, so every view stays in sync with the same underlying entities.
 */
import type { ContactChannel, EngagementCase, Task, TaskPriority } from "./entities"
import {
  ENGAGEMENT_CASES,
  CONTACT_IDENTITIES,
  TASKS,
  getCase,
  getIdentity,
  getPatient,
  getTasksForCase,
  INTERACTIONS,
  COMMENTS,
  AUDIT_EVENTS,
} from "./entity-data"
import { getClinic, getDoctor, getProcedure } from "./catalog"
import { getCatalogUser } from "./user-catalog"
import { priorityText } from "./display-labels"
import type { Language } from "./language-context"
import { effectiveStatus, isOverdue, overdueDurationMs } from "./entity-queue"

/** "Action filter" chips for the queue — what kind of hands-on action a task needs. */
export type ActionKind = "unassigned_clinic" | "reply" | "call" | "follow_up" | "treatment_plan"

const CHAT_CHANNELS: ContactChannel[] = ["instagram", "facebook", "whatsapp", "telegram", "tiktok", "viber", "website", "personal_account"]

export const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  unassigned_clinic: "Przypisz klinikę",
  reply: "Odpowiedz w czacie",
  call: "Zadzwoń",
  follow_up: "Kolejna próba",
  treatment_plan: "Wyślij plan leczenia",
}

export function getActionKind(task: Task, engagementCase?: EngagementCase, identity?: ReturnType<typeof getIdentity>): ActionKind {
  if (engagementCase && !engagementCase.clinicId) return "unassigned_clinic"
  if (/plan leczenia/i.test(task.title)) return "treatment_plan"
  if (task.requiresCall) return task.attempts > 0 ? "follow_up" : "call"
  if (task.attempts > 0) return "follow_up"
  if (identity && CHAT_CHANNELS.includes(identity.channel)) return "reply"
  return "call"
}

export function getOperator(id?: string) {
  return getCatalogUser(id)
}

export interface QueueItem {
  task: Task
  status: Task["status"]
  overdue: boolean
  overdueMs: number
  case: NonNullable<ReturnType<typeof getCase>>
  patientName: string
  clinicName: string
  clinicColor: string
  serviceName?: string
  doctorName?: string
  identityLabel: string
  ownerName: string
  lastAction?: string
  lastActionAt?: string
  attempts: number
  actionKind: ActionKind
  clinicAssigned: boolean
}

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  P0: "bg-red-700",
  P1: "bg-red-500",
  P2: "bg-amber-500",
  P3: "bg-sky-500",
  P4: "bg-slate-400",
}

export const PRIORITY_TEXT_TONE: Record<TaskPriority, string> = {
  P0: "text-red-700",
  P1: "text-red-600",
  P2: "text-amber-600",
  P3: "text-sky-600",
  P4: "text-slate-500",
}

/** Compatibility wrapper: the single label catalog lives in display-labels.ts. */
export function priorityLabel(p: TaskPriority, language: Language = "pl") {
  return priorityText(p, language)
}

export function buildQueueItem(task: Task, nowMs = Date.now(), cases: EngagementCase[] = ENGAGEMENT_CASES): QueueItem | undefined {
  const engagementCase = cases.find((c) => c.id === task.caseId) ?? getCase(task.caseId)
  if (!engagementCase) return undefined

  const patient = getPatient(task.patientId ?? engagementCase.patientId)
  const identity = getIdentity(engagementCase.contactIdentityId)
  const clinic = getClinic(engagementCase.clinicId)
  const procedure = getProcedure(engagementCase.serviceInterest)
  const doctor = getDoctor(engagementCase.doctorId)
  const owner = getOperator(task.ownerId)

  const lastInteraction = [...INTERACTIONS]
    .filter((i) => i.caseId === engagementCase.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]

  return {
    task,
    status: effectiveStatus(task, nowMs),
    overdue: isOverdue(task, nowMs),
    overdueMs: overdueDurationMs(task, nowMs),
    case: engagementCase,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : identity?.displayName ?? "Nierozpoznany kontakt",
    clinicName: clinic?.name ?? "—",
    clinicColor: clinic?.color ?? "slate",
    serviceName: procedure?.name,
    doctorName: doctor?.name,
    identityLabel: identity ? identity.value : "—",
    ownerName: owner?.name ?? "Nieprzypisane",
    lastAction: lastInteraction ? describeInteraction(lastInteraction) : undefined,
    lastActionAt: lastInteraction?.at,
    attempts: task.attempts,
    actionKind: getActionKind(task, engagementCase, identity),
    clinicAssigned: Boolean(engagementCase.clinicId),
  }
}

function describeInteraction(interaction: (typeof INTERACTIONS)[number]) {
  if (interaction.type === "call") {
    const call = interaction as Extract<typeof interaction, { type: "call" }>
    if (call.telcoStatus === "missed") return "Nieodebrane połączenie"
    if (call.disposition === "appointment_scheduled") return "Połączenie · wizyta umówiona"
    if (call.disposition === "call_later") return "Połączenie · oddzwonić później"
    if (call.disposition === "wrong_number") return "Połączenie · błędny numer"
    return "Połączenie telefoniczne"
  }
  if (interaction.type === "note") return "Notatka"
  if (interaction.type === "chat") return "Wiadomość na czacie"
  if (interaction.type === "whatsapp") return "Wiadomość WhatsApp"
  return "Interakcja"
}

export function getCommentAndAuditCounts(caseId: string) {
  return {
    comments: COMMENTS.filter((c) => c.caseId === caseId).length,
    audit: AUDIT_EVENTS.filter((a) => a.caseId === caseId).length,
  }
}

export function getAllCases() {
  return ENGAGEMENT_CASES
}

export function getOpenTasksForCase(caseId: string) {
  return getTasksForCase(caseId).filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.status !== "failed")
}

export function getCasesForPatient(patientId: string) {
  return ENGAGEMENT_CASES.filter((c) => c.patientId === patientId)
}

export function getIdentitiesForPatient(patientId: string) {
  return CONTACT_IDENTITIES.filter((i) => i.patientId === patientId)
}

export function getTasksForPatient(patientId: string) {
  return TASKS.filter((t) => t.patientId === patientId)
}

export function getInteractionsForPatient(patientId: string) {
  return INTERACTIONS.filter((i) => i.patientId === patientId).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function getCommentsForPatient(patientId: string) {
  const caseIds = new Set(getCasesForPatient(patientId).map((c) => c.id))
  return COMMENTS.filter((c) => caseIds.has(c.caseId)).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function getAuditForPatient(patientId: string) {
  const caseIds = new Set(getCasesForPatient(patientId).map((c) => c.id))
  return AUDIT_EVENTS.filter((a) => a.patientId === patientId || (a.caseId && caseIds.has(a.caseId))).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )
}
