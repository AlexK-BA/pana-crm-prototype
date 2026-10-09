/**
 * Demo dataset for the TO-BE entity model (§15 of the master spec).
 * Records are cross-linked (Patient → ContactIdentity → EngagementCase → Task →
 * Interaction/Call → Comment/AuditEvent) so every screen reads from the same
 * shared state instead of independent mock cards.
 */
import type {
  AgentPresence,
  AttributionSnapshot,
  AuditEvent,
  Broadcast,
  Call,
  Comment,
  ContactIdentity,
  EngagementCase,
  Interaction,
  Patient,
  SmsMessage,
  Task,
  TouchPoint,
} from "./entities"
import { INITIAL_USERS } from "./user-catalog"
import { DEMO_REFERENCE_MS } from "./demo-fixtures"
import { BRAND_CONFIG } from "./brand-config"

const HOUR = 1000 * 60 * 60
// Fixed reference instant (not Date.now()) so every seeded timestamp is
// identical whether this module is evaluated on the server or re-evaluated
// in the browser bundle — otherwise the two evaluations happen at different
// wall-clock times and every "now"-relative demo timestamp would mismatch
// between SSR and hydration.
const now = DEMO_REFERENCE_MS
export const iso = (offsetHours: number) => new Date(now + offsetHours * HOUR).toISOString()

const [WERONIKA, ILONA, PAVEL, DANIEL, ALEH] = INITIAL_USERS.map((o) => o.id)

function touch(partial: Partial<TouchPoint> & Pick<TouchPoint, "type" | "source" | "channel" | "at" | "sourceRecordId">): TouchPoint {
  return {
    language: "pl",
    clinicIntentId: "pana-medica",
    ...partial,
  }
}

function attribution(first: TouchPoint, extra: Partial<AttributionSnapshot> = {}): AttributionSnapshot {
  return { firstTouch: first, caseCreationTouch: extra.caseCreationTouch ?? first, ...extra }
}

