import type { Clinic, ClinicId, Doctor, Procedure } from "./entities"
import { BRAND_CONFIG } from "./brand-config"

export const CLINICS: Clinic[] = [
  { id: "pana-medica", name: BRAND_CONFIG.clinicNames["pana-medica"], color: "emerald" },
  { id: "pana-comfort", name: BRAND_CONFIG.clinicNames["pana-comfort"], color: "amber" },
  { id: "pana-international", name: BRAND_CONFIG.clinicNames["pana-international"], color: "sky" },
]

export function getClinic(id?: string) {
  if (!id) return undefined
  return CLINICS.find((c) => c.id === id)
}

/**
 * Visual identity per clinic, applied consistently everywhere a case/patient
 * card renders: first clinic → green, second → beige/amber, third → blue. Cases with no clinic assigned yet fall back to
 * UNASSIGNED_TONE (plain white/neutral) via getClinicTone.
 */
export const CLINIC_TONE: Record<Clinic["color"], { bar: string; chip: string; dot: string; soft: string }> = {
  emerald: { bar: "bg-emerald-500", chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", soft: "bg-emerald-50/50" },
  amber: { bar: "bg-amber-500", chip: "border-amber-300 bg-amber-100 text-amber-900", dot: "bg-amber-500", soft: "bg-amber-50/50" },
  sky: { bar: "bg-sky-500", chip: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500", soft: "bg-sky-50/50" },
}

export const UNASSIGNED_TONE = {
  bar: "bg-slate-200",
  chip: "border-slate-200 bg-white text-slate-500",
  dot: "bg-slate-300",
  soft: "bg-white",
}

export function getClinicTone(clinicId?: ClinicId) {
  const clinic = getClinic(clinicId)
  return clinic ? CLINIC_TONE[clinic.color] : UNASSIGNED_TONE
}

export const PROCEDURES: Procedure[] = [
  { id: "proc-implant", name: "Implantologia", clinicId: "pana-medica", category: "Chirurgia", durationMin: 90 },
  { id: "proc-ortho", name: "Ortodoncja", clinicId: "pana-medica", category: "Ortodoncja", durationMin: 45 },
  { id: "proc-endo", name: "Endodoncja", clinicId: "pana-medica", category: "Leczenie", durationMin: 60 },
  { id: "proc-prosth", name: "Protetyka", clinicId: "pana-comfort", category: "Protetyka", durationMin: 60 },
  { id: "proc-restor", name: "Stomatologia zachowawcza", clinicId: "pana-comfort", category: "Leczenie", durationMin: 40 },
  { id: "proc-perio", name: "Periodontologia", clinicId: "pana-comfort", category: "Leczenie", durationMin: 50 },
  { id: "proc-hygiene", name: "Higienizacja", clinicId: "pana-comfort", category: "Profilaktyka", durationMin: 30 },
  { id: "proc-consult", name: "Konsultacja ogólna", clinicId: "pana-international", category: "Konsultacja", durationMin: 30 },
  { id: "proc-whitening", name: "Wybielanie", clinicId: "pana-international", category: "Estetyka", durationMin: 45 },
  { id: "proc-xray", name: "Kontrolne RTG", clinicId: "pana-international", category: "Diagnostyka", durationMin: 15 },
]

export function getProcedure(id?: string) {
  if (!id) return undefined
  return PROCEDURES.find((p) => p.id === id)
}

export const DOCTORS: Doctor[] = [
  { id: "doc-marchenko", name: "Bohdan Marchenko", clinicId: "pana-medica", procedureIds: ["proc-implant", "proc-endo"] },
  { id: "doc-wilczek", name: "Marzanna Wilczek", clinicId: "pana-medica", procedureIds: ["proc-ortho"] },
  { id: "doc-yanushkevich", name: "Aleh Yanushkevich", clinicId: "pana-medica", procedureIds: ["proc-implant"] },
  { id: "doc-zawadzki", name: "Piotr Zawadzki", clinicId: "pana-comfort", procedureIds: ["proc-prosth", "proc-hygiene"] },
  { id: "doc-nowak", name: "Kalina Nowak", clinicId: "pana-comfort", procedureIds: ["proc-restor", "proc-perio"] },
  { id: "doc-lisowska", name: "Agata Lisowska", clinicId: "pana-international", procedureIds: ["proc-consult", "proc-whitening"] },
  { id: "doc-baran", name: "Michal Baran", clinicId: "pana-international", procedureIds: ["proc-xray", "proc-consult"] },
]

export function getDoctor(id?: string) {
  if (!id) return undefined
  return DOCTORS.find((d) => d.id === id)
}
