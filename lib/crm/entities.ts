/**
 * TO-BE domain model (§2 of the master spec).
 *
 * Patient, ContactIdentity, EngagementCase, Task, Interaction/Call and
 * Comment/AuditEvent are separate entities. This is the canonical prototype
 * domain model; the former flat CrmCase model has been removed.
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
  /** CRM-owned operational annotations; never synchronized over Medical CRM fields. */
  localTags?: string[]
  localNote?: string
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
  | "tiktok"
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
  contactIdentityIds?: string[]
  /** Local intake facts; never overwrite Medical CRM Patient fields. */
  contactProfile?: PatientMatchInput
  /** Review context for a conflicting local contact; does not link or transfer the case. */
  requestedPatientId?: string
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

export type MatchSignal = "externalPatientId" | "pesel" | "phone" | "email" | "contactIdentity" | "name" | "clinic"
export type MatchOutcome = "auto_link" | "suggested_match" | "ambiguous" | "conflict" | "no_match"
export interface PatientMatchInput {
  externalPatientId?: string
  pesel?: string
  phone?: string
  email?: string
  firstName?: string
  lastName?: string
  clinicId?: ClinicId
}
export interface MatchCandidate {
  candidatePatientId: string
  confidence: number
  matchedSignals: MatchSignal[]
  conflictingSignals: string[]
}
export interface MatchDecision {
  id: string
  caseId: string
  candidates: MatchCandidate[]
  candidatePatientId?: string
  confidence: number
  matchedSignals: MatchSignal[]
  conflictingSignals: string[]
  status: "pending" | "approved" | "rejected" | "auto_linked" | "conflict" | "expired"
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
  decision: MatchOutcome | "approved" | "rejected"
  reason: string
  /** Non-PII input/result revision token; rechecked before approval. */
  fingerprint: string
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
  | "sent"
  | "failed"
  | "patient_declined"
  | "no_valid_channel"
  | "refused"

export type TaskType = "call" | "message" | "sms" | "email" | "qualification" | "appointment_confirmation" | "appointment_booking" | "post_visit_follow_up" | "waitlist_contact" | "patient_care_handoff" | "treatment_plan_review" | "send_treatment_plan" | "custom"

/** §2.4 Task — the unit of required next work. Never collapse this into a string field. */
export interface Task {
  id: string
  caseId: string
  patientId?: string
  title: string
  description?: string
  type?: TaskType
  source?: "workflow" | "manual" | "call" | "appointment" | "medical_crm"
  originalDueAt?: string
  completedAt?: string
  rescheduleCount?: number
  previousTaskId?: string
  replacementTaskId?: string
  createdBy?: string
  updatedBy?: string
  lastChangeReason?: string
  channel?: ContactChannel
  mandatory?: boolean
  handoffState?: "pending" | "accepted"
  treatmentPlanId?: string
  treatmentPlanVersion?: number
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
  /** Stable id of the workflow rule that generated the task; used for idempotency and audit. */
  workflowRuleId?: string
}

export type InteractionType = "call" | "sms" | "whatsapp" | "email" | "chat" | "social" | "note"
export type InteractionDirection = "incoming" | "outgoing"
export type InteractionSenderKind = "patient" | "user" | "bot" | "system"
export type ConversationMode = "bot_active" | "operator_active" | "bot_paused" | "closed"

export interface ConversationControl {
  threadKey: string
  caseId: string
  patientId?: string
  contactIdentityId?: string
  channel: ContactChannel | "sms"
  mode: ConversationMode
  ownerId?: string
  botId?: string
  updatedAt: string
  updatedBy: string
}

/** §2.5 Interaction — any factual contact event on a channel. */
export interface Interaction {
  id: string
  /** Optional for patient-level SMS; other channels continue to attach to a case. */
  caseId?: string
  patientId?: string
  taskId?: string
  /** Canonical contact for channel-specific threading; legacy events derive it from the case. */
  contactIdentityId?: string
  type: InteractionType
  /** Concrete delivery channel for generic chat/social interactions. */
  channel?: ContactChannel
  direction?: InteractionDirection
  at: string
  authorId?: string
  senderKind?: InteractionSenderKind
  text?: string
}

export type SmsProviderType = "emulator" | "smsapi" | "supervoip" | (string & {})
export type SmsDeliveryStatus = "queued" | "sent" | "submitted" | "delivered" | "failed" | "undelivered" | "received" | "unknown"

export interface SmsProviderCapabilities {
  outboundSms: boolean
  inboundSms: boolean
  deliveryReports: boolean
  senderName: boolean
  ownedSenderNumber: boolean
  twoWayMessaging: boolean
  multipartMessages: boolean
  unicodeMessages: boolean
}

/** Provider-neutral clinic configuration. Secrets are intentionally absent from the frontend prototype. */
export interface SmsProviderConfiguration {
  id: string
  name: string
  providerType: SmsProviderType
  clinicId?: ClinicId
  enabled: boolean
  isDefault?: boolean
  senderMode: "sender_name" | "owned_number" | "two_way" | "provider_default"
  senderValue: string
  defaultMessageText: string
  /** Stage 1 never connects to a real provider. */
  mode: "emulation"
  inboundNumber?: string
  capabilities: SmsProviderCapabilities
  lastTestAt?: string
  lastTestStatus?: "success" | "failed"
}

/** SMS remains an Interaction for the common timeline, while carrying delivery-specific facts. */
export interface SmsMessage extends Interaction {
  type: "sms"
  direction: InteractionDirection
  channel: "phone"
  clinicId?: ClinicId
  recipient: string
  sender: string
  providerType: SmsProviderType
  providerConfigurationId: string
  providerMessageId?: string
  deliveryStatus: SmsDeliveryStatus
  providerStatus?: string
  partsCount: number
  errorMessage?: string
  submittedAt?: string
  deliveredAt?: string
  retryOfId?: string
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
  caseId: string
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
  | "case_created"
  | "comment_added"
  | "patient_local_updated"
  | "status_change"
  | "assignment_change"
  | "task_change"
  | "merge"
  | "link"
  | "unlink"
  | "sync"
  | "priority_change"
  | "sms_send"
  | "sms_failed"
  | "sms_retry"
  | "sms_provider_change"
  | "sms_provider_test"
  | "sms_provider_config"
  | "user_invited"
  | "user_activated"
  | "user_deactivated"
  | "user_password_reset_requested"
  | "user_sessions_revoked"
  | "user_access_changed"
  | "role_permissions_changed"
  | "role_permissions_reset"
  | "access_denied"
  | "patient_match_searched"
  | "patient_match_suggested"
  | "patient_auto_linked"
  | "patient_match_approved"
  | "patient_match_rejected"
  | "patient_match_conflict"
  | "contact_identity_linked"
  | "contact_identity_reused"
  | "conversation_handoff"

/** §2.7 Audit Event — system-generated change record, grouped/deduplicated in UI. */
export interface AuditEvent {
  id: string
  caseId?: string
  patientId?: string
  type: AuditEventType
  actorId: string
  targetUserId?: string
  targetRole?: import("./roles").RoleId
  taskId?: string
  action?: string
  actorRole?: import("./roles").RoleId
  clinicId?: ClinicId
  source?: Task["source"]
  workflowRuleId?: string
  matchDecisionId?: string
  confidence?: number
  matchedSignals?: MatchSignal[]
  reason?: string
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
