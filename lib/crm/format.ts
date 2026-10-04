export function formatRelative(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  const abs = Math.abs(diffMin)

  const past = diffMin <= 0

  let label: string
  if (abs < 60) label = `${Math.max(abs, 1)} min`
  else if (abs < 60 * 24) label = `${Math.round(abs / 60)} godz.`
  else label = `${Math.round(abs / (60 * 24))} dni`

  return past ? `${label} temu` : `za ${label}`
}

// Locale and timeZone are pinned explicitly (not `undefined`) so the server
// render and the client hydration always produce the identical string —
// `undefined` falls back to each runtime's own default locale/timeZone,
// which differs between the Node server and the browser and causes
// hydration mismatches.
export const CLINIC_TIME_ZONE = "Europe/Warsaw"

export function formatDateTime(iso: string, timeZone = CLINIC_TIME_ZONE, locale = "pl-PL") {
  const d = new Date(iso)
  return d.toLocaleString(locale, {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Pilne",
  high: "Wysoki",
  normal: "Zwykły",
  low: "Niski",
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

export const QUALIFICATION_LABEL: Record<string, string> = {
  qualified: "Zakwalifikowany",
  unqualified: "Niezakwalifikowany",
  undefined: "Nieokreślony",
}
