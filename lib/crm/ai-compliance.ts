import type { AiComplianceConfiguration, AiComplianceLocaleContent, AiConversationPolicy, ClinicId } from "./entities"
import { AccessCommandError } from "./permissions"
import { BRAND_CONFIG } from "./brand-config"

export const INITIAL_AI_COMPLIANCE_CONFIGURATIONS: AiComplianceConfiguration[] = [{
  id: "ai-compliance-global-draft-v1",
  name: "Globalna informacja AI i prywatność",
  status: "draft",
  version: 1,
  botPolicyId: "ai-policy-global-v1",
  botPolicyVersion: 1,
  controllerName: BRAND_CONFIG.controllerName,
  privacyContact: "Do uzupełnienia i zatwierdzenia przez DPO",
  privacyNoticeUrl: BRAND_CONFIG.privacyNoticeUrl,
  modelProviderStatement: "Do uzupełnienia po wyborze dostawcy i zatwierdzeniu warunków przetwarzania.",
  locales: [{
    language: "pl",
    aiDisclosure: "Rozmawiasz z wirtualnym asystentem. W każdej chwili możesz poprosić o kontakt z człowiekiem.",
    purpose: "Administracyjna obsługa zapytań, przekazanie informacji o klinice oraz wsparcie umawiania wizyt.",
    dataCategories: "Dane kontaktowe, treść wiadomości oraz dane potrzebne do obsługi zgłoszenia.",
    specialCategoryData: "Nie podawaj danych medycznych w rozmowie z botem. Pytania medyczne są przekazywane pracownikowi.",
    legalBasisSummary: "Do zatwierdzenia przez DPO przed publikacją.",
    retentionStatement: "Do zatwierdzenia przez DPO przed publikacją.",
    processorAndTransferStatement: "Do zatwierdzenia po wyborze dostawców i lokalizacji przetwarzania.",
    rightsStatement: "Informacje o prawach osoby należy zatwierdzić z DPO przed publikacją.",
    humanContactStatement: "Napisz, że chcesz porozmawiać z człowiekiem, aby przekazać rozmowę operatorowi.",
  }],
  updatedAt: "2026-10-03T00:00:00.000Z",
  updatedBy: "system",
}]

export function validateAiComplianceConfiguration(config: AiComplianceConfiguration, policies: AiConversationPolicy[]) {
  if (!config.id.trim() || !config.name.trim()) throw new AccessCommandError("Konfiguracja zgodności wymaga ID i nazwy.")
  const policy = policies.find(item => item.id === config.botPolicyId && item.version === config.botPolicyVersion)
  if (!policy) throw new AccessCommandError("Konfiguracja zgodności musi wskazywać istniejącą wersję polityki bota.")
  if (!config.controllerName.trim() || !config.privacyContact.trim() || !config.privacyNoticeUrl.trim()) throw new AccessCommandError("Uzupełnij administratora danych, kontakt prywatności i adres polityki.")
  if (!/^https:\/\/[^\s]+$/i.test(config.privacyNoticeUrl)) throw new AccessCommandError("Adres polityki prywatności musi być poprawnym adresem HTTPS.")
  if (!config.locales.length) throw new AccessCommandError("Dodaj co najmniej jedną wersję językową.")
  const languages = new Set<string>()
  for (const locale of config.locales) {
    if (!locale.language.trim() || languages.has(locale.language)) throw new AccessCommandError("Wersje językowe muszą mieć unikalny kod języka.")
    languages.add(locale.language)
    for (const [field, value] of Object.entries(locale)) if (field !== "language" && !value.trim()) throw new AccessCommandError(`Uzupełnij pole ${field} dla języka ${locale.language}.`)
  }
  if (config.status === "published" && (!config.approvalReference?.trim() || !config.approvedBy?.trim() || !config.publishedAt)) {
    throw new AccessCommandError("Publikacja wymaga referencji zatwierdzenia, osoby zatwierdzającej i daty publikacji.")
  }
  return policy
}

