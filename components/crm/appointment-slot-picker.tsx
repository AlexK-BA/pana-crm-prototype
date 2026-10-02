"use client"

/**
 * "Umów wizytę" dialog. Slots are DEMO data generated locally: Medical CRM
 * scheduling is not connected, so confirming only records a booking label in
 * the CRM and never sends anything to the patient or to Medical CRM.
 */
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CalendarClock } from "lucide-react"
import { DOCTORS, getClinic, getDoctor, getProcedure } from "@/lib/crm/catalog"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useLanguage } from "@/lib/crm/language-context"
import type { ClinicId } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const TIME_SLOTS = [9 * 60, 11 * 60 + 30, 14 * 60, 16 * 60 + 30]

interface Slot { startsAt: string; doctorId: string }

function buildSlots(clinicId: ClinicId | undefined, procedureId: string | undefined, doctorId: string | undefined, now: number): Slot[] {
  const eligible = doctorId
    ? [doctorId]
    : DOCTORS.filter(d => (!clinicId || d.clinicId === clinicId) && (!procedureId || d.procedureIds.includes(procedureId))).map(d => d.id)
  const pool = eligible.length > 0 ? eligible : DOCTORS.filter(d => !clinicId || d.clinicId === clinicId).map(d => d.id)
  if (pool.length === 0) return []
  const base = new Date(now)
  const slots: Slot[] = []
  for (let offset = 1; offset < 14 && slots.length < 6; offset += 1) {
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offset))
    if (day.getUTCDay() === 0) continue
    const minutes = TIME_SLOTS[offset % TIME_SLOTS.length]
    day.setUTCMinutes(minutes)
    slots.push({ startsAt: day.toISOString(), doctorId: pool[offset % pool.length] })
  }
  return slots
}

export function AppointmentBookingDialog({
  open, onOpenChange, caseId, taskId, patientId, patientName, clinicId, procedureId, doctorId, actorId = "current-user", onBooked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  taskId?: string
  patientId?: string
  patientName?: string
  clinicId?: ClinicId
  procedureId?: string
  doctorId?: string
  actorId?: string
  onBooked?: () => void
}) {
  const { bookAppointment } = useScopedEntityStore()
  const { tr, locale } = useLanguage()
  const [selected, setSelected] = useState<Slot | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState("")
  const [now] = useState(() => Date.now())

  const clinic = getClinic(clinicId)
  const procedure = getProcedure(procedureId)
  const slots = useMemo(() => buildSlots(clinicId, procedureId, doctorId, now), [clinicId, procedureId, doctorId, now])
  // Slot times are authored as clinic wall-clock time and rendered without conversion.
  const dateLabel = (slot: Slot) => new Date(slot.startsAt).toLocaleDateString(locale, { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
  const timeLabel = (slot: Slot) => new Date(slot.startsAt).toLocaleTimeString(locale, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })
  const fullLabel = (slot: Slot) => `${dateLabel(slot)} ${timeLabel(slot)}${getDoctor(slot.doctorId) ? ` · ${getDoctor(slot.doctorId)?.name}` : ""}${procedure ? ` · ${procedure.name}` : ""}`

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) { setSelected(null); setConfirmed(false); setError("") }
  }

  function confirm() {
    if (!selected) return
    try {
      bookAppointment({ caseId, taskId, patientId, label: fullLabel(selected), actorId })
      setError(""); setConfirmed(true); onBooked?.()
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Nie udało się zapisać.", "Не удалось сохранить.")) }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{confirmed ? tr("Wizyta zapisana w CRM", "Визит записан в CRM") : tr("Umów wizytę", "Записать на визит")}</DialogTitle>
          <DialogDescription>
            {[patientName, clinic?.name, procedure?.name ?? tr("Dowolna usługa", "Любая услуга")].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <Badge variant="outline" className="w-fit">{tr("DEMO — terminy przykładowe, bez Medical CRM", "DEMO — примерные слоты, без Medical CRM")}</Badge>

        {confirmed && selected ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">{fullLabel(selected)}</p>
            <p className="text-xs text-muted-foreground">{tr("Zapisano lokalnie w CRM (czas kliniki). Wizyta NIE została wysłana do Medical CRM, a pacjent nie otrzymał potwierdzenia.", "Сохранено локально в CRM (время клиники). Визит НЕ отправлен в Medical CRM, пациент не получил подтверждения.")}</p>
          </div>
        ) : slots.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">{tr("Brak lekarzy dla tej kliniki — nie można zaproponować terminów.", "Нет врачей для этой клиники — слоты предложить нельзя.")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tr("Dostępne terminy", "Доступные слоты")}>
            {slots.map(slot => {
              const isSelected = selected?.startsAt === slot.startsAt && selected.doctorId === slot.doctorId
              return (
                <button key={`${slot.startsAt}/${slot.doctorId}`} type="button" role="radio" aria-checked={isSelected} onClick={() => setSelected(slot)}
                  className={cn("flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-xs transition-colors", isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/60")}>
                  <span className="flex items-center gap-1 font-medium"><CalendarClock className="h-3 w-3" />{dateLabel(slot)}</span>
                  <span className="text-sm font-semibold">{timeLabel(slot)}</span>
                  <span className="truncate text-muted-foreground">{getDoctor(slot.doctorId)?.name ?? tr("Dowolny lekarz", "Любой врач")}</span>
                </button>
              )
            })}
          </div>
        )}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          {confirmed ? <Button onClick={() => close(false)}>{tr("Zamknij", "Закрыть")}</Button> : <>
            <Button variant="ghost" onClick={() => close(false)}>{tr("Anuluj", "Отмена")}</Button>
            <Button disabled={!selected} onClick={confirm}>{tr("Zapisz wizytę", "Записать визит")}</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
