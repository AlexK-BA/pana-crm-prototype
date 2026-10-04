"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, ListTodo, Phone, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useLanguage } from "@/lib/crm/language-context"
import { useCall } from "@/lib/crm/call-context"
import { getQueue, getQueueCounters } from "@/lib/crm/entity-queue"
import {
  buildQueueItem,
  PRIORITY_TONE,
  type ActionKind,
  type QueueItem,
} from "@/lib/crm/entity-selectors"
import { actionKindText, priorityText } from "@/lib/crm/display-labels"
import { getClinicTone } from "@/lib/crm/catalog"
import { formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

const ACTION_KINDS: ActionKind[] = ["unassigned_clinic", "reply", "call", "follow_up", "treatment_plan"]

export function OperatorHome() {
  const { openCase } = useCasePanel()
  const { t, tr, language } = useLanguage()
  const { startOutgoingCall } = useCall()
  const { tasks, cases, currentUser } = useScopedEntityStore()
  const [actionError, setActionError] = useState("")
  const [tab, setTab] = useState<"mine" | "unassigned" | "team">("mine")
  const [actionFilter, setActionFilter] = useState<ActionKind | "all">("all")
  type TileFilter = "p0" | "p1" | "p2" | "p3" | "overdue" | "unassigned"
  const [tileFilter, setTileFilter] = useState<TileFilter | null>(null)

  // `now` starts at a fixed, render-stable value so server and client produce
  // identical markup on first paint. It is only advanced to the real clock
  // time after mount, which happens as a client-only update (no hydration
  // diff, since React doesn't re-diff against server HTML after hydration).
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const teamQueue = useMemo(() => getQueue(tasks, {}, now), [tasks, now])
  const mineQueue = useMemo(() => getQueue(tasks, { ownerId: currentUser.id }, now), [tasks, currentUser.id, now])
  const unassignedQueue = useMemo(() => getQueue(tasks, { unassignedOnly: true }, now), [tasks, now])
  const visibleTasks = tab === "mine" ? mineQueue : tab === "unassigned" ? unassignedQueue : teamQueue
  const counters = useMemo(() => getQueueCounters(visibleTasks, now), [visibleTasks, now])
  const allVisibleItems = visibleTasks.map((t) => buildQueueItem(t, now, cases)).filter((i): i is QueueItem => !!i)
  const actionFiltered = actionFilter === "all" ? allVisibleItems : allVisibleItems.filter((i) => i.actionKind === actionFilter)
  const visibleItems = !tileFilter
    ? actionFiltered
    : actionFiltered.filter((i) => {
        switch (tileFilter) {
          case "p0":
            return i.task.priority === "P0"
          case "p1":
            return i.task.priority === "P1"
          case "p2":
            return i.task.priority === "P2"
          case "p3":
            return i.task.priority === "P3"
          case "overdue":
            return i.overdue
          case "unassigned":
            return !i.task.ownerId
        }
      })

  function handleTileClick(key: TileFilter) {
    setTileFilter((prev) => (prev === key ? null : key))
  }
  const actionCounts = ACTION_KINDS.reduce<Record<ActionKind, number>>((acc, kind) => {
    acc[kind] = allVisibleItems.filter((i) => i.actionKind === kind).length
    return acc
  }, {} as Record<ActionKind, number>)
  // Never suggest work assigned to another person. If the personal queue is
  // empty, the first unassigned item is the only safe fallback.
  const nextTask = mineQueue[0] ?? unassignedQueue[0]
  const nextItem = nextTask ? buildQueueItem(nextTask, now, cases) : undefined

  function startNextAction() {
    if (!nextItem) return
    setActionError("")
    try {
      if (nextItem.task.requiresCall) startOutgoingCall({ caseId: nextItem.case.id, taskId: nextItem.task.id })
      else openCase(nextItem.case.id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : tr("Nie udało się rozpocząć działania.", "Не удалось начать действие."))
    }
  }

  const counterTiles: { label: string; value: number; tone: string; key: TileFilter }[] = [
    { label: t("tile_p0"), value: counters.p0, tone: "text-red-700", key: "p0" },
    { label: t("tile_p1"), value: counters.p1, tone: "text-red-600", key: "p1" },
    { label: t("tile_p2"), value: counters.p2, tone: "text-amber-600", key: "p2" },
    { label: t("tile_p3"), value: counters.p3, tone: "text-sky-600", key: "p3" },
    { label: t("tile_overdue"), value: counters.overdue, tone: "text-red-600", key: "overdue" },
    { label: t("tile_unassigned"), value: counters.unassigned, tone: "text-slate-600", key: "unassigned" },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {nextItem && (
        <section className="rounded-lg border border-primary/30 bg-primary/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("next_action")}</p>
            <PriorityBadge item={nextItem} />
          </div>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">{nextItem.patientName}</p>
              <p className="text-xs text-muted-foreground">
                {nextItem.clinicName} · {nextItem.serviceName ?? t("no_service")} · {nextItem.identityLabel}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground" suppressHydrationWarning>
                {t("last_action")}: {nextItem.lastAction ?? "—"}
                {nextItem.lastActionAt && <> · {formatRelative(nextItem.lastActionAt, language)}</>}
              </p>
              <p className="text-xs font-medium text-foreground" suppressHydrationWarning>
                {t("next_step")}: {nextItem.task.title}
                {nextItem.task.dueAt && <> · {formatRelative(nextItem.task.dueAt, language)}</>}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Button size="lg" className="gap-2 px-5" onClick={startNextAction}>
                {nextItem.task.requiresCall ? <Phone className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {nextItem.task.requiresCall ? t("call") : t("open_start")}
              </Button>
              <Link href="/schedule" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
                <ListTodo className="h-3.5 w-3.5" /> {t("full_task_queue")}
              </Link>
            </div>
          </div>
          {actionError && <p role="alert" className="mt-3 text-xs text-destructive">{actionError}</p>}
        </section>
      )}

      {!nextItem && (
        <section className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">{t("personal_queue_clear")}</p><p className="text-sm text-muted-foreground">{t("personal_queue_clear_hint")}</p></div>
          <Link href="/schedule"><Button variant="outline" className="gap-1.5"><ListTodo className="h-4 w-4" />{t("full_task_queue")}</Button></Link>
        </section>
      )}

      <p className="text-[11px] font-medium text-muted-foreground">
        {tab === "mine"
          ? tr("Liczniki dla Twojej kolejki — kliknij, aby przefiltrować listę", "Счётчики вашей очереди — нажмите, чтобы отфильтровать список")
          : tab === "unassigned"
            ? tr("Liczniki dla zadań nieprzypisanych — kliknij, aby przefiltrować listę", "Счётчики неназначенных задач — нажмите, чтобы отфильтровать список")
            : tr("Liczniki dla całego zespołu — kliknij, aby przefiltrować listę", "Счётчики по всей команде — нажмите, чтобы отфильтровать список")}
      </p>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {counterTiles.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={tileFilter === c.key}
            onClick={() => handleTileClick(c.key)}
            className={cn(
              "rounded-lg border bg-card p-3 text-left transition-colors hover:bg-secondary/40",
              tileFilter === c.key ? "border-primary ring-1 ring-primary bg-primary/[0.04]" : "border-border",
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 text-xl font-semibold", c.tone)} suppressHydrationWarning>
              {c.value}
            </p>
          </button>
        ))}
        {tileFilter && (
          <button
            type="button"
            onClick={() => setTileFilter(null)}
            className="col-span-2 rounded-lg border border-dashed border-border p-3 text-left text-xs font-medium text-muted-foreground hover:bg-secondary/40 md:col-span-1"
          >
            {t("clear_filter")} ×
          </button>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="mine">{t("tab_mine")} ({mineQueue.length})</TabsTrigger>
              <TabsTrigger value="unassigned">{t("tab_unassigned")} ({unassignedQueue.length})</TabsTrigger>
              <TabsTrigger value="team">{t("tab_team")} ({teamQueue.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Link href="/board">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              {t("kanban_view")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">{t("action_required")}:</span>
          <button
            type="button"
            aria-pressed={actionFilter === "all"}
            onClick={() => setActionFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              actionFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {t("all")} ({allVisibleItems.length})
          </button>
          {ACTION_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={actionFilter === kind}
              onClick={() => setActionFilter(kind)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                actionFilter === kind
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {actionKindText(kind, language)} ({actionCounts[kind]})
            </button>
          ))}
        </div>
        <div className="divide-y divide-border">
          {visibleItems.slice(0, 8).map((item) => (
            <QueueRow key={item.task.id} item={item} onOpen={() => openCase(item.case.id)} />
          ))}
          {visibleItems.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("queue_empty")}</p>
          )}
        </div>
      </section>
    </div>
  )
}

export function PriorityBadge({ item }: { item: QueueItem }) {
  const { language } = useLanguage()
  return (
    <Badge className={cn("gap-1 border-0 text-white", PRIORITY_TONE[item.task.priority])}>
      {item.task.priority} · {priorityText(item.task.priority, language)}
    </Badge>
  )
}

export function QueueRow({ item, onOpen }: { item: QueueItem; onOpen: () => void }) {
  const tone = getClinicTone(item.case.clinicId)
  const { t, language } = useLanguage()
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full items-stretch gap-0 text-left transition-colors hover:bg-secondary/40")}
    >
      <span className={cn("w-1 shrink-0", tone.bar)} aria-hidden="true" />
      <span className="flex flex-1 items-center gap-3 px-3 py-3">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_TONE[item.task.priority])}
          title={`${item.task.priority} · ${priorityText(item.task.priority, language)}`}
        >
          <span className="sr-only">{item.task.priority}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{item.patientName}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className={cn("mr-1 inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium", tone.chip)}>
              {item.clinicAssigned ? item.clinicName : t("no_clinic")}
            </span>
            {item.serviceName ?? "—"}
            {item.doctorName ? ` · ${item.doctorName}` : ""}
          </p>
        </div>
        <div className="hidden w-44 shrink-0 truncate text-xs text-muted-foreground md:block">{item.task.title}</div>
        <div
          className={cn("w-24 shrink-0 text-right text-xs font-medium", item.overdue ? "text-red-600" : "text-foreground")}
          suppressHydrationWarning
        >
          {item.task.dueAt ? formatRelative(item.task.dueAt, language) : "—"}
        </div>
        <div className="hidden w-28 shrink-0 truncate text-right text-xs text-muted-foreground sm:block">
          {item.ownerName}
        </div>
      </span>
    </button>
  )
}
