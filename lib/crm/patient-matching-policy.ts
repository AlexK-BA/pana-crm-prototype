/** One configurable policy; no provider, tenant or UI-specific confidence constants. */
export const PATIENT_MATCH_POLICY = {
  autoLinkThreshold: 0.95,
  confidence: { externalPatientId: 1, pesel: 0.98, verifiedContact: 0.95, unverifiedContact: 0.85, name: 0.35 },
  corroborationBoost: 0.01,
  nameBoost: 0.005,
  clinicBoost: 0.005,
  corroboratedMaximum: 0.99,
  defaultPhoneCountryCode: "48",
  localPhoneDigits: 9,
} as const
