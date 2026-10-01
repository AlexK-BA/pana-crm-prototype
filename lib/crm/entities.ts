/**
 * TO-BE domain model (§2 of the master spec).
 *
 * This file intentionally keeps Patient, ContactIdentity, EngagementCase, Task,
 * Interaction/Call and Comment/AuditEvent as separate entities instead of the
 * single flat `CrmCase` used by the AS-IS prototype (see ./types.ts, which is
 * kept as-is for the legacy board/status vocabulary and is being phased out
 * screen by screen).
 */

export type ClinicId = "pana-medica" | "pana-comfort" | "pana-international"

export interface Clinic {
  id: ClinicId
  name: string
  /**
   * Tailwind color family used consistently across every list/kanban/card
   * surface: PaNa Medica = green, PaNa Comfort = beige/amber, PaNa
   * International = blue. Cases with no clinicId yet render neutral/white.
   */
  color: "emerald" | "amber" | "sky"
}

export interface Doctor {
  id: string
  name: string
  clinicId: ClinicId
  procedureIds: string[]
}

export interface Procedure {
  id: string
  name: string
  clinicId: ClinicId
  category?: string
  durationMin?: number
}

/** State of the link between a local record and PaNa's medical CRM (source of truth for patients). */
export type IntegrationState =
  | "linked"
  | "match_suggested"
  | "conflict"
  | "sync_pending"
  | "sync_failed"
  | "unlinked"

export type DataProvenanceSource = "PaNa CRM" | "Local CRM" | "Channel" | "User-entered"

export interface ProvenanceField {
  field: string
  source: DataProvenanceSource
  value: string
  updatedAt: string
}

export interface DataConflict {
  field: string
  localValue: string
  medicalValue: string
}

export type PreferredLanguage = "pl" | "ru" | "uk" | "be" | "en"

/**
 * §2.1 Patient — the persistent real-world patient. Medical CRM is the
 * source of truth for identity + clinical facts. NOT a kanban stage.
 */
export interface Patient {
  id: string
  externalPatientId?: string
  firstName: string
  lastName: string
  /** Optional national identifier entered locally or synchronized from Medical CRM. */
  pesel?: string
  preferredLanguage: PreferredLanguage
  primaryClinicId: ClinicId
  integrationState: IntegrationState
  lastSyncAt?: string
  careOwnerId?: string
  contactable: boolean
  consentNote?: string
  provenance: ProvenanceField[]
  conflicts?: DataConflict[]
  treatmentPlan?: TreatmentPlan
}

/** §2.2 Contact Identity — one channel/identifier a person can be reached on. */
export type ContactChannel =
  | "phone"
  | "email"
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "telegram"
  | "viber"
  | "website"
  | "personal_account"

export interface ContactIdentity {
  id: string
  patientId?: string
  channel: ContactChannel
  value: string
  isPrimary: boolean
  verified: boolean
  /** Name entered manually (e.g. via "Nowa sprawa"), shown until/unless matched to a Patient. */
  displayName?: string
}

export type CaseBoard = "leads" | "deals" | "patients"

export type TouchType = "first_touch" | "case_creation" | "lead_conversion" | "revenue_conversion"

export interface TouchPoint {
  type: TouchType
  source: string
  channel: ContactChannel
  campaign?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  language: PreferredLanguage
  clinicIntentId: ClinicId
  serviceIntent?: string
  at: string
  sourceRecordId: string
}

export interface AttributionSnapshot {
  firstTouch: TouchPoint
  caseCreationTouch: TouchPoint
  leadConversionTouch?: TouchPoint
  revenueConversionTouch?: TouchPoint
}

/** §2.3 Engagement Case — one intent/case; a Patient can have several. */
export interface EngagementCase {
  id: string
  patientId?: string
  contactIdentityId: string
  board: CaseBoard
  /** Legacy status id, kept 1:1 with lib/crm/boards.ts columns. */
  status: string
  /**
   * Undefined until an operator triages a fresh, auto-created chat draft
   * into a clinic. Renders as a neutral/white card everywhere until set.
   */
  clinicId?: ClinicId
  serviceInterest?: string
  doctorId?: string
  responsibleTeamId: string
  createdAt: string
  attribution: AttributionSnapshot
  linkedCaseIds?: string[]
  isWaitlisted?: boolean
}