// ---------------------------------------------------------------------------
// Patients (§2.1) — medical CRM is source of truth; not a kanban stage.
// ---------------------------------------------------------------------------
export const PATIENTS: Patient[] = [
  {
    id: "pat-01",
    externalPatientId: "MED-100234",
    firstName: "Marek",
    lastName: "Nowicki",
    preferredLanguage: "pl",
    primaryClinicId: "pana-medica",
    integrationState: "linked",
    lastSyncAt: iso(-2),
    careOwnerId: WERONIKA,
    contactable: true,
    address: { line1: "ul. Dąbrowskiego 118/7", postalCode: "60-577", city: "Poznań", countryCode: "PL", source: "medical_crm", updatedAt: iso(-2) },
    portalAccount: { accountId: "pa-100234", status: "active", registeredAt: iso(-720), verifiedAt: iso(-700), lastLoginAt: iso(-48) },
    allergies: [
      { id: "allergy-01", substance: "Penicylina", reaction: "Wysypka", severity: "moderate", status: "active", recordedAt: iso(-2400), source: "medical_crm" },
      { id: "allergy-02", substance: "Lateks", severity: "unknown", status: "unconfirmed", recordedAt: iso(-120), source: "medical_crm" },
    ],
    medicalVisits: [
      { id: "visit-01", externalVisitId: "PM-V-88201", clinicId: "pana-medica", doctorId: "doc-kowalska", procedureId: "proc-implant",
        treatmentPlanId: "tp-01", startsAt: iso(72), endsAt: iso(73), status: "confirmed", source: "medical_crm", lastSyncAt: iso(-2) },
      { id: "visit-00", externalVisitId: "PM-V-87011", clinicId: "pana-medica", doctorId: "doc-kowalska", procedureId: "proc-implant",
        treatmentPlanId: "tp-01", startsAt: iso(-720), endsAt: iso(-719), status: "completed", source: "medical_crm", lastSyncAt: iso(-2) },
    ],
    provenance: [
      { field: "firstName", source: "Medical CRM", value: "Marek", updatedAt: iso(-2) },
      { field: "lastName", source: "Medical CRM", value: "Nowicki", updatedAt: iso(-2) },
      { field: "phone", source: "Channel", value: "+48 611 924 357", updatedAt: iso(-120) },
    ],
    treatmentPlan: {
      id: "tp-01",
      status: "presented",
      totalValue: 8400,
      currency: "PLN",
      items: [
        { id: "tpi-1", name: "Implant · ząb 24", price: 4200 },
        { id: "tpi-2", name: "Korona cyrkonowa", price: 4200 },
      ],
      version: 2,
      date: iso(-72),
      documentName: "plan-leczenia-nowicki-v2.pdf",
    },
    treatmentPlans: [{
      id: "tp-00", status: "completed", totalValue: 850, currency: "PLN",
      items: [{ id: "tpi-0", name: "Higienizacja", price: 850 }], version: 1, date: iso(-1440), documentName: "plan-higienizacja-v1.pdf",
    }],
  },
  {
    id: "pat-02",
    externalPatientId: "MED-100540",
    firstName: "Kseniya",
    lastName: "Symonovich",
    preferredLanguage: "ru",
    primaryClinicId: "pana-medica",
    integrationState: "linked",
    lastSyncAt: iso(-6),
    careOwnerId: ILONA,
    contactable: true,
    provenance: [{ field: "phone", source: "Medical CRM", value: "+48 712 483 209", updatedAt: iso(-6) }],
  },
  {
    id: "pat-03",
    externalPatientId: undefined,
    firstName: "Nierozpoznany",
    lastName: "kontakt",
    preferredLanguage: "ru",
    primaryClinicId: "pana-medica",
    integrationState: "unlinked",
    careOwnerId: WERONIKA,
    contactable: true,
    provenance: [{ field: "channel", source: "Channel", value: "instagram:203847612", updatedAt: iso(-0.3) }],
  },
  // Scenario 11 + 12: two contacts match one patient by phone/email, ambiguous merge candidate.
  {
    id: "pat-04",
    externalPatientId: "MED-100811",
    firstName: "Oksana",
    lastName: "Melnychuk",
    preferredLanguage: "uk",
    primaryClinicId: "pana-comfort",
    integrationState: "match_suggested",
    lastSyncAt: iso(-24),
    careOwnerId: PAVEL,
    contactable: true,
    provenance: [{ field: "email", source: "Medical CRM", value: "o.melnychuk@example.com", updatedAt: iso(-24) }],
  },
  // Scenario 15: data conflict between local name and medical CRM name.
  {
    id: "pat-05",
    externalPatientId: "MED-100902",
    firstName: "Halyna",
    lastName: "Yasenchuk",
    preferredLanguage: "uk",
    primaryClinicId: "pana-comfort",
    integrationState: "conflict",
    lastSyncAt: iso(-1),
    careOwnerId: ILONA,
    contactable: true,
    provenance: [{ field: "lastName", source: "Local CRM", value: "Yesenchuk", updatedAt: iso(-48) }],
    conflicts: [{ field: "lastName", localValue: "Yesenchuk", medicalValue: "Yasenchuk" }],
  },
  // Scenario 16: patient with multiple channels.
  {
    id: "pat-06",
    externalPatientId: "MED-101044",
    firstName: "Vera",
    lastName: "Kavalchuk",
    preferredLanguage: "be",
    primaryClinicId: "pana-medica",
    integrationState: "linked",
    lastSyncAt: iso(-3),
    careOwnerId: ILONA,
    contactable: true,
    provenance: [{ field: "phone", source: "Medical CRM", value: "+48 936 214 507", updatedAt: iso(-3) }],
  },
  // Scenario 25: medical CRM sync failed but local task remains workable.
  {
    id: "pat-07",
    externalPatientId: "MED-101187",
    firstName: "Andrei",
    lastName: "Tsimoshka",
    preferredLanguage: "be",
    primaryClinicId: "pana-medica",
    integrationState: "sync_failed",
    lastSyncAt: iso(-30),
    careOwnerId: PAVEL,
    contactable: true,
    provenance: [{ field: "phone", source: "Medical CRM", value: "+48 863 402 118", updatedAt: iso(-30) }],
  },
  // Scenario 14: new patient synced from medical CRM, existing cases get assigned to it.
  {
    id: "pat-08",
    externalPatientId: "MED-101322",
    firstName: "Yauhen",
    lastName: "Bahdanovich",
    preferredLanguage: "be",
    primaryClinicId: "pana-international",
    integrationState: "linked",
    lastSyncAt: iso(-0.5),
    careOwnerId: DANIEL,
    contactable: true,
    provenance: [{ field: "firstName", source: "Medical CRM", value: "Yauhen", updatedAt: iso(-0.5) }],
  },
  {
    id: "pat-09",
    externalPatientId: "MED-101440",
    firstName: "Svitlana",
    lastName: "Ostapchuk",
    preferredLanguage: "uk",
    primaryClinicId: "pana-comfort",
    integrationState: "linked",
    lastSyncAt: iso(-260),
    careOwnerId: ILONA,
    contactable: true,
    provenance: [{ field: "phone", source: "Medical CRM", value: "+48 775 903 261", updatedAt: iso(-260) }],
    treatmentPlan: {
      id: "tp-09",
      status: "in_progress",
      totalValue: 3200,
      currency: "PLN",
      items: [{ id: "tpi-9", name: "Leczenie kanałowe", price: 3200 }],
      version: 1,
      date: iso(-200),
      documentName: "plan-leczenia-ostapchuk-v1.pdf",
    },
  },
  {
    id: "pat-10",
    externalPatientId: "MED-101558",
    firstName: "Uladzimir",
    lastName: "Kazlouski",
    preferredLanguage: "be",
    primaryClinicId: "pana-comfort",
    integrationState: "linked",
    lastSyncAt: iso(-284),
    careOwnerId: PAVEL,
    contactable: true,
    provenance: [{ field: "phone", source: "Medical CRM", value: "+48 774 520 869", updatedAt: iso(-284) }],
  },
  {
    id: "pat-11",
    externalPatientId: undefined,
    firstName: "Elvira",
    lastName: "Talkachova",
    preferredLanguage: "ru",
    primaryClinicId: "pana-medica",
    integrationState: "unlinked",
    careOwnerId: WERONIKA,
    contactable: true,
    provenance: [{ field: "channel", source: "Channel", value: "instagram:talkachova", updatedAt: iso(-2.5) }],
  },
  {
    id: "pat-12",
    externalPatientId: "MED-101690",
    firstName: "Aliaksandr",
    lastName: "Zhukouski",
    preferredLanguage: "be",
    primaryClinicId: "pana-comfort",
    integrationState: "linked",
    lastSyncAt: iso(-5),
    careOwnerId: PAVEL,
    contactable: true,
    provenance: [{ field: "phone", source: "Medical CRM", value: "+48 683 527 419", updatedAt: iso(-5) }],
  },
]

export function getPatient(id?: string) {
  if (!id) return undefined
  return PATIENTS.find((p) => p.id === id)
}

