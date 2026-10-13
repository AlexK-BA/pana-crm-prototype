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
  auto_link: { en: "Linked automatically", pl: "Powiązano automatycznie", ru: "Связано автоматически", es: "Vinculado automáticamente" },
  auto_linked: { en: "Linked automatically", pl: "Powiązano automatycznie", ru: "Связано автоматически", es: "Vinculado automáticamente" },
  linked: { en: "Linked", pl: "Powiązano", ru: "Связано", es: "Vinculado" },
  match_suggested: { en: "Suggested match", pl: "Sugerowane dopasowanie", ru: "Предложено сопоставление", es: "Coincidencia sugerida" },
  suggested_match: { en: "Suggested match", pl: "Sugerowane dopasowanie", ru: "Предложено сопоставление", es: "Coincidencia sugerida" },
  ambiguous: { en: "Ambiguous match", pl: "Niejednoznaczne dopasowanie", ru: "Неоднозначное сопоставление", es: "Coincidencia ambigua" },
  conflict: { en: "Match conflict", pl: "Konflikt dopasowania", ru: "Конфликт сопоставления", es: "Conflicto de coincidencia" },
  no_match: { en: "Not linked", pl: "Niepowiązano", ru: "Не связано", es: "No vinculado" },
  approved: { en: "Linked", pl: "Powiązano", ru: "Связано", es: "Vinculado" },
  rejected: { en: "Not linked · rejected", pl: "Niepowiązano · odrzucono", ru: "Не связано · отклонено", es: "No vinculado · rechazado" },
  sync_pending: { en: "Linked · syncing", pl: "Powiązano · synchronizacja", ru: "Связано · синхронизация", es: "Vinculado · sincronizando" },
  sync_failed: { en: "Linked · sync error", pl: "Powiązano · błąd synchronizacji", ru: "Связано · ошибка синхронизации", es: "Vinculado · error de sincronización" },
  unlinked: { en: "Not linked", pl: "Niepowiązano", ru: "Не связано", es: "No vinculado" },
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
