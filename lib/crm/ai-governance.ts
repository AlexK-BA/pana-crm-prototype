import type {
  AiConversationPolicy,
  AiResponseTrace,
  BotActivationSchedule,
  ClinicId,
  ContactChannel,
  ConversationControl,
} from "./entities"
import { AccessCommandError } from "./permissions"

/**
 * Prototype defaults only. Daniel/business owner must approve the SLA values.
 * Production loads these policies from tenant configuration/backend storage.
 */
export const INITIAL_AI_CONVERSATION_POLICIES: AiConversationPolicy[] = [{
  id: "ai-policy-global-v1",
  name: "Domyślna obsługa administracyjna",
  channels: ["website", "whatsapp", "instagram", "facebook", "telegram", "email"],
  enabled: true,
  activationDelaySeconds: 120,
  humanTakeoverSlaSeconds: 300,
  intendedUse: "administrative_non_clinical",
  handoffRules: {
    onPatientRequest: true,
    onMedicalAdviceRequest: true,
    onEmergencyLanguage: true,
    onNoKnowledgeSource: true,
    onLowConfidence: true,
    lowConfidenceThreshold: 0.65,
    afterBotMessages: 3,
  },
  version: 1,
  updatedAt: "2026-10-02T00:00:00.000Z",
  updatedBy: "system",
}]

export function resolveAiConversationPolicy(
  policies: AiConversationPolicy[],
  clinicId: ClinicId | undefined,
  channel: ContactChannel,
) {
  const eligible = policies.filter(policy => policy.channels.includes(channel))
  return eligible.find(policy => policy.clinicId === clinicId)
    ?? eligible.find(policy => !policy.clinicId)
}

export function isAiEnabledForConversation(
  control: ConversationControl | undefined,
  policy: AiConversationPolicy | undefined,
) {
  return control?.aiEnabledOverride ?? policy?.enabled ?? false
}

export function validateAiPolicy(policy: AiConversationPolicy) {
  if (!policy.id.trim() || !policy.name.trim()) throw new AccessCommandError("Polityka AI wymaga ID i nazwy.")
  if (!policy.channels.length) throw new AccessCommandError("Polityka AI wymaga co najmniej jednego kanału.")
  if (!Number.isInteger(policy.activationDelaySeconds) || policy.activationDelaySeconds < 0 || policy.activationDelaySeconds > 86_400) {
    throw new AccessCommandError("Opóźnienie aktywacji AI musi mieścić się w zakresie 0–86400 sekund.")
  }
  if (!Number.isInteger(policy.humanTakeoverSlaSeconds) || policy.humanTakeoverSlaSeconds < 0 || policy.humanTakeoverSlaSeconds > 86_400) {
    throw new AccessCommandError("SLA przejęcia przez człowieka musi mieścić się w zakresie 0–86400 sekund.")
  }
  if (policy.intendedUse !== "administrative_non_clinical") throw new AccessCommandError("CRM dopuszcza wyłącznie administracyjne, niekliniczne użycie AI.")
  const threshold = policy.handoffRules.lowConfidenceThreshold
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new AccessCommandError("Próg pewności musi mieścić się w zakresie 0–1.")
  if (!Number.isInteger(policy.handoffRules.afterBotMessages) || policy.handoffRules.afterBotMessages < 1 || policy.handoffRules.afterBotMessages > 100) {
    throw new AccessCommandError("Limit wiadomości bota musi mieścić się w zakresie 1–100.")
  }
}

export function validateAiResponseTrace(trace: AiResponseTrace) {
  if (!trace.runId.trim() || !trace.modelProvider.trim() || !trace.modelName.trim()) throw new AccessCommandError("Odpowiedź AI wymaga identyfikatora run i wersji modelu.")
  if (!trace.policyId.trim() || trace.policyVersion < 1 || !trace.promptTemplateId.trim() || trace.promptTemplateVersion < 1) {
    throw new AccessCommandError("Odpowiedź AI wymaga wersji polityki i szablonu promptu.")
  }
  if (!trace.userDisclosureShown) throw new AccessCommandError("Nie można wysłać odpowiedzi AI bez oznaczenia rozmowy z AI.")
  if (!trace.citations.length && !trace.noSourceReason) throw new AccessCommandError("Odpowiedź AI wymaga źródła Bazy Wiedzy albo jawnej przyczyny braku źródła.")
  for (const citation of trace.citations) {
    if (!citation.sourceId.trim() || !citation.sourceTitle.trim() || !citation.sourceVersion.trim() || !Number.isFinite(Date.parse(citation.retrievedAt))) {
      throw new AccessCommandError("Źródło Bazy Wiedzy wymaga ID, tytułu, wersji i czasu pobrania.")
    }
    if (citation.relevance !== undefined && (!Number.isFinite(citation.relevance) || citation.relevance < 0 || citation.relevance > 1)) {
      throw new AccessCommandError("Trafność źródła musi mieścić się w zakresie 0–1.")
    }
  }
}

export function makeBotActivationSchedule(input: {
  id: string
  threadKey: string
  caseId: string
  patientId?: string
  triggerInteractionId: string
  policy: AiConversationPolicy
  scheduledAt: string
}): BotActivationSchedule {
  const at = Date.parse(input.scheduledAt)
  if (!Number.isFinite(at)) throw new AccessCommandError("Nieprawidłowy czas aktywacji AI.")
  return {
    id: input.id,
    threadKey: input.threadKey,
    caseId: input.caseId,
    patientId: input.patientId,
    triggerInteractionId: input.triggerInteractionId,
    policyId: input.policy.id,
    policyVersion: input.policy.version,
    scheduledAt: input.scheduledAt,
    dueAt: new Date(at + input.policy.activationDelaySeconds * 1000).toISOString(),
    status: "pending",
  }
}

export function activationRemainingMs(schedule: BotActivationSchedule | undefined, now = Date.now()) {
  if (!schedule || schedule.status !== "pending") return undefined
  return Math.max(0, Date.parse(schedule.dueAt) - now)
}

/** Conservative triggers that must stop autonomous answers and request a human. */
export function requiresHumanHandoff(policy: AiConversationPolicy, input: {
  patientRequestedHuman?: boolean
  medicalAdviceRequested?: boolean
  emergencyLanguageDetected?: boolean
  hasKnowledgeSource?: boolean
  confidence?: number
  botMessagesInThread?: number
}) {
  const rules = policy.handoffRules
  if (rules.onPatientRequest && input.patientRequestedHuman) return "patient_request"
  if (rules.onMedicalAdviceRequest && input.medicalAdviceRequested) return "medical_advice_request"
  if (rules.onEmergencyLanguage && input.emergencyLanguageDetected) return "emergency_language"
  if (rules.onNoKnowledgeSource && input.hasKnowledgeSource === false) return "no_knowledge_source"
  if (rules.onLowConfidence && input.confidence !== undefined && input.confidence < rules.lowConfidenceThreshold) return "low_confidence"
  if ((input.botMessagesInThread ?? 0) >= rules.afterBotMessages) return "bot_turn_limit"
  return undefined
}
