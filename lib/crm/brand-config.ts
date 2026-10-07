/**
 * Single source of truth for white-label branding.
 *
 * Change the values below (or set the NEXT_PUBLIC_BRAND_* environment variables)
 * to rebrand the whole system: product name, colour theme, bot name, SMS sender,
 * clinic display names and contact domain. Nothing else in the UI hardcodes a
 * customer name.
 *
 * Colour themes are defined in app/globals.css as `[data-theme="<id>"]` hue
 * presets. `BRAND_THEME_IDS` must stay in sync with those selectors.
 */

export const BRAND_THEME_IDS = ["green", "blue", "violet", "slate", "rose"] as const
export type BrandThemeId = (typeof BRAND_THEME_IDS)[number]

export const DEFAULT_BRAND_THEME: BrandThemeId = "green"

export function resolveBrandTheme(value?: string | null): BrandThemeId {
  const normalized = value?.trim().toLowerCase()
  return BRAND_THEME_IDS.find((id) => id === normalized) ?? DEFAULT_BRAND_THEME
}

// Each NEXT_PUBLIC_* variable must be written out literally inside its thunk so Next.js can
// inline it into the client bundle. The try/catch keeps non-Node runtimes (test sandbox) working.
function readEnv(read: () => string | undefined) {
  try {
    return read()
  } catch {
    return undefined
  }
}

function readText(read: () => string | undefined, fallback: string) {
  const trimmed = readEnv(read)?.trim()
  return trimmed ? trimmed : fallback
}

const appName = readText(() => process.env.NEXT_PUBLIC_BRAND_NAME, "Clinic CRM")

export const BRAND_CONFIG = {
  /** Product name shown in the sidebar, browser tab and metadata. */
  appName,
  appDescription: `Operator workspace prototype for ${appName}`,
  /** Colour theme id; one of BRAND_THEME_IDS. */
  theme: resolveBrandTheme(readEnv(() => process.env.NEXT_PUBLIC_BRAND_THEME)),
  /** Default name of the AI assistant shown to patients. */
  botName: readText(() => process.env.NEXT_PUBLIC_BRAND_BOT_NAME, "Asystent AI"),
  /** Alphanumeric SMS sender name (max 11 characters for most providers). */
  smsSenderName: readText(() => process.env.NEXT_PUBLIC_BRAND_SMS_SENDER, "Clinic"),
  /** Host used for demo user e-mails and the website knowledge source. */
  contactDomain: readText(() => process.env.NEXT_PUBLIC_BRAND_DOMAIN, "clinic.example"),
  /** Legal controller label shown in AI compliance drafts. */
  controllerName: readText(() => process.env.NEXT_PUBLIC_BRAND_CONTROLLER, "Administrator danych — do zatwierdzenia przez DPO"),
  privacyNoticeUrl: readText(() => process.env.NEXT_PUBLIC_BRAND_PRIVACY_URL, "https://clinic.example/privacy"),
  /** Display names per clinic id. Ids are internal and stay stable. */
  clinicNames: {
    "pana-medica": "Clinic A",
    "pana-comfort": "Clinic B",
    "pana-international": "Clinic C",
  },
} as const

export type BrandedClinicId = keyof typeof BRAND_CONFIG.clinicNames