// ---------------------------------------------------------------------------
// Contact Identities (§2.2) — a Patient can have several channels.
// ---------------------------------------------------------------------------
export const CONTACT_IDENTITIES: ContactIdentity[] = [
  { id: "ci-01", patientId: "pat-01", channel: "phone", value: "+48 611 924 357", isPrimary: true, verified: true },
  { id: "ci-02", patientId: "pat-02", channel: "phone", value: "+48 712 483 209", isPrimary: true, verified: true },
  { id: "ci-03", patientId: "pat-03", channel: "instagram", value: "INSTAGRAM_203847612", isPrimary: true, verified: false },
  { id: "ci-04", patientId: "pat-04", channel: "phone", value: "+48 734 618 220", isPrimary: true, verified: true },
  // Scenario 11/12: a second identity for the same real person, not yet merged.
  { id: "ci-04b", patientId: undefined, channel: "email", value: "o.melnychuk@example.com", isPrimary: false, verified: false },
  { id: "ci-05", patientId: "pat-05", channel: "phone", value: "+48 748 220 913", isPrimary: true, verified: true },
  { id: "ci-06", patientId: "pat-06", channel: "phone", value: "+48 936 214 507", isPrimary: true, verified: true },
  { id: "ci-06b", patientId: "pat-06", channel: "whatsapp", value: "+48 936 214 507", isPrimary: false, verified: true },
  { id: "ci-06c", patientId: "pat-06", channel: "instagram", value: "vera.kavalchuk", isPrimary: false, verified: false },
  { id: "ci-07", patientId: "pat-07", channel: "phone", value: "+48 863 402 118", isPrimary: true, verified: true },
  { id: "ci-08", patientId: "pat-08", channel: "instagram", value: "yauhen.b", isPrimary: true, verified: true },
  { id: "ci-09", patientId: "pat-09", channel: "instagram", value: "svitlana.ostapchuk", isPrimary: true, verified: true },
  { id: "ci-10", patientId: "pat-10", channel: "phone", value: "+48 774 520 869", isPrimary: true, verified: true },
  { id: "ci-11", patientId: "pat-11", channel: "instagram", value: "talkachova.e", isPrimary: true, verified: false },
  { id: "ci-12", patientId: "pat-12", channel: "instagram", value: "zhukouski.a", isPrimary: true, verified: true },
  // Scenario 18: incoming unknown number, no patient/contact yet.
  { id: "ci-13", patientId: undefined, channel: "phone", value: "+48 592 817 364", isPrimary: true, verified: false },
  // Scenario 32: International direct-form intake.
  { id: "ci-14", patientId: undefined, channel: "website", value: "form:international-2026-09", isPrimary: true, verified: false },
  // Fresh Instagram DM, not yet triaged into any clinic — renders as a
  // neutral/white card everywhere until an operator assigns a clinic.
  { id: "ci-15", patientId: undefined, channel: "instagram", value: "nowy.kontakt.dm", isPrimary: true, verified: false },
]

export function getIdentity(id?: string) {
  if (!id) return undefined
  return CONTACT_IDENTITIES.find((c) => c.id === id)
}

