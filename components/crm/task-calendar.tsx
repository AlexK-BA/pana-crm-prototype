"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CalendarClock, AlertTriangle } from "lucide-react"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { buildQueueItem, PRIORITY_TONE } from "@/lib/crm/entity-selectors"
import { getClinicTone } from "@/lib/crm/catalog"
import { iso } from "@/lib/crm/entity-data"
import { cn } from "@/lib/utils"

const DAY_MS = 1000 * 60 * 60 * 24
const DAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"]

/** Fixed demo "today" (matches the seeded dataset's reference instant) so the
 * initial calendar render is identical on the server and the client. */
const TODAY = new Date(iso(0))

function startOfWeekUtc(d: Date) {
  const day = d.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  const start = new Date(d)
  start.setUTCDate(d.getUTCDate() - diff)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function sameUtcDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

export function TaskCalendar() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const { tasks, cases, rescheduleTask } = useScopedEntityStore()
  const { openCase } = useCasePanel()

  const weekStart = useMemo(() => {
    const base = startOfWeekUtc(TODAY)
    base.setUTCDate(base.getUTCDate() + weekOffset * 7)
    return base
  }, [weekOffset])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)), [weekStart])

  const dated = tasks.filter((t) => t.dueAt && t.status !== "completed" && t.status !== "cancelled")
  const undatedCount = tasks.filter((t) => !t.dueAt && t.status !== "completed" && t.status !== "cancelled").length

  const tasksByDay = useMemo(() => {
    return days.map((day) => {
      const dayEnd = new Date(day.getTime() + DAY_MS)
      return dated
        .filter((t) => {
          const due = new Date(t.dueAt!)
          return due >= day && due < dayEnd
        })
        .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
    })
  }, [days, dated])

  const rangeLabel = `${days[0].toLocaleDateString("en-US", { timeZone: "UTC", day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("en-US", { timeZone: "UTC", day: "2-digit", month: "short" })}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((v) => v - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekOffset(0)}>
            Dzisiaj
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((v) => v + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="text-sm font-medium text-foreground">{rangeLabel}</span>
        {undatedCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {undatedCount} zadań bez terminu
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 md:p-4">
        <div className="grid min-w-[980px] grid-cols-7 gap-2">
          {days.map((day, i) => {
            const isToday = sameUtcDay(day, TODAY)
            const isDragOver = dragOverDay === i
            return (
              <div
                key={i}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragOverDay !== i) setDragOverDay(i)
                }}
                onDragLeave={() => setDragOverDay((v) => (v === i ? null : v))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverDay(null)
                  if (!dragTaskId) return
                  const task = tasks.find((t) => t.id === dragTaskId)
                  if (!task) return
                  const original = task.dueAt ? new Date(task.dueAt) : new Date(TODAY)
                  const newDue = new Date(day.getTime())
                  newDue.setUTCHours(original.getUTCHours(), original.getUTCMinutes(), 0, 0)
                  rescheduleTask(dragTaskId, newDue.toISOString())
                  setDragTaskId(null)
                }}
                className={cn(
                  "flex flex-col rounded-lg border border-border bg-muted/30 transition-colors",
                  isDragOver && "border-primary bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between rounded-t-lg border-b border-border px-2.5 py-2",
                    isToday && "bg-primary/10",
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">{DAY_LABELS[i]}</span>
                  <span className={cn("text-xs font-semibold text-foreground", isToday && "text-primary")}>
                    {day.toLocaleDateString("en-US", { timeZone: "UTC", day: "2-digit", month: "short" })}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5 p-1.5">
                  {tasksByDay[i].length === 0 && <div className="px-1.5 py-2 text-center text-[11px] text-muted-foreground">—</div>}
                  {tasksByDay[i].map((task) => {
                    const item = buildQueueItem(task, TODAY.getTime(), cases)
                    if (!item) return null
                    const time = new Date(task.dueAt!).toLocaleTimeString("en-US", {
                      timeZone: "UTC",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    const clinicId = cases.find((c) => c.id === task.caseId)?.clinicId
                    const tone = getClinicTone(clinicId)
                    return (
                      <button
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          setDragTaskId(task.id)
                          e.dataTransfer.effectAllowed = "move"
                        }}
                        onDragEnd={() => {
                          setDragTaskId(null)
                          setDragOverDay(null)
                        }}
                        onClick={() => openCase(task.caseId)}
                        className={cn(
                          "relative flex w-full cursor-grab flex-col overflow-hidden rounded-md border bg-card px-2 py-1.5 pl-2.5 text-left shadow-sm transition-colors hover:bg-accent active:cursor-grabbing",
                          item.overdue ? "border-destructive/40 bg-destructive/5" : "border-border",
                        )}
                      >
                        <span
                          className={cn("absolute left-0 top-0 h-full w-1", item.overdue ? "bg-destructive" : tone.bar)}
                          aria-hidden="true"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_TONE[task.priority])} />
                          <span className="text-[11px] font-medium text-muted-foreground">{time}</span>
                          {item.overdue && (
                            <span className="ml-auto flex items-center gap-0.5 text-[10px] font-semibold text-destructive">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Przeterminowane
                            </span>
                          )}
                        </div>
                        <span className="mt-0.5 truncate text-xs font-medium text-foreground">{item.patientName}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{task.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
