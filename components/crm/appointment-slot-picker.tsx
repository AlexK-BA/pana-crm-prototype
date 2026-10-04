"use client"

/**
 * "Umów wizytę" dialog with a month calendar and per-day time slots.
 * Availability is DEMO data generated locally: Medical CRM scheduling is not
 * connected. Confirming calls bookAppointment, which records the visit in the
 * CRM, completes the related task when it does not require a call, and adds a
 * confirmation message to the case conversation (CRM emulation, not delivered
 * through a real channel and not sent to Medical CRM).
 */
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react"
import { DOCTORS, getClinic, getDoctor, getProcedure } from "@/lib/crm/catalog"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useLanguage } from "@/lib/crm/language-context"
import type { ClinicId } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const DAY_MS = 86_400_000
const HORIZON_DAYS = 60
const TIME_SLOTS = [9 * 60, 11 * 60 + 30, 14 * 60, 16 * 60 + 30]

interface Slot { startsAt: string; doctorId: string }

const dayKey = (date: Date) => date.toISOString().slice(0, 10)

function doctorPool(clinicId: ClinicId | undefined, procedureId: string | undefined, doctorId: string | undefined): string[] {
  if (doctorId) return [doctorId]
  const eligible = DOCTORS.filter(d => (!clinicId || d.clinicId === clinicId) && (!procedureId || d.procedureIds.includes(procedureId))).map(d => d.id)
  return eligible.length > 0 ? eligible : DOCTORS.filter(d => !clinicId || d.clinicId === clinicId).map(d => d.id)
}

function slotsForDay(day: Date, pool: string[]): Slot[] {
  if (pool.length === 0 || day.getUTCDay() === 0) return []
  const dayIndex = Math.floor(day.getTime() / DAY_MS)
  return TIME_SLOTS.flatMap(minutes => {
    // Deterministic gaps so the calendar looks like a real, partly booked schedule.
    if ((dayIndex + minutes) % 5 === 0) return []
    return [{ startsAt: new Date(day.getTime() + minutes * 60_000).toISOString(), doctorId: pool[(dayIndex + minutes) % pool.length] }]
  })
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
  const [now] = useState(() => Date.now())
  const today = useMemo(() => { const base = new Date(now); return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())) }, [now])
  const lastDay = useMemo(() => new Date(today.getTime() + HORIZON_DAYS * DAY_MS), [today])
  const pool = useMemo(() => doctorPool(clinicId, procedureId, doctorId), [clinicId, procedureId, doctorId])

  const isAvailable = (day: Date) => day > today && day <= lastDay && slotsForDay(day, pool).length > 0
  const firstAvailable = useMemo(() => {
    for (let offset = 1; offset <= HORIZON_DAYS; offset += 1) {
      const day = new Date(today.getTime() + offset * DAY_MS)
      if (slotsForDay(day, pool).length > 0) return day
    }
    return null
  }, [today, pool])

  const [month, setMonth] = useState(() => { const start = firstAvailable ?? today; return { year: start.getUTCFullYear(), month: start.getUTCMonth() } })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState("")

  const clinic = getClinic(clinicId)
  const procedure = getProcedure(procedureId)
  // Slot times are authored as clinic wall-clock time and rendered without conversion.
  const dateLabel = (date: Date) => date.toLocaleDateString(locale, { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
  const timeLabel = (slot: Slot) => new Date(slot.startsAt).toLocaleTimeString(locale, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })
  const fullLabel = (slot: Slot) => `${dateLabel(new Date(slot.startsAt))} ${timeLabel(slot)}${getDoctor(slot.doctorId) ? ` · ${getDoctor(slot.doctorId)?.name}` : ""}${procedure ? ` · ${procedure.name}` : ""}`

  const monthStart = new Date(Date.UTC(month.year, month.month, 1))
  const daysInMonth = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate()
  const leadingBlanks = (monthStart.getUTCDay() + 6) % 7
  const weekdayNames = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2024, 0, 1 + index)).toLocaleDateString(locale, { timeZone: "UTC", weekday: "short" }))
  const canGoBack = monthStart > new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const canGoForward = new Date(Date.UTC(month.year, month.month + 1, 1)) <= lastDay
  const shiftMonth = (delta: number) => setMonth(current => { const next = new Date(Date.UTC(current.year, current.month + delta, 1)); return { year: next.getUTCFullYear(), month: next.getUTCMonth() } })

  const daySlots = selectedDay ? slotsForDay(new Date(`${selectedDay}T00:00:00.000Z`), pool) : []

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) { setSelected(null); setSelectedDay(null); setConfirmed(false); setError("") }
  }

  function pickDay(day: Date) {
    setSelectedDay(dayKey(day))
    setSelected(null)
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
            <p className="text-xs text-muted-foreground">
              {tr("Zapisano w CRM (czas kliniki). Powiązane zadanie zostało zamknięte (jeśli nie wymaga rozmowy), a potwierdzenie dodano do rozmowy w sprawie jako emulację. Wizyta NIE została wysłana do Medical CRM, a wiadomość nie została dostarczona kanałem zewnętrznym.",
                "Сохранено в CRM (время клиники). Связанная задача закрыта (если не требует звонка), подтверждение добавлено в переписку по делу как эмуляция. Визит НЕ отправлен в Medical CRM, сообщение не доставлено через внешний канал.")}
            </p>
          </div>
        ) : !firstAvailable ? (
          <p role="status" className="text-sm text-muted-foreground">{tr("Brak lekarzy dla tej kliniki — nie można zaproponować terminów.", "Нет врачей для этой клиники — слоты предложить нельзя.")}</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canGoBack} onClick={() => shiftMonth(-1)} aria-label={tr("Poprzedni miesiąc", "Предыдущий месяц")}><ChevronLeft className="h-4 w-4" /></Button>
                <p aria-live="polite" className="text-sm font-medium capitalize">{monthStart.toLocaleDateString(locale, { timeZone: "UTC", month: "long", year: "numeric" })}</p>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canGoForward} onClick={() => shiftMonth(1)} aria-label={tr("Następny miesiąc", "Следующий месяц")}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
                {weekdayNames.map(name => <span key={name}>{name}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = new Date(Date.UTC(month.year, month.month, index + 1))
                  const available = isAvailable(day)
                  const isSelectedDay = selectedDay === dayKey(day)
                  return (
                    <button key={dayKey(day)} type="button" disabled={!available} aria-pressed={isSelectedDay} aria-label={dateLabel(day)} onClick={() => pickDay(day)}
                      className={cn("h-8 rounded-md text-xs transition-colors", available ? "font-medium hover:bg-muted" : "text-muted-foreground/40", isSelectedDay && "bg-primary text-primary-foreground hover:bg-primary")}>
                      {index + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDay ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={tr("Dostępne godziny", "Доступное время")}>
                {daySlots.map(slot => {
                  const isSelected = selected?.startsAt === slot.startsAt && selected.doctorId === slot.doctorId
                  return (
                    <button key={`${slot.startsAt}/${slot.doctorId}`} type="button" role="radio" aria-checked={isSelected} onClick={() => setSelected(slot)}
                      className={cn("flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors", isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/60")}>
                      <span className="flex items-center gap-1 text-sm font-semibold"><CalendarClock className="h-3 w-3" />{timeLabel(slot)}</span>
                      <span className="w-full truncate text-muted-foreground">{getDoctor(slot.doctorId)?.name ?? tr("Dowolny lekarz", "Любой врач")}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{tr("Wybierz dzień w kalendarzu, aby zobaczyć godziny.", "Выберите день в календаре, чтобы увидеть время.")}</p>
            )}
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