// ---------------------------------------------------------------------------
// Engagement Cases (§2.3) — legacy board/status ids preserved 1:1.
// ---------------------------------------------------------------------------
export const ENGAGEMENT_CASES: EngagementCase[] = [
  {
    id: "case-1001",
    patientId: "pat-01",
    contactIdentityId: "ci-01",
    board: "leads",
    status: "call_later",
    clinicId: "pana-medica",
    serviceInterest: "proc-implant",
    doctorId: "doc-marchenko",
    responsibleTeamId: WERONIKA,
    createdAt: iso(-120),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", campaign: "implant_q3", utmSource: "instagram", utmMedium: "paid_social", utmCampaign: "implant_q3", language: "pl", clinicIntentId: "pana-medica", at: iso(-121), sourceRecordId: "ig-lead-88213" })),
  },
  {
    id: "case-1002",
    patientId: "pat-02",
    contactIdentityId: "ci-02",
    board: "leads",
    status: "qualification",
    clinicId: "pana-medica",
    serviceInterest: "proc-ortho",
    doctorId: "doc-wilczek",
    responsibleTeamId: ILONA,
    createdAt: iso(-96),
    attribution: attribution(touch({ type: "first_touch", source: "Yeastar", channel: "phone", language: "ru", clinicIntentId: "pana-medica", at: iso(-96), sourceRecordId: "call-cdr-55102" })),
  },
  {
    id: "case-1003",
    patientId: "pat-03",
    contactIdentityId: "ci-03",
    board: "leads",
    status: "new",
    clinicId: "pana-medica",
    serviceInterest: undefined,
    responsibleTeamId: WERONIKA,
    createdAt: iso(-0.3),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram DM", channel: "instagram", language: "ru", clinicIntentId: "pana-medica", at: iso(-0.3), sourceRecordId: "ig-dm-203847612" })),
  },
  // Scenario 18: incoming unknown number.
  {
    id: "case-1004",
    patientId: undefined,
    contactIdentityId: "ci-13",
    board: "leads",
    status: "new",
    clinicId: "pana-medica",
    responsibleTeamId: WERONIKA,
    createdAt: iso(-1.4),
    attribution: attribution(touch({ type: "first_touch", source: "Yeastar", channel: "phone", language: "pl", clinicIntentId: "pana-medica", at: iso(-1.4), sourceRecordId: "call-cdr-55190" })),
  },
  {
    id: "case-1005",
    patientId: "pat-04",
    contactIdentityId: "ci-04",
    board: "leads",
    status: "converted",
    clinicId: "pana-comfort",
    serviceInterest: "proc-prosth",
    doctorId: "doc-zawadzki",
    responsibleTeamId: PAVEL,
    createdAt: iso(-200),
    attribution: attribution(
      touch({ type: "first_touch", source: "Facebook Lead Form", channel: "facebook", campaign: "prosth_spring", language: "uk", clinicIntentId: "pana-comfort", at: iso(-210), sourceRecordId: "fb-lead-40213" }),
      { leadConversionTouch: touch({ type: "lead_conversion", source: "Facebook Lead Form", channel: "facebook", language: "uk", clinicIntentId: "pana-comfort", at: iso(-190), sourceRecordId: "fb-lead-40213" }) },
    ),
    linkedCaseIds: ["case-1101"],
  },
  {
    id: "case-1006",
    patientId: "pat-05",
    contactIdentityId: "ci-05",
    board: "leads",
    status: "qualification",
    clinicId: "pana-comfort",
    serviceInterest: "proc-perio",
    doctorId: "doc-nowak",
    responsibleTeamId: ILONA,
    createdAt: iso(-48),
    attribution: attribution(touch({ type: "first_touch", source: "Markquiz", channel: "website", language: "uk", clinicIntentId: "pana-comfort", at: iso(-48), sourceRecordId: "mq-90112" })),
  },
  {
    id: "case-1007",
    patientId: "pat-06",
    contactIdentityId: "ci-06",
    board: "leads",
    status: "qualification",
    clinicId: "pana-medica",
    serviceInterest: "proc-implant",
    responsibleTeamId: ILONA,
    createdAt: iso(-52),
    attribution: attribution(touch({ type: "first_touch", source: "Telegram", channel: "telegram", language: "be", clinicIntentId: "pana-medica", at: iso(-52), sourceRecordId: "tg-31441" })),
  },
  {
    id: "case-1008",
    patientId: "pat-07",
    contactIdentityId: "ci-07",
    board: "leads",
    status: "qualification",
    clinicId: "pana-medica",
    serviceInterest: "proc-endo",
    doctorId: "doc-marchenko",
    responsibleTeamId: PAVEL,
    createdAt: iso(-60),
    attribution: attribution(touch({ type: "first_touch", source: "Phone", channel: "phone", language: "be", clinicIntentId: "pana-medica", at: iso(-60), sourceRecordId: "call-cdr-52001" })),
  },
  {
    id: "case-1009",
    patientId: undefined,
    contactIdentityId: "ci-13",
    board: "leads",
    status: "failed",
    clinicId: "pana-medica",
    responsibleTeamId: WERONIKA,
    createdAt: iso(-70),
    attribution: attribution(touch({ type: "first_touch", source: "Phone", channel: "phone", language: "pl", clinicIntentId: "pana-medica", at: iso(-70), sourceRecordId: "call-cdr-55190" })),
  },
  {
    id: "case-1010",
    patientId: "pat-11",
    contactIdentityId: "ci-11",
    board: "leads",
    status: "new",
    clinicId: "pana-medica",
    responsibleTeamId: WERONIKA,
    createdAt: iso(-2.5),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", campaign: "spring_smile", language: "ru", clinicIntentId: "pana-medica", at: iso(-2.5), sourceRecordId: "ig-lead-10199" })),
  },
  {
    id: "case-1011",
    patientId: "pat-06",
    contactIdentityId: "ci-06",
    board: "leads",
    status: "waiting",
    clinicId: "pana-medica",
    serviceInterest: "proc-implant",
    responsibleTeamId: ILONA,
    createdAt: iso(-140),
    isWaitlisted: true,
    attribution: attribution(touch({ type: "first_touch", source: "Telegram", channel: "telegram", language: "be", clinicIntentId: "pana-medica", at: iso(-140), sourceRecordId: "tg-31441-b" })),
  },
  // Deals
  {
    id: "case-1101",
    patientId: "pat-04",
    contactIdentityId: "ci-04",
    board: "deals",
    status: "scheduled",
    clinicId: "pana-comfort",
    serviceInterest: "proc-prosth",
    doctorId: "doc-zawadzki",
    responsibleTeamId: PAVEL,
    createdAt: iso(-190),
    attribution: attribution(
      touch({ type: "first_touch", source: "Facebook Lead Form", channel: "facebook", campaign: "prosth_spring", language: "uk", clinicIntentId: "pana-comfort", at: iso(-210), sourceRecordId: "fb-lead-40213" }),
      { leadConversionTouch: touch({ type: "lead_conversion", source: "Facebook Lead Form", channel: "facebook", language: "uk", clinicIntentId: "pana-comfort", at: iso(-190), sourceRecordId: "fb-lead-40213" }) },
    ),
  },
  {
    id: "case-1102",
    patientId: "pat-12",
    contactIdentityId: "ci-12",
    board: "deals",
    status: "scheduled",
    clinicId: "pana-comfort",
    serviceInterest: "proc-restor",
    doctorId: "doc-nowak",
    responsibleTeamId: PAVEL,
    createdAt: iso(-96),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", campaign: "restor_summer", language: "be", clinicIntentId: "pana-comfort", at: iso(-96), sourceRecordId: "ig-lead-77213" })),
  },
  // Scenario 32: International direct-form intake (no Google Sheets bridge).
  {
    id: "case-1103",
    patientId: undefined,
    contactIdentityId: "ci-14",
    board: "deals",
    status: "scheduled",
    clinicId: "pana-international",
    serviceInterest: "proc-consult",
    doctorId: "doc-lisowska",
    responsibleTeamId: DANIEL,
    createdAt: iso(-3),
    attribution: attribution(touch({ type: "first_touch", source: "International Website Form", channel: "website", language: "pl", clinicIntentId: "pana-international", at: iso(-3), sourceRecordId: "web-intl-99201" })),
  },
  {
    id: "case-1104",
    patientId: "pat-12",
    contactIdentityId: "ci-12",
    board: "deals",
    status: "post_visit",
    clinicId: "pana-comfort",
    serviceInterest: "proc-restor",
    doctorId: "doc-nowak",
    responsibleTeamId: PAVEL,
    createdAt: iso(-130),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", language: "be", clinicIntentId: "pana-comfort", at: iso(-130), sourceRecordId: "ig-lead-91882" })),
  },
  {
    id: "case-1105",
    patientId: "pat-10",
    contactIdentityId: "ci-10",
    board: "deals",
    status: "no_show",
    clinicId: "pana-comfort",
    serviceInterest: "proc-hygiene",
    responsibleTeamId: PAVEL,
    createdAt: iso(-300),
    attribution: attribution(touch({ type: "first_touch", source: "Historical Google Sheet", channel: "phone", language: "be", clinicIntentId: "pana-comfort", at: iso(-300), sourceRecordId: "sheet-comfort-row-1145" })),
  },
  {
    id: "case-1106",
    patientId: "pat-01",
    contactIdentityId: "ci-01",
    board: "deals",
    status: "completed",
    clinicId: "pana-medica",
    serviceInterest: "proc-implant",
    doctorId: "doc-marchenko",
    responsibleTeamId: WERONIKA,
    createdAt: iso(-400),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", language: "pl", clinicIntentId: "pana-medica", at: iso(-400), sourceRecordId: "ig-lead-60276-old" })),
  },
  // Patients / Care Department
  {
    id: "case-1201",
    patientId: "pat-08",
    contactIdentityId: "ci-08",
    board: "patients",
    status: "appt_scheduled",
    clinicId: "pana-international",
    serviceInterest: "proc-consult",
    doctorId: "doc-lisowska",
    responsibleTeamId: DANIEL,
    createdAt: iso(-16),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", language: "be", clinicIntentId: "pana-international", at: iso(-16), sourceRecordId: "ig-lead-10023" })),
  },
  {
    id: "case-1202",
    patientId: "pat-03",
    contactIdentityId: "ci-03",
    board: "patients",
    status: "new_patient",
    clinicId: "pana-medica",
    responsibleTeamId: WERONIKA,
    createdAt: iso(-20),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram DM", channel: "instagram", language: "ru", clinicIntentId: "pana-medica", at: iso(-20), sourceRecordId: "ig-dm-10098" })),
  },
  {
    id: "case-1203",
    patientId: "pat-09",
    contactIdentityId: "ci-09",
    board: "patients",
    status: "returning",
    clinicId: "pana-comfort",
    serviceInterest: "proc-endo",
    doctorId: "doc-zawadzki",
    responsibleTeamId: ILONA,
    createdAt: iso(-260),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", language: "uk", clinicIntentId: "pana-comfort", at: iso(-260), sourceRecordId: "ig-lead-10111" })),
  },
  {
    id: "case-1204",
    patientId: "pat-10",
    contactIdentityId: "ci-10",
    board: "patients",
    status: "returning",
    clinicId: "pana-comfort",
    responsibleTeamId: PAVEL,
    createdAt: iso(-284),
    attribution: attribution(touch({ type: "first_touch", source: "Historical Google Sheet", channel: "phone", language: "be", clinicIntentId: "pana-comfort", at: iso(-284), sourceRecordId: "sheet-comfort-row-1146" })),
  },
  {
    id: "case-1205",
    patientId: "pat-06",
    contactIdentityId: "ci-06b",
    board: "patients",
    status: "in_treatment",
    clinicId: "pana-medica",
    serviceInterest: "proc-implant",
    doctorId: "doc-yanushkevich",
    responsibleTeamId: ILONA,
    createdAt: iso(-90),
    attribution: attribution(touch({ type: "first_touch", source: "WhatsApp", channel: "whatsapp", language: "be", clinicIntentId: "pana-medica", at: iso(-90), sourceRecordId: "wa-10166" })),
  },
  {
    id: "case-1206",
    patientId: "pat-05",
    contactIdentityId: "ci-05",
    board: "patients",
    status: "control",
    clinicId: "pana-comfort",
    serviceInterest: "proc-perio",
    doctorId: "doc-nowak",
    responsibleTeamId: DANIEL,
    createdAt: iso(-45),
    attribution: attribution(touch({ type: "first_touch", source: "Markquiz", channel: "website", language: "uk", clinicIntentId: "pana-comfort", at: iso(-45), sourceRecordId: "mq-10188" })),
  },
  {
    id: "case-1207",
    patientId: "pat-09",
    contactIdentityId: "ci-09",
    board: "patients",
    status: "complete",
    clinicId: "pana-comfort",
    serviceInterest: "proc-endo",
    doctorId: "doc-zawadzki",
    responsibleTeamId: ILONA,
    createdAt: iso(-500),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram Ads", channel: "instagram", language: "uk", clinicIntentId: "pana-comfort", at: iso(-500), sourceRecordId: "ig-lead-10111-old" })),
  },
  // New chat contact, clinic not yet triaged — no clinicId, no patient/owner
  // yet. Demonstrates the "unassigned = white card" convention out of the box.
  {
    id: "case-1012",
    patientId: undefined,
    contactIdentityId: "ci-15",
    board: "leads",
    status: "new",
    clinicId: undefined,
    responsibleTeamId: "system",
    createdAt: iso(-0.05),
    attribution: attribution(touch({ type: "first_touch", source: "Instagram DM", channel: "instagram", language: "pl", clinicIntentId: "pana-medica", at: iso(-0.05), sourceRecordId: "ig-dm-88231" })),
  },
]

