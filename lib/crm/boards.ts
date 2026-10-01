import type { CaseBoard } from "./entities"
import type { DictionaryKey } from "./language-context"

export type BoardId = CaseBoard

export interface BoardColumn {
  id: string
  label: string
  labelKey: DictionaryKey
  color: "rose" | "amber" | "violet" | "orange" | "red" | "slate" | "emerald" | "sky"
}

export const BOARD_LABELS: Record<BoardId, string> = {
  leads: "Leady · Contact Center",
  deals: "Dealy · Contact Center",
  patients: "Pacjenci · Opieka nad pacjentem",
}

export const BOARD_LABEL_KEYS: Record<BoardId, DictionaryKey> = {
  leads: "board_leads_label",
  deals: "board_deals_label",
  patients: "board_patients_label",
}

export const BOARD_COLUMNS: Record<BoardId, BoardColumn[]> = {
  leads: [
    { id: "new", label: "Nowe zgłoszenie", labelKey: "col_new", color: "rose" },
    { id: "qualification", label: "Kwalifikacja", labelKey: "col_qualification", color: "amber" },
    { id: "waiting", label: "Lista oczekujących", labelKey: "col_waiting", color: "violet" },
    { id: "call_later", label: "Oddzwonić później", labelKey: "col_call_later", color: "orange" },
    { id: "failed", label: "Brak kontaktu / niezjawienie się", labelKey: "col_failed", color: "red" },
    { id: "closed", label: "Zamknięte · nieskonwertowane", labelKey: "col_closed", color: "slate" },
    { id: "converted", label: "Skonwertowane w deal", labelKey: "col_converted", color: "emerald" },
  ],
  deals: [
    { id: "scheduled", label: "Wizyta zaplanowana", labelKey: "col_scheduled", color: "sky" },
    { id: "post_visit", label: "Kontrola po wizycie", labelKey: "col_post_visit", color: "amber" },
    { id: "recall", label: "Zalecana wizyta kontrolna", labelKey: "col_recall", color: "violet" },
    { id: "care", label: "Przekazano do opieki nad pacjentem", labelKey: "col_care", color: "orange" },
    { id: "no_show", label: "Niezjawienie się", labelKey: "col_no_show", color: "red" },
    { id: "completed", label: "Deal zakończony", labelKey: "col_completed", color: "emerald" },
  ],
  patients: [
    { id: "appt_scheduled", label: "Wizyta zaplanowana", labelKey: "col_appt_scheduled", color: "sky" },
    { id: "new_patient", label: "Nowy pacjent", labelKey: "col_new_patient", color: "rose" },
    { id: "returning", label: "Pacjent powracający", labelKey: "col_returning", color: "orange" },
    { id: "in_treatment", label: "W trakcie leczenia", labelKey: "col_in_treatment", color: "violet" },
    { id: "control", label: "Zdjęcie kontrolne", labelKey: "col_control", color: "amber" },
    { id: "complete", label: "Leczenie zakończone", labelKey: "col_complete", color: "emerald" },
  ],
}

export const COLOR_CLASSES: Record<
  BoardColumn["color"],
  { dot: string; header: string; ring: string }
> = {
  rose: { dot: "bg-rose-500", header: "bg-rose-50", ring: "ring-rose-200" },
  amber: { dot: "bg-amber-500", header: "bg-amber-50", ring: "ring-amber-200" },
  violet: { dot: "bg-violet-500", header: "bg-violet-50", ring: "ring-violet-200" },
  orange: { dot: "bg-orange-500", header: "bg-orange-50", ring: "ring-orange-200" },
  red: { dot: "bg-red-500", header: "bg-red-50", ring: "ring-red-200" },
  slate: { dot: "bg-slate-400", header: "bg-slate-50", ring: "ring-slate-200" },
  emerald: { dot: "bg-emerald-500", header: "bg-emerald-50", ring: "ring-emerald-200" },
  sky: { dot: "bg-sky-500", header: "bg-sky-50", ring: "ring-sky-200" },
}
