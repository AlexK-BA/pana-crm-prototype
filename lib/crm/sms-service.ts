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
    defaultMessageText: "Dzień dobry, tu PaNa Medica. Prosimy o kontakt z recepcją. Dziękujemy!",
    mode: "emulation",
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
    defaultMessageText: "Dzień dobry, tu PaNa Comfort. Prosimy o kontakt z recepcją. Dziękujemy!",
    mode: "emulation",
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
    defaultMessageText: "Dzień dobry, prosimy o kontakt z recepcją. Dziękujemy!",
    mode: "emulation",
    capabilities: SMSAPI_CAPABILITIES,
  },
]

export function selectSmsProvider(configs: SmsProviderConfiguration[], clinicId?: ClinicId) {
  return (clinicId ? configs.find((item) => item.enabled && item.clinicId === clinicId) : undefined)
    ?? configs.find((item) => item.enabled && !item.clinicId && item.isDefault)
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
    sent: "Wysłano",
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

export function getDefaultSmsText(configs: SmsProviderConfiguration[], clinicId?: ClinicId) {
  const provider = selectSmsProvider(configs, clinicId)
  return provider?.defaultMessageText.trim()
    || configs.find((config) => !config.clinicId && config.isDefault)?.defaultMessageText.trim()
    || "Dzień dobry, prosimy o kontakt z recepcją. Dziękujemy!"
}

/** Adapter events update the existing Interaction; adapters never own message state. */
export type SmsTransition = Pick<SmsMessage, "deliveryStatus"> & Partial<Pick<SmsMessage,
  "providerMessageId" | "providerStatus" | "errorMessage" | "submittedAt" | "deliveredAt">>

export interface SmsAdapter {
  validateConfiguration: (config?: SmsProviderConfiguration) => string | undefined
  normalizeRecipient: (phone: string) => string | undefined
  send: (message: SmsMessage, config: SmsProviderConfiguration | undefined,
    options: { simulateError: boolean; signal: AbortSignal }, onTransition: (event: SmsTransition) => void) => Promise<void>
  test: (config: SmsProviderConfiguration) => { status: "success" | "failed"; error?: string }
}

function waitForEmulation(ms: number, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) return resolve(false)
    const finish = (completed: boolean) => {
      clearTimeout(timer)
      signal.removeEventListener("abort", abort)
      resolve(completed)
    }
    const abort = () => finish(false)
    const timer = setTimeout(() => finish(true), ms)
    signal.addEventListener("abort", abort, { once: true })
  })
}

/** No provider API, credentials, automatic replies or random failures in Stage 1. */
export const emulatedSmsAdapter: SmsAdapter = {
  validateConfiguration: (config) => !config?.enabled || !config.capabilities.outboundSms
    ? "Brak aktywnej konfiguracji SMS dla kliniki."
    : config.mode !== "emulation" ? "Prototyp obsługuje wyłącznie emulację." : undefined,
  normalizeRecipient: (phone) => {
    const normalized = phone.replace(/[\s()-]/g, "")
    return /^\+?[1-9]\d{7,14}$/.test(normalized) ? normalized : undefined
  },
  async send(message, config, options, onTransition) {
    if (!await waitForEmulation(700, options.signal)) return
    const configurationError = this.validateConfiguration(config)
    const error = configurationError || (options.simulateError ? "Wymuszony błąd demo/test (UAT)." : undefined)
    if (error) {
      onTransition({ deliveryStatus: "failed", providerStatus: configurationError ? "CONFIGURATION_MISSING" : "DEMO_FAILURE", errorMessage: error })
      return
    }
    onTransition({ deliveryStatus: "sent", providerStatus: "EMULATED_SENT",
      providerMessageId: `demo-${message.id}`, submittedAt: new Date().toISOString() })
    // This receipt belongs to the emulator, not an assertion about a real provider's capabilities.
    if (!await waitForEmulation(1100, options.signal)) return
    onTransition({ deliveryStatus: "delivered", providerStatus: "EMULATED_DELIVERED", deliveredAt: new Date().toISOString() })
  },
  test(config) {
    const error = this.validateConfiguration(config)
    return { status: error ? "failed" : "success", error }
  },
}