export function getCase(id?: string) {
  if (!id) return undefined
  return ENGAGEMENT_CASES.find((c) => c.id === id)
}

// ---------------------------------------------------------------------------
// Tasks (§2.4) — priority P0–P4 is a Task property, never a Case tag.
// ---------------------------------------------------------------------------
export const TASKS: Task[] = [
  // Scenario 5: manual urgent escalation → P0.
  {
    id: "task-01", caseId: "case-1006", patientId: "pat-05", title: "Eskalacja: pacjentka zgłosiła reklamację",
    status: "assigned", priority: "P0", dueAt: iso(0.2), slaAt: iso(0.2), createdAt: iso(-1), ownerId: ILONA, currentWorkerId: ILONA, attempts: 1,
  },
  // Scenario 2: missed incoming Yeastar call → P1.
  {
    id: "task-02", caseId: "case-1004", title: "Oddzwoń po nieodebranym połączeniu",
    status: "ready", priority: "P1", dueAt: iso(0.05), slaAt: iso(0.1), createdAt: iso(-1.4), ownerId: WERONIKA, attempts: 1, requiresCall: true,
  },
  // Scenario 3: scheduled callback due now → P2.
  {
    id: "task-03", caseId: "case-1002", patientId: "pat-02", title: "Zadzwoń: potwierdź termin konsultacji ortodontycznej",
    status: "ready", priority: "P2", dueAt: iso(-0.1), createdAt: iso(-24), ownerId: ILONA, attempts: 1, requiresCall: true,
  },
  // Scenario 1: new Meta lead without first attempt → P3.
  {
    id: "task-04", caseId: "case-1005", patientId: "pat-04", title: "Pierwszy kontakt z nowym lead z Facebook",
    status: "planned", priority: "P3", dueAt: iso(0.5), createdAt: iso(-210), ownerId: PAVEL, attempts: 0, requiresCall: true,
  },
  {
    id: "task-05", caseId: "case-1003", patientId: "pat-03", title: "Odpowiedz na pierwszą wiadomość Instagram",
    status: "ready", priority: "P3", dueAt: iso(-0.05), createdAt: iso(-0.3), ownerId: WERONIKA, attempts: 0,
  },
  // Scenario 4: repeated unsuccessful attempt → P4.
  {
    id: "task-06", caseId: "case-1007", patientId: "pat-06", title: "Kolejna próba kontaktu — Vera Kavalchuk",
    status: "ready", priority: "P4", dueAt: iso(-0.2), createdAt: iso(-52), ownerId: ILONA, attempts: 3, requiresCall: true,
  },
  // Scenario 6: overdue task from yesterday remains visible.
  {
    id: "task-07", caseId: "case-1008", patientId: "pat-07", title: "Oddzwoń: potwierdź konsultację endodontyczną",
    status: "overdue", priority: "P1", dueAt: iso(-26), createdAt: iso(-60), ownerId: PAVEL, attempts: 2, requiresCall: true,
  },
  // Scenario 7: task due next week stays Planned, doesn't block today's queue.
  {
    id: "task-08", caseId: "case-1102", patientId: "pat-12", title: "Follow-up po wizycie — kontrola za tydzień",
    status: "planned", priority: "P4", dueAt: iso(168), createdAt: iso(-96), ownerId: PAVEL, attempts: 0,
  },
  // Scenario 8/9: unassigned lead, agent takes it and becomes assignee.
  {
    id: "task-09", caseId: "case-1004", title: "Zweryfikuj nieznany numer i utwórz kontakt",
    status: "ready", priority: "P1", dueAt: iso(-0.05), createdAt: iso(-1.4), attempts: 0,
  },
  // Scenario 10: TL overrides assignee.
  {
    id: "task-10", caseId: "case-1006", patientId: "pat-05", title: "Przygotuj plan leczenia periodontologicznego",
    status: "assigned", priority: "P2", dueAt: iso(3), createdAt: iso(-48), ownerId: DANIEL, attempts: 0,
  },
  // Scenario 26: waitlist case promoted to active callback.
  {
    id: "task-11", caseId: "case-1011", patientId: "pat-06", title: "Zaproponuj termin z listy oczekujących",
    description: "Zaproponuj termin z listy oczekujących", type: "waitlist_contact", source: "workflow", mandatory: true,
    workflowRuleId: "leads.waiting.offer-slot", status: "ready", priority: "P2", dueAt: iso(-0.4), createdAt: iso(-140), ownerId: ILONA, attempts: 1, requiresCall: true,
  },
  {
    id: "task-12", caseId: "case-1201", patientId: "pat-08", title: "Przypomnienie o wizycie jutro",
    status: "planned", priority: "P4", dueAt: iso(20), createdAt: iso(-16), ownerId: DANIEL, attempts: 0,
  },
  {
    id: "task-13", caseId: "case-1206", patientId: "pat-05", title: "Zaplanuj kontrolne RTG",
    status: "ready", priority: "P2", dueAt: iso(-1), createdAt: iso(-45), ownerId: DANIEL, attempts: 0,
  },
  {
    id: "task-14", caseId: "case-1101", patientId: "pat-04", title: "Przypomnij o wizycie protetycznej",
    status: "assigned", priority: "P2", dueAt: iso(2), createdAt: iso(-190), ownerId: PAVEL, attempts: 0,
  },
  {
    id: "task-15", caseId: "case-1010", patientId: "pat-11", title: "Skontaktuj się z nowym lead Instagram",
    status: "ready", priority: "P3", dueAt: iso(-0.6), createdAt: iso(-2.5), ownerId: WERONIKA, attempts: 0,
  },
  // Completed / cancelled / failed for history and dedup demos.
  {
    id: "task-16", caseId: "case-1001", patientId: "pat-01", title: "Zapytaj o budżet pacjenta", status: "completed",
    priority: "P4", createdAt: iso(-118), ownerId: WERONIKA, attempts: 1, outcome: "done",
  },
  {
    id: "task-17", caseId: "case-1009", title: "Kolejna próba kontaktu", status: "cancelled",
    priority: "P4", createdAt: iso(-70), ownerId: WERONIKA, attempts: 2, outcome: "wrong_number", skipReason: "Pani poprosiła nie dzwonić ponownie",
  },
  {
    id: "task-18", caseId: "case-1105", patientId: "pat-10", title: "Kontakt po no-show", status: "failed",
    priority: "P1", createdAt: iso(-300), ownerId: PAVEL, attempts: 4, outcome: "not_reached",
  },
  // Unassigned chat draft: needs a reply AND a clinic before it can route anywhere.
  {
    id: "task-19", caseId: "case-1012", title: "Odpowiedz na nową wiadomość i przypisz klinikę",
    status: "ready", priority: "P3", dueAt: iso(0.2), createdAt: iso(-0.05), attempts: 0,
  },
]

