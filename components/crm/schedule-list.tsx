"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar } from "lucide-react"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useEntityStore } from "@/lib/crm/entity-store"
import { buildQueueItem, type QueueItem } from "@/lib/crm/entity-selectors"
import { isActive } from "@/lib/crm/entity-queue"
import { QueueRow } from "@/components/crm/home/operator-home"

/**
 * Locale and timeZone are pinned explicitly (not `undefined`) so the server
 * render and the client hydration always produce the identical string —
 * `undefined` falls back to each runtime's own default locale/timeZone,
 * which differs between the Node server and the browser and causes
 * hydration mismatches.
 */
function dayLabel(dueAt: string) {
  return new Date(dueAt).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "short",
  })
}

function groupByDay(items: QueueItem[]) {
  const groups = new Map<string, QueueItem[]>()
  for (const item of items) {
    if (!item.task.dueAt) continue
    const day = dayLabel(item.task.dueAt)
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(item)
  }
  return groups
}

export function ScheduleList() {
  const { openCase } = useCasePanel()
  const { tasks, cases } = useEntityStore()

  // `now` starts at a fixed, render-stable value so server and client
  // produce identical markup on first paint, then advances client-only.
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const items = useMemo(() => {
    return tasks
      .filter((t) => isActive(t) && t.dueAt)
      .map((t) => buildQueueItem(t, now, cases))
      .filter((i): i is QueueItem => !!i)
      .sort((a, b) => new Date(a.task.dueAt!).getTime() - new Date(b.task.dueAt!).getTime())
  }, [tasks, cases, now])

  const groups = groupByDay(items)

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Calendar className="h-8 w-8" />
        <p className="text-sm">Brak zaplanowanych połączeń lub wizyt.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {Array.from(groups.entries()).map(([day, dayItems]) => (
        <section key={day}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {dayItems.map((item) => (
              <QueueRow key={item.task.id} item={item} onOpen={() => openCase(item.case.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
