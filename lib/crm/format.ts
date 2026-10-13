import type { Language } from "./language-context"

const RELATIVE_UNITS: Record<Language, { min: string; hour: string; day: string; past: (label: string) => string; future: (label: string) => string }> = {
  en: { min: "min", hour: "h", day: "d", past: (label) => `${label} ago`, future: (label) => `in ${label}` },
  pl: { min: "min", hour: "godz.", day: "dni", past: (label) => `${label} temu`, future: (label) => `za ${label}` },
  ru: { min: "мин", hour: "ч", day: "дн.", past: (label) => `${label} назад`, future: (label) => `через ${label}` },
  es: { min: "min", hour: "h", day: "d", past: (label) => `hace ${label}`, future: (label) => `en ${label}` },
}

export function formatRelative(iso: string, language: Language = "en") {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  const abs = Math.abs(diffMin)
  const units = RELATIVE_UNITS[language]

  let label: string
  if (abs < 60) label = `${Math.max(abs, 1)} ${units.min}`
  else if (abs < 60 * 24) label = `${Math.round(abs / 60)} ${units.hour}`
  else label = `${Math.round(abs / (60 * 24))} ${units.day}`

  return diffMin <= 0 ? units.past(label) : units.future(label)
}

// Locale and timeZone are pinned explicitly (not `undefined`) so the server
// render and the client hydration always produce the identical string —
// `undefined` falls back to each runtime's own default locale/timeZone,
// which differs between the Node server and the browser and causes
// hydration mismatches.
export const CLINIC_TIME_ZONE = "Europe/Warsaw"

export function formatDateTime(iso: string, timeZone = CLINIC_TIME_ZONE, locale = "en-GB") {
  const d = new Date(iso)
  return d.toLocaleString(locale, {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const PRIORITY_CLASS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-slate-100 text-slate-600 border-slate-200",
  low: "bg-slate-50 text-slate-500 border-slate-200",
}

export const QUALIFICATION_CLASS: Record<string, string> = {
  qualified: "bg-emerald-100 text-emerald-700 border-emerald-200",
  unqualified: "bg-red-100 text-red-700 border-red-200",
  undefined: "bg-amber-100 text-amber-700 border-amber-200",
}

export const QUALIFICATION_LABEL: Record<string, Record<Language, string>> = {
  qualified: { en: "Qualified", pl: "Zakwalifikowany", ru: "Квалифицирован", es: "Calificado" },
  unqualified: { en: "Not qualified", pl: "Niezakwalifikowany", ru: "Не квалифицирован", es: "No calificado" },
  undefined: { en: "Undetermined", pl: "Nieokreślony", ru: "Не определено", es: "Sin determinar" },
}
