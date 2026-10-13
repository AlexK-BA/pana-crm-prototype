import type { EngagementCase, MatchDecision, Patient } from "./entities"
import type { Language } from "./language-context"

export type PatientLinkViewState =
  | Patient["integrationState"]
  | "auto_linked"
  | "auto_link"
  | "approved"
  | "rejected"
  | "suggested_match"
  | "ambiguous"
  | "no_match"

const PATIENT_LINK_LABELS: Record<PatientLinkViewState, Record<Language, string>> = {
  auto_link: { en: "Linked automatically", pl: "Powiązano automatycznie", ru: "Связано автоматически" },
  auto_linked: { en: "Linked automatically", pl: "Powiązano automatycznie", ru: "Связано автоматически" },
  linked: { en: "Linked", pl: "Powiązano", ru: "Связано" },
  match_suggested: { en: "Suggested match", pl: "Sugerowane dopasowanie", ru: "Предложено сопоставление" },
  suggested_match: { en: "Suggested match", pl: "Sugerowane dopasowanie", ru: "Предложено сопоставление" },
  ambiguous: { en: "Ambiguous match", pl: "Niejednoznaczne dopasowanie", ru: "Неоднозначное сопоставление" },
  conflict: { en: "Match conflict", pl: "Konflikt dopasowania", ru: "Конфликт сопоставления" },
  no_match: { en: "Not linked", pl: "Niepowiązano", ru: "Не связано" },
  approved: { en: "Linked", pl: "Powiązano", ru: "Связано" },
  rejected: { en: "Not linked · rejected", pl: "Niepowiązano · odrzucono", ru: "Не связано · отклонено" },
  sync_pending: { en: "Linked · syncing", pl: "Powiązano · synchronizacja", ru: "Связано · синхронизация" },
  sync_failed: { en: "Linked · sync error", pl: "Powiązano · błąd synchronizacji", ru: "Связано · ошибка синхронизации" },
  unlinked: { en: "Not linked", pl: "Niepowiązano", ru: "Не связано" },
}

export function patientLinkLabel(state: PatientLinkViewState, language: Language = "en") {
  return PATIENT_LINK_LABELS[state][language]
}

/**
 * Canonical presentation state for the link between an Engagement Case and
 * the Medical CRM Patient. A local Patient profile may group contacts and
 * cases while still being explicitly unlinked from Medical CRM.
 */
export function resolvePatientLinkState(
  targetCase: EngagementCase | undefined,
  patient: Patient | undefined,
  decision: MatchDecision | undefined,
): PatientLinkViewState {
  if (!targetCase?.patientId || !patient) return decision?.decision ?? "unlinked"
  if (decision?.decision === "conflict" || decision?.status === "conflict") return "conflict"
  if (patient.integrationState === "linked" && decision?.status === "auto_linked") return "auto_linked"
  return patient.integrationState
}
