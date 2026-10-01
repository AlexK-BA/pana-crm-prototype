import type { ClinicId, SmsMessage, SmsProviderCapabilities, SmsProviderConfiguration } from "./entities"

const EMULATOR_CAPABILITIES: SmsProviderCapabilities = {
  outboundSms: true,
  inboundSms: true,
  deliveryReports: true,
  senderName: true,
  ownedSenderNumber: true,
  twoWayMessaging: true,
  multipartMessages: true,
  unicodeMessages: true,
}

const SMSAPI_CAPABILITIES: SmsProviderCapabilities = {
  outboundSms: true,
  inboundSms: true,
  deliveryReports: true,
  senderName: true,
  ownedSenderNumber: true,
  twoWayMessaging: true,
  multipartMessages: true,
  unicodeMessages: true,
}

const SUPERVOIP_CAPABILITIES: SmsProviderCapabilities = {
  outboundSms: true,
  inboundSms: true,
  deliveryReports: false,
  senderName: true,
  ownedSenderNumber: true,
  twoWayMessaging: true,
  multipartMessages: true,
  unicodeMessages: true,
}

export function getSmsProviderCapabilities(provider: SmsProviderConfiguration["providerType"]) {
  if (provider === "smsapi") return SMSAPI_CAPABILITIES
  if (provider === "supervoip") return SUPERVOIP_CAPABILITIES
  return EMULATOR_CAPABILITIES
}

export const INITIAL_SMS_PROVIDER_CONFIGS: SmsProviderConfiguration[] = [
  {
    id: "sms-pm-emulator",
    name: "PaNa Medica · SMS emulator",
    providerType: "emulator",
    clinicId: "pana-medica",
    enabled: true,
    senderMode: "sender_name",
    senderValue: "PaNaMedica",
    capabilities: EMULATOR_CAPABILITIES,
  },
  {
    id: "sms-pc-supervoip",
    name: "PaNa Comfort · SuperVoIP",
    providerType: "supervoip",
    clinicId: "pana-comfort",
    enabled: true,
    senderMode: "owned_number",
    senderValue: "+48 61 000 00 02",
    inboundNumber: "+48 61 000 00 02",
    capabilities: SUPERVOIP_CAPABILITIES,
  },
  {
    id: "sms-global-smsapi",
    name: "Domyślna konfiguracja · SMSAPI",
    providerType: "smsapi",
    enabled: true,
    isDefault: true,
    senderMode: "sender_name",
    senderValue: "PaNa",
    capabilities: SMSAPI_CAPABILITIES,
  },
]

export function selectSmsProvider(configs: SmsProviderConfiguration[], clinicId?: ClinicId) {
  return configs.find((item) => item.enabled && item.clinicId === clinicId)
    ?? configs.find((item) => item.enabled && item.isDefault)
    ?? configs.find((item) => item.enabled)
}

export function calculateSmsParts(text: string) {
  const usesUnicode = /[^\u0000-\u007f]/.test(text)
  const singleLimit = usesUnicode ? 70 : 160
  const multipartLimit = usesUnicode ? 67 : 153
  if (text.length <= singleLimit) return 1
  return Math.ceil(text.length / multipartLimit)
}

export function getSmsStatusLabel(message: Pick<SmsMessage, "deliveryStatus" | "providerType">) {
  const labels = {
    queued: "W kolejce",
    submitted: message.providerType === "supervoip" ? "Przyjęto przez operatora" : "Wysłano",
    delivered: "Dostarczono",
    failed: "Błąd wysyłki",
    undelivered: "Niedostarczono",
    received: "Odebrano",
    unknown: "Status nieznany",
  }
  return labels[message.deliveryStatus]
}

export function isSmsMessage(value: { type: string }): value is SmsMessage {
  return value.type === "sms" && "deliveryStatus" in value
}