export type TaskPriority = "P0" | "P1" | "P2" | "P3" | "P4"

export type TaskStatus =
  | "planned"
  | "ready"
  | "assigned"
  | "in_progress"
  | "overdue"
  | "completed"
  | "cancelled"
  | "failed"

export type TaskOutcome =
  | "appointment_scheduled"
  | "rescheduled"
  | "no_answer"
  | "wrong_number"
  | "duplicate"
  | "resignation"
  | "contact_failed"
  | "not_reached"
  | "test"
  | "done"

/** §2.4 Task — the unit of required next work. Never collapse this into a string field. */
export interface Task {
  id: string
  caseId: string
  patientId?: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueAt?: string
  slaAt?: string
  createdAt: string
  ownerId?: string
  currentWorkerId?: string
  attempts: number
  /** Workflow rule: this task cannot be skipped or completed without a logged call disposition. */
  requiresCall?: boolean
  outcome?: TaskOutcome
  skipReason?: string
  callId?: string
}

export type InteractionType = "call" | "sms" | "whatsapp" | "email" | "chat" | "social" | "note"
export type InteractionDirection = "incoming" | "outgoing"

/** §2.5 Interaction — any factual contact event on a channel. */
export interface Interaction {
  id: string
  caseId: string
  patientId?: string
  taskId?: string
  type: InteractionType
  direction?: InteractionDirection
  at: string
  authorId?: string
  text?: string
}

export type CallTelcoStatus = "ringing" | "answered" | "missed" | "failed" | "voicemail"

export type CallDisposition =
  | "appointment_scheduled"
  | "call_later"
  | "no_answer"
  | "wrong_number"
  | "duplicate"
  | "resignation"
  | "contact_failed"
  | "not_reached"
  | "test"

export type RecordingState = "available" | "pending" | "none"

/** §2.6 Call — a specialized Interaction carrying Yeastar TELCO data. */
export interface Call extends Interaction {
  type: "call"
  direction: InteractionDirection
  extension: string
  clinicId: ClinicId
  telcoStatus: CallTelcoStatus
  disposition?: CallDisposition
  startAt: string
  answerAt?: string
  endAt?: string
  talkTimeSec?: number
  ringTimeSec?: number
  totalDurationSec?: number
  recordingState: RecordingState
  attemptsToday: number
  isFinalCdr: boolean
}

/** §2.7 Comment — human message, kept separate from system Audit Events. */
export interface Comment {
  id: string
  caseId: string
  authorId: string
  at: string
  text: string
  pinned?: boolean
  edited?: boolean
  mentions?: string[]
}

export type AuditEventType =
  | "status_change"
  | "assignment_change"
  | "task_change"
  | "merge"
  | "link"
  | "unlink"
  | "sync"
  | "priority_change"

/** §2.7 Audit Event — system-generated change record, grouped/deduplicated in UI. */
export interface AuditEvent {
  id: string
  caseId?: string
  patientId?: string
  type: AuditEventType
  actorId: string
  at: string
  summary: string
  before?: string
  after?: string
  correlationId?: string
  /** Number of low-level events collapsed into this one (e.g. repeated reorders). */
  occurrences?: number
}

export type TreatmentPlanStatus = "draft" | "presented" | "accepted" | "in_progress" | "completed"

export interface TreatmentPlanItem {
  id: string
  name: string
  price?: number
}

export interface TreatmentPlan {
  id: string
  status: TreatmentPlanStatus
  totalValue?: number
  currency?: string
  items: TreatmentPlanItem[]
  version: number
  date: string
  documentName?: string
}

export type AgentAvailability = "available" | "on_call" | "messages" | "break" | "offline"

export interface AgentPresence {
  operatorId: string
  availability: AgentAvailability
  currentCaseId?: string
  clinicId?: ClinicId
  sinceAt: string
}

/** SMS notification broadcast/campaign (bulk send to a filtered audience). */
export type BroadcastStatus = "sent" | "failed"

export interface Broadcast {
  id: string
  name: string
  channel: "sms"
  message: string
  audienceLabel: string
  clinicId?: ClinicId
  recipientCount: number
  status: BroadcastStatus
  sentAt: string
  createdBy: string
}
