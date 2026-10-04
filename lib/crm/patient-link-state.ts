import type { EngagementCase, MatchDecision, Patient } from "./entities"

export type PatientLinkViewState =
  | Patient["integrationState"]
  | "auto_linked"
  | "auto_link"
  | "approved"
  | "rejected"
  | "suggested_match"
  | "ambiguous"
  | "no_match"

const PATIENT_LINK_LABELS: Record<PatientLinkViewState, { pl: string; ru: string }> = {
  auto_link: { pl: "Powiązano automatycznie", ru: "Связано автоматически" },
  auto_linked: { pl: "Powiązano automatycznie", ru: "Связано автоматически" },
  linked: { pl: "Powiązano", ru: "Связано" },
  match_suggested: { pl: "Sugerowane dopasowanie", ru: "Предложено сопоставление" },
  suggested_match: { pl: "Sugerowane dopasowanie", ru: "Предложено сопоставление" },
  ambiguous: { pl: "Niejednoznaczne dopasowanie", ru: "Неоднозначное сопоставление" },
  conflict: { pl: "Konflikt dopasowania", ru: "Конфликт сопоставления" },
  no_match: { pl: "Niepowiązano", ru: "Не связано" },
  approved: { pl: "Powiązano", ru: "Связано" },
  rejected: { pl: "Niepowiązano · odrzucono", ru: "Не связано · отклонено" },
  sync_pending: { pl: "Powiązano · synchronizacja", ru: "Связано · синхронизация" },
  sync_failed: { pl: "Powiązano · błąd synchronizacji", ru: "Связано · ошибка синхронизации" },
  unlinked: { pl: "Niepowiązano", ru: "Не связано" },
}

export function patientLinkLabel(state: PatientLinkViewState, language: "pl" | "ru" = "pl") {
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
