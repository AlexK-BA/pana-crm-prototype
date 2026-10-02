import type { AuditEvent, Call, Comment, ContactChannel, ContactIdentity, EngagementCase, Interaction, MatchDecision, Patient, Task } from "./entities"
import { isActive, isOverdue } from "./entity-queue"
import { getWorkflowStageRule } from "./workflow-rules"
import { normalizeMatchingPhone } from "./patient-matching-service"
import { isSmsMessage } from "./sms-service"

export type ThreadChannel = ContactChannel | "sms"
export const communicationChannel = (item: Interaction): ThreadChannel => item.type === "sms" ? "sms" : item.type === "call" ? "phone" : item.channel ?? (item.type === "email" ? "email" : item.type === "whatsapp" ? "whatsapp" : "website")
export const isCaseActive = (item: EngagementCase) => !getWorkflowStageRule(item.board, item.status)?.terminal
/** Patient 360 order is local to this projection; the shared operational queue keeps its existing policy. */
export function comparePatientTasks(a: Task, b: Task, now = Date.now()) {
  const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now))
  if (overdue) return overdue
  const priority = (task: Task) => task.priority === "P0" ? 0 : task.priority === "P1" ? 1 : 2
  return priority(a) - priority(b) || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) || a.id.localeCompare(b.id)
}
export function patientTaskGroup(task: Task, now = Date.now()) {
  if (task.status === "completed") return "completed"
  if (task.status === "cancelled") return "cancelled"
  if (task.status === "failed") return "failed"
  if (isOverdue(task, now)) return "overdue"
  return task.dueAt && new Date(task.dueAt).toDateString() === new Date(now).toDateString() ? "today" : "upcoming"
}
export interface PatientThread {
  id: string
  caseId?: string
  identityId?: string
  channel: ThreadChannel
  messages: (Interaction | Call)[]
  last?: Interaction | Call
  unread: number
  active: boolean
}
/** A view of canonical messages. Each message belongs to exactly one case/identity/channel thread. */
export function buildPatientThreads(cases: EngagementCase[], identities: ContactIdentity[], interactions: (Interaction | Call)[], readAt: Record<string, string>): PatientThread[] {
  const threads = new Map<string, PatientThread>()
  const add = (caseId: string | undefined, identityId: string | undefined, channel: ThreadChannel) => {
    const id = `${caseId ?? "patient"}/${identityId ?? "unknown"}/${channel}`
    if (!threads.has(id)) threads.set(id, { id, caseId, identityId, channel, messages: [], unread: 0, active: !caseId || Boolean(cases.find(item => item.id === caseId && isCaseActive(item))) })
    return threads.get(id)!
  }
  for (const item of cases) for (const id of item.contactIdentityIds ?? [item.contactIdentityId]) {
    const identity = identities.find(contact => contact.id === id)
    if (identity) { add(item.id, id, identity.channel); if (identity.channel === "phone") add(item.id, id, "sms") }
  }
  for (const identity of identities) if (!cases.some(item => (item.contactIdentityIds ?? [item.contactIdentityId]).includes(identity.id))) {
    add(undefined, identity.id, identity.channel); if (identity.channel === "phone") add(undefined, identity.id, "sms")
  }
  for (const message of interactions) {
    if (message.type === "note") continue // notes are activity, not channel conversation
    const channel = communicationChannel(message)
    const targetCase = cases.find(item => item.id === message.caseId)
    const ids = targetCase?.contactIdentityIds ?? (targetCase ? [targetCase.contactIdentityId] : identities.map(item => item.id))
    const owned = identities.filter(item => item.patientId && item.patientId === targetCase?.patientId && item.channel === (channel === "sms" ? "phone" : channel))
    const identity = message.contactIdentityId ? identities.find(item => item.id === message.contactIdentityId)
      : isSmsMessage(message) ? identities.find(item => ids.includes(item.id) && item.channel === "phone" && Boolean(normalizeMatchingPhone(message.recipient)) && normalizeMatchingPhone(item.value) === normalizeMatchingPhone(message.recipient))
        : identities.find(item => ids.includes(item.id) && item.channel === (channel === "sms" ? "phone" : channel)) ?? (owned.length === 1 ? owned[0] : undefined)
    const thread = add(message.caseId, identity?.id, channel)
    thread.messages.push(message)
  }
  for (const thread of threads.values()) {
    thread.messages.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    thread.last = thread.messages.at(-1)
    const read = readAt[`thread:${thread.id}`] ?? (thread.caseId ? readAt[thread.caseId] : undefined)
    thread.unread = thread.messages.filter(item => item.direction === "incoming" && (!read || Date.parse(item.at) > Date.parse(read))).length
  }
  return [...threads.values()].sort((a, b) => Date.parse(b.last?.at ?? "1970-01-01") - Date.parse(a.last?.at ?? "1970-01-01") || a.id.localeCompare(b.id))
}
export interface PatientActivity {
  id: string; at: string; kind: "interaction" | "audit"; caseId?: string; interaction?: Interaction | Call; events: AuditEvent[]
}
/** Group technical audit rows by operation and fold matching message audit into the one factual activity. */
export function buildPatientActivity(interactions: (Interaction | Call)[], audit: AuditEvent[]): PatientActivity[] {
  const entries = new Map<string, PatientActivity>()
  for (const item of interactions) entries.set(item.id, { id: item.id, at: item.at, caseId: item.caseId, kind: "interaction", interaction: item, events: [] })
  for (const event of audit) {
    const key = event.correlationId ?? event.id
    const existing = entries.get(key)
    if (existing) { existing.events.push(event); if (Date.parse(event.at) > Date.parse(existing.at)) existing.at = event.at }
    else entries.set(key, { id: key, at: event.at, caseId: event.caseId, kind: "audit", events: [event] })
  }
  return [...entries.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}
export function selectPatient360(patientId: string, source: { patients: Patient[]; cases: EngagementCase[]; identities: ContactIdentity[]; tasks: Task[]; interactions: (Interaction | Call)[]; comments: Comment[]; auditEvents: AuditEvent[]; matchDecisions: MatchDecision[]; readAt: Record<string, string> }, now = Date.now()) {
  const patient = source.patients.find(item => item.id === patientId)
  const cases = source.cases.filter(item => item.patientId === patientId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const ids = new Set(cases.map(item => item.id))
  const identities = source.identities.filter(item => item.patientId === patientId || cases.some(c => (c.contactIdentityIds ?? [c.contactIdentityId]).includes(item.id)))
  const tasks = source.tasks.filter(item => ids.has(item.caseId)).sort((a, b) => comparePatientTasks(a, b, now))
  const interactions = source.interactions.filter(item => item.caseId ? ids.has(item.caseId) : item.patientId === patientId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const audit = source.auditEvents.filter(item => item.caseId ? ids.has(item.caseId) : item.patientId === patientId)
  const comments = source.comments.filter(item => ids.has(item.caseId)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const matches = source.matchDecisions.filter(item => ids.has(item.caseId) || source.cases.some(target => target.id === item.caseId && target.requestedPatientId === patientId))
  return { patient, cases, identities, tasks, interactions, audit, comments, matches, firstTouch: cases[0]?.attribution.firstTouch,
    nextTask: tasks.find(isActive), overdue: tasks.filter(item => isOverdue(item, now)),
    lastIncoming: interactions.find(item => item.direction === "incoming"), lastAction: interactions.find(item => item.direction === "outgoing"),
    threads: buildPatientThreads(cases, identities, interactions, source.readAt), activity: buildPatientActivity(interactions, audit) }
}