export function getTasksForCase(caseId: string) {
  return TASKS.filter((t) => t.caseId === caseId)
}

export function getTask(id?: string) {
  if (!id) return undefined
  return TASKS.find((t) => t.id === id)
}

// ---------------------------------------------------------------------------
// Interactions & Calls (§2.5 / §2.6)
// ---------------------------------------------------------------------------
export const INTERACTIONS: (Interaction | Call | SmsMessage)[] = [
  {
    id: "int-01", caseId: "case-1001", patientId: "pat-01", type: "note", at: iso(-2), authorId: WERONIKA,
    text: "Rozmowa z pacjentką, kwestia finansowa — zaproponować raty.",
  },
  // Scenario 19: call answered and appointment scheduled.
  {
    id: "int-02", caseId: "case-1101", patientId: "pat-04", taskId: "task-14", type: "call", direction: "outgoing",
    at: iso(-190), authorId: PAVEL, extension: "102", clinicId: "pana-comfort", telcoStatus: "answered",
    disposition: "appointment_scheduled", startAt: iso(-190), answerAt: iso(-189.98), endAt: iso(-189.9),
    talkTimeSec: 260, ringTimeSec: 12, totalDurationSec: 272, recordingState: "available", attemptsToday: 1, isFinalCdr: true,
  } as Call,
  // Scenario 2/17: missed incoming Yeastar call opens known/unknown patient.
  {
    id: "int-03", caseId: "case-1004", type: "call", direction: "incoming", at: iso(-1.4),
    extension: "101", clinicId: "pana-medica", telcoStatus: "missed", startAt: iso(-1.4), recordingState: "none",
    attemptsToday: 1, isFinalCdr: true,
  } as Call,
  // Scenario 20: no answer forces due-date extension.
  {
    id: "int-04", caseId: "case-1008", patientId: "pat-07", taskId: "task-07", type: "call", direction: "outgoing",
    at: iso(-26), authorId: PAVEL, extension: "103", clinicId: "pana-medica", telcoStatus: "missed",
    disposition: "no_answer", startAt: iso(-26), endAt: iso(-25.98), totalDurationSec: 35, ringTimeSec: 35,
    recordingState: "none", attemptsToday: 2, isFinalCdr: true,
  } as Call,
  // Scenario 21: call later requires date/time.
  {
    id: "int-05", caseId: "case-1001", patientId: "pat-01", type: "call", direction: "outgoing", at: iso(-30),
    authorId: WERONIKA, extension: "101", clinicId: "pana-medica", telcoStatus: "answered", disposition: "call_later",
    startAt: iso(-30), answerAt: iso(-29.99), endAt: iso(-29.85), talkTimeSec: 252, totalDurationSec: 260,
    recordingState: "available", attemptsToday: 1, isFinalCdr: true,
  } as Call,
  // Scenario 22: wrong number terminal outcome.
  {
    id: "int-06", caseId: "case-1009", type: "call", direction: "outgoing", at: iso(-70), authorId: WERONIKA,
    extension: "101", clinicId: "pana-medica", telcoStatus: "answered", disposition: "wrong_number",
    startAt: iso(-70), answerAt: iso(-69.99), endAt: iso(-69.98), talkTimeSec: 20, totalDurationSec: 30,
    recordingState: "available", attemptsToday: 1, isFinalCdr: true,
  } as Call,
  {
    id: "int-07", caseId: "case-1002", patientId: "pat-02", type: "chat", direction: "incoming", at: iso(-3),
    text: "Dzień dobry, potwierdzam zapis na konsultację.",
  },
  {
    id: "int-08", caseId: "case-1007", patientId: "pat-06", type: "call", direction: "outgoing", at: iso(-40),
    authorId: ILONA, extension: "102", clinicId: "pana-medica", telcoStatus: "missed", disposition: "no_answer",
    startAt: iso(-40), totalDurationSec: 0, ringTimeSec: 28, recordingState: "none", attemptsToday: 2, isFinalCdr: true,
  } as Call,
  // Scenario 35 support: preliminary realtime event vs final CDR distinction.
  {
    id: "int-09", caseId: "case-1006", patientId: "pat-05", type: "call", direction: "incoming", at: iso(-0.02),
    extension: "104", clinicId: "pana-comfort", telcoStatus: "ringing", startAt: iso(-0.02), recordingState: "none",
    attemptsToday: 1, isFinalCdr: false,
  } as Call,
  {
    id: "int-10", caseId: "case-1201", patientId: "pat-08", type: "whatsapp", direction: "outgoing", at: iso(-16),
    authorId: DANIEL, text: "Potwierdzamy wizytę na konsultację ogólną.",
  },
  // New unassigned chat draft (case-1012) — the lead-from-chat scenario.
  {
    id: "int-11", caseId: "case-1012", type: "chat", direction: "incoming", at: iso(-0.05),
    contactIdentityId: "ci-15", channel: "instagram",
    text: "Cześć! Piszę pierwszy raz, chciałabym zapytać o ceny wybielania zębów 🦷",
  },
  {
    id: "int-12", caseId: "case-1012", type: "social", channel: "instagram", direction: "outgoing", at: iso(-0.04),
    contactIdentityId: "ci-15", authorId: "bot-pana", senderKind: "bot",
    text: "Cześć! Jestem wirtualnym asystentem kliniki. Mogę przekazać aktualne informacje organizacyjne o wybielaniu i połączyć Cię z konsultantem.",
    aiTrace: {
      runId: "ai-run-demo-1012", modelProvider: "demo", modelName: "kb-assistant", modelVersion: "prototype-1",
      policyId: "ai-policy-global-v1", policyVersion: 1, promptTemplateId: "administrative-chat", promptTemplateVersion: 1,
      generatedAt: iso(-0.04), inputInteractionIds: ["int-11"], userDisclosureShown: true, confidence: 0.91,
      citations: [{ sourceId: "kb-procedure-whitening", sourceTitle: "Wybielanie zębów — informacje organizacyjne",
        sourceVersion: "2026-09-15", section: "Zakres konsultacji", chunkId: "chunk-04", retrievedAt: iso(-0.041), relevance: 0.94 }],
    },
  },
  {
    id: "sms-01", caseId: "case-1001", patientId: "pat-01", type: "sms", channel: "phone", direction: "outgoing",
    at: iso(-20), authorId: WERONIKA, text: "Dzień dobry, przypominamy o kontakcie w sprawie planu leczenia.",
    recipient: "+48 611 924 357", sender: BRAND_CONFIG.smsSenderName, providerType: "emulator", providerConfigurationId: "sms-pm-emulator",
    providerMessageId: "emulator-sms-01", deliveryStatus: "delivered", providerStatus: "DELIVERED", partsCount: 1,
    submittedAt: iso(-20), deliveredAt: iso(-19.99),
  } as SmsMessage,
  {
    id: "sms-02", caseId: "case-1101", patientId: "pat-04", type: "sms", channel: "phone", direction: "outgoing",
    at: iso(-12), authorId: PAVEL, text: "Potwierdzamy termin konsultacji. W razie potrzeby prosimy o kontakt.",
    recipient: "+48 500 440 211", sender: "+48 61 000 00 02", providerType: "supervoip", providerConfigurationId: "sms-pc-supervoip",
    providerMessageId: "supervoip-sms-02", deliveryStatus: "submitted", providerStatus: "ACCEPTED", partsCount: 1,
    submittedAt: iso(-12),
  } as SmsMessage,
  {
    id: "sms-demo-incoming", patientId: "pat-01", clinicId: "pana-medica", type: "sms", channel: "phone", direction: "incoming",
    at: iso(-2), text: "Dziękuję za wiadomość. Skontaktuję się z recepcją. (demo)",
    recipient: BRAND_CONFIG.smsSenderName, sender: "+48 611 924 357", providerType: "emulator", providerConfigurationId: "sms-pm-emulator",
    providerMessageId: "demo-incoming-01", deliveryStatus: "received", partsCount: 1,
  } as SmsMessage,

]

