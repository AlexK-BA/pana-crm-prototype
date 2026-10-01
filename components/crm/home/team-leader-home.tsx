"use client"

import { useEffect, useMemo, useState } from "react"
import { Phone, MessageSquare, CheckSquare, TrendingUp } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChannelIcon } from "@/components/crm/channel-icon"
import { OPERATORS } from "@/lib/crm/data"
import { formatRelative } from "@/lib/crm/format"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useEntityStore } from "@/lib/crm/entity-store"
import { getQueue, getQueueCounters } from "@/lib/crm/entity-queue"
import { buildQueueItem, PRIORITY_TONE, type QueueItem } from "@/lib/crm/entity-selectors"
import type { TaskPriority } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const STATUS_CYCLE = [
  { label: "Dostępny", tone: "bg-emerald-500" },
  { label: "Na rozmowie", tone: "bg-sky-500" },
  { label: "W wiadomościach", tone: "bg-amber-500" },
  { label: "Przerwa", tone: "bg-slate-400" },
]

const PRIORITIES: TaskPriority[] = ["P0", "P1", "P2", "P3", "P4"]

/**
 * §3 fix: this view previously computed its own priority/overdue counts from
 * legacy `CASES` (`approximatePriority`, `queue.ts`), disagreeing with the
 * Task-based counters shown on the Operator home and Queue. All counters here
 * now read from the same `getQueueCounters`/`getQueue` selectors over the
 * shared `tasks` array, scoped to "team" (every task, not just mine).
 */
export function TeamLeaderHome() {
  const { openCase } = useCasePanel()
  const { tasks, cases, interactions, assignTask } = useEntityStore()
  const [reassigned, setReassigned] = useState<Record<string, string>>({})

  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const teamQueue = useMemo(() => getQueue(tasks, {}, now), [tasks, now])
  const counters = useMemo(() => getQueueCounters(tasks, now), [tasks, now])
  const overdueItems = useMemo(
    () =>
      teamQueue
        .filter((t) => t.status === "overdue" || (t.dueAt && new Date(t.dueAt).getTime() < now && now > 0))
        .map((t) => buildQueueItem(t, now, cases))
        .filter((i): i is QueueItem => !!i),
    [teamQueue, cases, now],
  )
  const unassignedCount = counters.unassigned

  const callsCount = interactions.filter((i) => i.type === "call").length
  const messagesCount = interactions.filter((i) => i.type !== "call").length
  const leadsTotal = cases.length
  const leadsConverted = cases.filter((c) => c.status === "converted" || c.status === "completed").length
  const conversion = leadsTotal ? Math.round((leadsConverted / leadsTotal) * 100) : 0

  const team = OPERATORS.map((op, i) => {
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
    const load = tasks.filter((t) => t.ownerId === op.id && t.status !== "completed" && t.status !== "cancelled" && t.status !== "failed").length
    const currentTask = teamQueue.find((t) => t.ownerId === op.id)
    const currentItem = currentTask ? buildQueueItem(currentTask, now, cases) : undefined
    return { op, status, currentItem, load }
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {PRIORITIES.map((code) => (
          <div key={code} className="rounded-lg border border-border bg-card p-3">
            <p className="text-[11px] font-medium text-muted-foreground">{code} kolejka zespołu</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {counters[code.toLowerCase() as "p0" | "p1" | "p2" | "p3" | "p4"]}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={Phone} label="Połączenia (łącznie)" value={callsCount} />
        <MiniStat icon={MessageSquare} label="Wiadomości (łącznie)" value={messagesCount} />
        <MiniStat icon={CheckSquare} label="Nieprzypisane zespołu" value={unassignedCount} tone="text-red-600" />
        <MiniStat icon={TrendingUp} label="Konwersja spraw" value={`${conversion}%`} tone="text-emerald-600" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-foreground">Przeterminowane zespołu i eskalacje</h3>
            <span className="text-xs text-muted-foreground">{overdueItems.length}</span>
          </div>
          <div className="divide-y divide-border">
            {overdueItems.slice(0, 8).map((item) => {
              const assignee = reassigned[item.task.id] ?? item.ownerName
              return (
                <div key={item.task.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_TONE[item.task.priority])} />
                  <button onClick={() => openCase(item.case.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.patientName}</p>
                      <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
                        {item.clinicName} · {item.task.dueAt ? formatRelative(item.task.dueAt) : "—"}
                      </p>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="sm" className="shrink-0 text-xs">
                          {assignee}
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {OPERATORS.map((op) => (
                        <DropdownMenuItem
                          key={op.id}
                          onClick={() => {
                            setReassigned((r) => ({ ...r, [item.task.id]: op.name }))
                            assignTask(item.task.id, op.id)
                          }}
                        >
                          {op.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
            {overdueItems.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Brak przeterminowanych zadań zespołu.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-foreground">Zespół teraz</h3>
          </div>
          <div className="divide-y divide-border">
            {team.map(({ op, status, currentItem, load }) => (
              <div key={op.id} className="flex items-center gap-3 px-4 py-3">
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                      op.color,
                    )}
                  >
                    {op.initials}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                      status.tone,
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{op.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {status.label} · {load} zadań{currentItem ? ` · ${currentItem.patientName}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Phone
  label: string
  value: number | string
  tone?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-semibold text-foreground", tone)}>{value}</p>
      </div>
    </div>
  )
}