export function resolvePublishedAiCompliance(configs: AiComplianceConfiguration[], clinicId?: ClinicId) {
  const published = configs.filter(item => item.status === "published")
  return published.filter(item => item.clinicId === clinicId).sort((a, b) => b.version - a.version)[0]
    ?? published.filter(item => !item.clinicId).sort((a, b) => b.version - a.version)[0]
}

export function renderPatientTransparencyNotice(
  config: AiComplianceConfiguration,
  policy: AiConversationPolicy,
  language: string,
) {
  if (config.status !== "published") throw new AccessCommandError("Pacjentowi można wyświetlić wyłącznie opublikowaną konfigurację zgodności.")
  if (config.botPolicyId !== policy.id || config.botPolicyVersion !== policy.version) throw new AccessCommandError("Opublikowana informacja nie odpowiada aktywnej wersji polityki bota.")
  const locale = config.locales.find(item => item.language === language) ?? config.locales.find(item => item.language === "pl") ?? config.locales[0]
  return renderLocale(config, policy, locale)
}

function renderLocale(config: AiComplianceConfiguration, policy: AiConversationPolicy, locale: AiComplianceLocaleContent) {
  return [
    locale.aiDisclosure,
    `Cel: ${locale.purpose}`,
    `Zakres danych: ${locale.dataCategories}`,
    `Dane szczególnej kategorii: ${locale.specialCategoryData}`,
    `Podstawa przetwarzania: ${locale.legalBasisSummary}`,
    `Retencja: ${locale.retentionStatement}`,
    `Dostawcy i transfery: ${locale.processorAndTransferStatement}`,
    `Twoje prawa: ${locale.rightsStatement}`,
    `Kontakt z człowiekiem: ${locale.humanContactStatement}`,
    `Administrator danych: ${config.controllerName}; kontakt: ${config.privacyContact}; polityka: ${config.privacyNoticeUrl}`,
    `System AI: ${config.modelProviderStatement}`,
    `Dozwolone użycie: ${policy.intendedUse}; polityka ${policy.id} v${policy.version}; informacja v${config.version}.`,
  ].join("\n\n")
}

const PLACEHOLDER_PATTERN = /do uzupełnienia|do zatwierdzenia|po wyborze/i

/** Draft-only preview for administrators. It is never shown to patients. */
export function previewDraftTransparencyNotice(config: AiComplianceConfiguration, policy: AiConversationPolicy, language: string) {
  const locale = config.locales.find(item => item.language === language) ?? config.locales[0]
  return renderLocale(config, policy, locale)
}

export interface ComplianceReadinessItem { id: string; ok: boolean; label: string }

export function assessComplianceReadiness(config: AiComplianceConfiguration, policies: AiConversationPolicy[]): ComplianceReadinessItem[] {
  const policy = policies.find(item => item.id === config.botPolicyId && item.version === config.botPolicyVersion)
  const texts = [config.controllerName, config.privacyContact, config.modelProviderStatement, ...config.locales.flatMap(locale => Object.entries(locale).filter(([key]) => key !== "language").map(([, value]) => value))]
  return [
    { id: "policy", ok: Boolean(policy), label: "Wersja polityki bota istnieje" },
    { id: "https", ok: /^https:\/\//i.test(config.privacyNoticeUrl), label: "Adres polityki prywatności (HTTPS)" },
    { id: "placeholders", ok: !texts.some(text => PLACEHOLDER_PATTERN.test(text)), label: "Brak tekstów zastępczych do uzupełnienia" },
    { id: "languages", ok: config.locales.some(item => item.language === "pl"), label: "Wersja PL" },
    { id: "approval", ok: Boolean(config.approvalReference?.trim() && config.approvedBy?.trim()), label: "Zatwierdzenie DPO (referencja i osoba)" },
  ]
}