export function getInteractionsForCase(caseId: string) {
  return INTERACTIONS.filter((i) => i.caseId === caseId)
}

// ---------------------------------------------------------------------------
// Comments (§2.7, human) — kept fully separate from Audit Events.
// ---------------------------------------------------------------------------
export const COMMENTS: Comment[] = [
  { id: "cm-01", caseId: "case-1001", authorId: WERONIKA, at: iso(-2), text: "Trzeba zadzwonić 30.09, zaproponować raty — pacjentka jest czuła na cenę.", pinned: true },
  { id: "cm-02", caseId: "case-1006", authorId: ILONA, at: iso(-1), text: "@Daniel Wozniak pacjentka jest zniecierpliwiona czekaniem — możemy przyspieszyć?", mentions: [DANIEL] },
  { id: "cm-03", caseId: "case-1101", authorId: PAVEL, at: iso(-188), text: "Zapisano na protetykę, dokumenty potwierdzone." },
  { id: "cm-04", caseId: "case-1008", authorId: PAVEL, at: iso(-25), text: "Nie odpowiada drugi dzień, próbujemy inny kanał." , edited: true },
  { id: "cm-05", caseId: "case-1201", authorId: DANIEL, at: iso(-15), text: "Potwierdziłem wizytę przez WhatsApp, pacjent jest gotowy." },
]

