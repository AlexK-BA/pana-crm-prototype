"use client"

/**
 * Lightweight "search availability" surface for the case drawer's "Umów
 * wizytę" action: looks up open slots in Medical CRM for the same
 * clinic + service (and doctor, if one is already assigned to the case) so
 * an operator can book without leaving the case.
 */
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from "@/components/ui/popover"
import { CalendarClock, Loader2 } from "lucide-react"
import { DOCTORS, getClinic, getDoctor, getProcedure } from "@/lib/crm/catalog"
import { useEntityStore } from "@/lib/crm/entity-store"
import type { ClinicId } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const DAY_LABELS = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."]
const TIME_SLOTS = ["09:00", "11:30", "14:00", "16:30"]

interface Slot {
  date: Date
  time: string
  doctorId: string
}

function buildSlots(clinicId: ClinicId | undefined, procedureId: string | undefined, doctorId: string | undefined): Slot[] {
  const eligibleDoctors = doctorId
    ? [doctorId]
    : DOCTORS.filter((d) => (!clinicId || d.clinicId === clinicId) && (!procedureId || d.procedureIds.includes(procedureId))).map((d) => d.id)
  const doctorPool = eligibleDoctors.length > 0 ? eligibleDoctors : DOCTORS.filter((d) => !clinicId || d.clinicId === clinicId).map((d) => d.id)

  const slots: Slot[] = []
  const today = new Date()
  let dayOffset = 1
  while (slots.length < 6 && dayOffset < 14) {
    const date = new Date(today)
    date.setDate(date.getDate() + dayOffset)
    // Skip Sundays to keep it plausible.
    if (date.getDay() !== 0) {
      // Deterministically pick 1-2 slots per day from the doctor pool so the
      // list stays short and varies by doctor/day rather than random noise.
      const doctorForDay = doctorPool[dayOffset % doctorPool.length]
      const timeForDay = TIME_SLOTS[dayOffset % TIME_SLOTS.length]
      slots.push({ date, time: timeForDay, doctorId: doctorForDay })
    }
    dayOffset += 1
  }
  return slots
}

function formatSlotLabel(slot: Slot) {
  const dayLabel = DAY_LABELS[slot.date.getDay()]
  const dateLabel = slot.date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })
  return `${dayLabel} ${dateLabel} · ${slot.time}`
}

export function AppointmentSlotPicker({
  caseId,
  taskId,
  patientId,
  clinicId,
  procedureId,
  doctorId,
  actorId = "current-user",
  onBooked,
}: {
  caseId: string
  taskId?: string
  patientId?: string
  clinicId?: ClinicId
  procedureId?: string
  doctorId?: string
  actorId?: string
  onBooked?: () => void
}) {
  const { bookAppointment } = useEntityStore()
  const [searching, setSearching] = useState(true)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const clinic = getClinic(clinicId)
  const procedure = getProcedure(procedureId)

  // Simulate the round trip to Medical CRM's schedule search.
  useMemo(() => {
    const timer = setTimeout(() => setSearching(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const slots = useMemo(() => buildSlots(clinicId, procedureId, doctorId), [clinicId, procedureId, doctorId])

  function handleConfirm() {
    if (!selected) return
    const doctor = getDoctor(selected.doctorId)
    const label = `${formatSlotLabel(selected)}${doctor ? ` · ${doctor.name}` : ""}${procedure ? ` · ${procedure.name}` : ""}`
    bookAppointment({ caseId, taskId, patientId, label, actorId })
    setConfirmed(true)
    onBooked?.()
  }

  if (confirmed && selected) {
    return (
      <PopoverContent className="w-80">
        <PopoverHeader>
          <PopoverTitle>Wizyta umówiona</PopoverTitle>
          <PopoverDescription>
            {formatSlotLabel(selected)} · {getDoctor(selected.doctorId)?.name}
            {clinic ? ` · ${clinic.name}` : ""}
          </PopoverDescription>
        </PopoverHeader>
        <p className="text-xs text-muted-foreground">Potwierdzenie wysłano do pacjenta na czacie.</p>
      </PopoverContent>
    )
  }

  return (
    <PopoverContent className="w-80">
      <PopoverHeader>
        <PopoverTitle>Umów wizytę</PopoverTitle>
        <PopoverDescription>
          {procedure ? procedure.name : "Dowolna usługa"}
          {clinic ? ` · ${clinic.name}` : ""}
        </PopoverDescription>
      </PopoverHeader>

      {searching ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Szukam wolnych terminów w Medical CRM...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {slots.map((slot, i) => {
              const doctor = getDoctor(slot.doctorId)
              const isSelected = selected?.date.getTime() === slot.date.getTime() && selected.time === slot.time
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(slot)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:bg-muted/60",
                  )}
                >
                  <span className="flex items-center gap-1 font-medium">
                    <CalendarClock className="h-3 w-3" />
                    {formatSlotLabel(slot)}
                  </span>
                  <span className="truncate text-muted-foreground">{doctor?.name ?? "Dowolny lekarz"}</span>
                </button>
              )
            })}
          </div>
          <Button size="sm" className="w-full" disabled={!selected} onClick={handleConfirm}>
            Potwierdź wizytę
          </Button>
        </>
      )}
    </PopoverContent>
  )
}
