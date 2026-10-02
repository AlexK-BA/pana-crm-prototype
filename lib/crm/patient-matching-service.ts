import type { ContactIdentity, EngagementCase, MatchCandidate, MatchOutcome, Patient, PatientMatchInput } from "./entities"
import type { Permission } from "./permissions"
import { AccessCommandError } from "./permissions"
import { PATIENT_MATCH_POLICY as policy } from "./patient-matching-policy"

export function normalizeMatchingPhone(value?: string) {
  let phone = value?.trim().replace(/[\s()-]/g, "") ?? ""
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`
  if (/^\d+$/.test(phone) && phone.length === policy.localPhoneDigits) phone = `+${policy.defaultPhoneCountryCode}${phone}`
  else if (/^\d+$/.test(phone) && phone.startsWith(policy.defaultPhoneCountryCode) && phone.length === policy.localPhoneDigits + policy.defaultPhoneCountryCode.length) phone = `+${phone}`
  if (phone.startsWith(`+${policy.defaultPhoneCountryCode}`) && (phone.length !== policy.localPhoneDigits + policy.defaultPhoneCountryCode.length + 1 || !/^[1-9]\d{8}$/.test(phone.slice(policy.defaultPhoneCountryCode.length + 1)))) return undefined
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : undefined
}
export function normalizeMatchingEmail(value?: string) {
  const email = value?.trim().toLowerCase()
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined
}
export function normalizeMatchingPesel(value?: string) {
  const pesel = value?.replace(/\s/g, "")
  return pesel && /^\d{11}$/.test(pesel) ? pesel : undefined
}
export const normalizeExternalPatientId = (value?: string) => value?.trim() || undefined
const normalizeName = (value?: string) => value?.trim().replace(/\s+/g, " ").toLocaleLowerCase() || undefined
export function normalizeMatchInput(input: PatientMatchInput): PatientMatchInput {
  return { externalPatientId: normalizeExternalPatientId(input.externalPatientId), pesel: normalizeMatchingPesel(input.pesel),
    phone: normalizeMatchingPhone(input.phone), email: normalizeMatchingEmail(input.email),
    firstName: normalizeName(input.firstName), lastName: normalizeName(input.lastName), clinicId: input.clinicId }
}
export function normalizedIdentityValue(identity: Pick<ContactIdentity, "channel" | "value">) {
  return identity.channel === "phone" ? normalizeMatchingPhone(identity.value)
    : identity.channel === "email" ? normalizeMatchingEmail(identity.value) : identity.value.trim() || undefined
}
export function maskMatchingIdentifier(value?: string) {
  if (!value) return "—"
  return `••••${value.slice(-3)}`
}
export function redactMatchingReason(value: string) {
  return value.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email ukryty]")
    .replace(/(?:\+?\d[\s()-]*){7,}/g, "[identyfikator ukryty]").slice(0, 500)
}
function revision(value: unknown) {
  // Session-local revision, not a cryptographic identifier or authentication token.
  let hash = 2166136261
  for (const character of JSON.stringify(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16)
}
export interface MatchingResult {
  decision: MatchOutcome
  candidates: MatchCandidate[]
  reason: string
  fingerprint: string
}
/** Stateless Medical CRM result emulation. Scope never removes competing candidates from assessment. */
export function assessPatientMatch(input: PatientMatchInput, patients: Patient[], identities: ContactIdentity[],
  ownership: { casePatientId?: string; identityPatientIds?: string[]; contactValues?: Pick<ContactIdentity, "channel" | "value">[] } = {}): MatchingResult {
  const clean = normalizeMatchInput(input)
  const candidates: MatchCandidate[] = []
  for (const patient of patients) {
    const matched: MatchCandidate["matchedSignals"] = []
    const scores: number[] = []
    const conflicts: string[] = []
    if (clean.externalPatientId && normalizeExternalPatientId(patient.externalPatientId) === clean.externalPatientId) { matched.push("externalPatientId"); scores.push(policy.confidence.externalPatientId) }
    if (clean.pesel && normalizeMatchingPesel(patient.pesel) === clean.pesel) { matched.push("pesel"); scores.push(policy.confidence.pesel) }
    for (const channel of ["phone", "email"] as const) {
      const values = [clean[channel], ...(ownership.contactValues ?? []).filter(item => item.channel === channel).map(normalizedIdentityValue)].filter((value): value is string => Boolean(value))
      if (!values.length) continue
      const contacts = identities.filter(identity => identity.patientId === patient.id && identity.channel === channel && Boolean(normalizedIdentityValue(identity)) && values.includes(normalizedIdentityValue(identity)!))
      if (contacts.length) { matched.push(channel); scores.push(contacts.some(identity => identity.verified) ? policy.confidence.verifiedContact : policy.confidence.unverifiedContact) }
    }
    const knownContacts = identities.filter(identity => identity.patientId === patient.id && !["phone", "email"].includes(identity.channel)
      && (ownership.contactValues ?? []).some(contact => contact.channel === identity.channel && normalizedIdentityValue(contact) === normalizedIdentityValue(identity)))
    if (knownContacts.length) { matched.push("contactIdentity"); scores.push(knownContacts.some(identity => identity.verified) ? policy.confidence.verifiedContact : policy.confidence.unverifiedContact) }
    const nameMatches = Boolean(clean.firstName && clean.lastName && clean.firstName === normalizeName(patient.firstName) && clean.lastName === normalizeName(patient.lastName))
    if (!scores.length && !nameMatches) continue
    if (nameMatches) matched.push("name")
    if (clean.clinicId === patient.primaryClinicId) matched.push("clinic")
    if (clean.externalPatientId && patient.externalPatientId && clean.externalPatientId !== normalizeExternalPatientId(patient.externalPatientId)) conflicts.push("externalPatientId")
    if (clean.pesel && normalizeMatchingPesel(patient.pesel) && clean.pesel !== normalizeMatchingPesel(patient.pesel)) conflicts.push("pesel")
    if (ownership.casePatientId && ownership.casePatientId !== patient.id) conflicts.push("case_owner")
    if (ownership.identityPatientIds?.some(id => id !== patient.id)) conflicts.push("identity_owner")
    const maximum = scores.length ? Math.max(...scores) : policy.confidence.name
    const confidence = maximum === policy.confidence.externalPatientId ? maximum : Math.min(policy.corroboratedMaximum,
      maximum + Math.max(0, scores.length - 1) * policy.corroborationBoost + (scores.length && nameMatches ? policy.nameBoost : 0) + (scores.length && matched.includes("clinic") ? policy.clinicBoost : 0))
    candidates.push({ candidatePatientId: patient.id, confidence: Number(confidence.toFixed(3)), matchedSignals: matched, conflictingSignals: conflicts })
  }
  candidates.sort((a, b) => b.confidence - a.confidence || a.candidatePatientId.localeCompare(b.candidatePatientId))
  const identifiers = candidates.filter(candidate => candidate.matchedSignals.some(signal => !["name", "clinic"].includes(signal)))
  // Name-only alternatives never overturn exact identity evidence. All identity alternatives remain visible.
  const relevant = identifiers.length ? identifiers : candidates
  let decision: MatchOutcome = "no_match"
  let reason = "Brak dopasowania. Kontakt pozostaje samodzielną sprawą."
  if (relevant.some(candidate => candidate.conflictingSignals.length)) { decision = "conflict"; reason = "Sprzeczne identyfikatory lub istniejące powiązanie. Automatyczne łączenie jest zabronione." }
  else if (relevant.length > 1) { decision = "ambiguous"; reason = "Więcej niż jeden pacjent pasuje do danych. Wymagana kontrolowana decyzja." }
  else if (relevant.length === 1) {
    decision = identifiers.length && relevant[0].confidence >= policy.autoLinkThreshold ? "auto_link" : "suggested_match"
    reason = decision === "auto_link" ? "Unikalne, zgodne i wystarczająco wiarygodne dane." : "Dane nie osiągają progu auto-link; samo imię lub niepotwierdzony kontakt wymaga oceny."
  }
  return { decision, candidates: relevant, reason, fingerprint: revision({ clean, ownership, candidates: relevant, decision }) }
}

/** Carries existing AuthorizationContext/UserDirectory capabilities; not another RBAC model. */
export interface MatchingAccess {
  actorId: string
  active: boolean
  globalScope: boolean
  clinicIds: Patient["primaryClinicId"][]
  hasPermission: (permission: Permission) => boolean
}
export function patientWithinMatchingScope(patient: Patient, access: MatchingAccess) {
  return access.globalScope || access.clinicIds.includes(patient.primaryClinicId)
}
export function assertMatchingAccess(access: MatchingAccess | undefined, permission: Permission,
  targetCase?: EngagementCase, patient?: Patient): asserts access is MatchingAccess {
  if (!access?.active || !access.actorId || !access.hasPermission(permission) || !access.hasPermission("case:view")) throw new AccessCommandError("Brak uprawnień do operacji dopasowania pacjenta.")
  if (targetCase?.clinicId && !access.globalScope && !access.clinicIds.includes(targetCase.clinicId)) throw new AccessCommandError("Sprawa poza zakresem klinik.")
  if (patient && !patientWithinMatchingScope(patient, access)) throw new AccessCommandError("Pacjent poza zakresem klinik.")
}
export function caseMatchingInput(targetCase: EngagementCase, identities: ContactIdentity[]): PatientMatchInput {
  const identity = identities.find(item => item.id === targetCase.contactIdentityId)
  return { ...targetCase.contactProfile, clinicId: targetCase.clinicId ?? targetCase.contactProfile?.clinicId,
    phone: targetCase.contactProfile?.phone ?? (identity?.channel === "phone" ? identity.value : undefined),
    email: targetCase.contactProfile?.email ?? (identity?.channel === "email" ? identity.value : undefined) }
}
/** Incoming routing does not create a case or pick the first ambiguous patient/case. */
export function routeIncomingPatientContact(input: PatientMatchInput, patients: Patient[], identities: ContactIdentity[], cases: EngagementCase[]) {
  const result = assessPatientMatch(input, patients, identities)
  const patientId = result.decision === "auto_link" ? result.candidates[0]?.candidatePatientId : undefined
  const activeCases = patientId ? cases.filter(item => item.patientId === patientId && (!input.clinicId || item.clinicId === input.clinicId)
    && !["closed", "converted", "completed", "complete", "archived"].includes(item.status)) : []
  return { result, patientId, caseIds: activeCases.map(item => item.id), requiresCaseSelection: Boolean(patientId && activeCases.length !== 1) }
}