export function getCommentsForCase(caseId: string) {
  return COMMENTS.filter((c) => c.caseId === caseId)
}

// ---------------------------------------------------------------------------
// Audit Events (§2.7, system) — repeated low-level events pre-collapsed.
// ---------------------------------------------------------------------------
export const AUDIT_EVENTS: AuditEvent[] = [
  { id: "ae-01", caseId: "case-1001", type: "status_change", actorId: WERONIKA, at: iso(-1), summary: "Status zmieniony", before: "Qualification", after: "Call Later", correlationId: "corr-1001-1" },
  // Scenario 9: agent starts work and becomes assignee.
  { id: "ae-02", caseId: "case-1004", type: "assignment_change", actorId: WERONIKA, at: iso(-1.35), summary: "Przypisano po rozpoczęciu obsługi", before: "Nieprzypisane", after: "Weronika Sadowska" },
  // Scenario 10: TL overrides assignee.
  { id: "ae-03", caseId: "case-1006", type: "assignment_change", actorId: DANIEL, at: iso(-0.9), summary: "Team Leader zmienił przypisanie", before: "Ilona Marchenko", after: "Daniel Wozniak" },
  // Scenario 29: duplicate technical events collapsed into one audit row.
  { id: "ae-04", caseId: "case-1007", type: "task_change", actorId: ILONA, at: iso(-40), summary: "Zaktualizowano kolejność kolumn kanban", occurrences: 6 },
  { id: "ae-05", patientId: "pat-04", type: "merge", actorId: DANIEL, at: iso(-190), summary: "Połączono kontakt e-mail z pacjentem po dopasowaniu numeru telefonu", before: "ci-04b (niepowiązany)", after: "pat-04" },
  { id: "ae-06", patientId: "pat-05", type: "sync", actorId: WERONIKA, at: iso(-1), summary: "Wykryto konflikt danych z Medical CRM (nazwisko)" },
  { id: "ae-06b", caseId: "case-1006", type: "priority_change", actorId: WERONIKA, at: iso(-1), summary: "Eskalacja P0 utworzona ręcznie", before: "P2", after: "P0" },
  { id: "ae-07", caseId: "case-1008", type: "sync", actorId: PAVEL, at: iso(-30), summary: "Synchronizacja z Medical CRM nie powiodła się — dane lokalne pozostają dostępne" },
  { id: "ae-08", caseId: "case-1005", type: "status_change", actorId: PAVEL, at: iso(-190), summary: "Lead przekształcony w Deal", before: "Converted to Deal", after: "Appointment Scheduled" },
  { id: "ae-09", caseId: "case-1011", type: "priority_change", actorId: ILONA, at: iso(-0.4), summary: "Sprawa z listy oczekujących przeniesiona do aktywnego callbacku", before: "Waiting List", after: "P2" },
]

export function getAuditForCase(caseId: string) {
  return AUDIT_EVENTS.filter((a) => a.caseId === caseId)
}

// ---------------------------------------------------------------------------
// Realtime agent presence (§3 Team Leader, §7.8, scenario 35).
// ---------------------------------------------------------------------------
export const AGENT_PRESENCE: AgentPresence[] = [
  { operatorId: WERONIKA, availability: "on_call", currentCaseId: "case-1004", clinicId: "pana-medica", sinceAt: iso(-0.1) },
  { operatorId: ILONA, availability: "messages", currentCaseId: "case-1006", clinicId: "pana-comfort", sinceAt: iso(-0.3) },
  { operatorId: PAVEL, availability: "available", clinicId: "pana-comfort", sinceAt: iso(-0.5) },
  { operatorId: DANIEL, availability: "break", clinicId: "pana-international", sinceAt: iso(-0.2) },
  { operatorId: ALEH, availability: "offline", sinceAt: iso(-6) },
]

// ---------------------------------------------------------------------------
// SMS broadcasts (notification campaigns) — history seed.
// ---------------------------------------------------------------------------
export const BROADCASTS: Broadcast[] = [
  {
    id: "bc-01",
    name: "Przypomnienie o wizytach kontrolnych — wrzesień",
    channel: "sms",
    message: "Cześć {{imię}}! Przypominamy o kontrolnej wizycie w naszej klinice. Odpowiedz TAK, aby potwierdzić.",
    audienceLabel: `${BRAND_CONFIG.clinicNames["pana-medica"]} · sprawy Patient Care`,
    clinicId: "pana-medica",
    recipientCount: 42,
    status: "sent",
    sentAt: iso(-72),
    createdBy: DANIEL,
  },
  {
    id: "bc-02",
    name: "Lista oczekujących — wolny termin implantologia",
    channel: "sms",
    message: "Dzień dobry {{imię}}, zwolnił się termin u dr. Yanushkevich. Zadzwoń, aby zarezerwować.",
    audienceLabel: `${BRAND_CONFIG.clinicNames["pana-medica"]} · lista oczekujących`,
    clinicId: "pana-medica",
    recipientCount: 6,
    status: "sent",
    sentAt: iso(-140),
    createdBy: ILONA,
  },
]
