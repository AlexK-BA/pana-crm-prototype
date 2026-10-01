"use client"

/**
 * Full Audit Log — §2.7 / §18. Reads the live, shared auditEvents stream from
 * EntityStore so every status/assignment/priority/task change, merge, link,
 * and sync conflict recorded anywhere in the app (kanban drag, call wrap-up,
 * drawer actions) shows up here immediately, in one searchable place.
 */

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  GitMerge,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  UserCog,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react"
import { useEntityStore } from "@/lib/crm/entity-store"
import { OPERATORS } from "@/lib/crm/data"
import type { AuditEvent, AuditEventType } from "@/lib/crm/entities"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

const TYPE_META: Record<AuditEventType, { label: string; icon: typeof ShieldCheck; className: string }> = {
  status_change: { label: "Zmiana statusu", icon: ArrowRight, className: "bg-sky-100 text-sky-700" },
  assignment_change: { label: "Zmiana przypisania", icon: UserCog, className: "bg-violet-100 text-violet-700" },
  task_change: { label: "Zmiana zadania", icon: ListChecks, className: "bg-emerald-100 text-emerald-700" },
  priority_change: { label: "Zmiana priorytetu", icon: SlidersHorizontal, className: "bg-amber-100 text-amber-700" },
  merge: { label: "Scalenie", icon: GitMerge, className: "bg-fuchsia-100 text-fuchsia-700" },
  link: { label: "Powiązanie", icon: Link2, className: "bg-teal-100 text-teal-700" },
  unlink: { label: "Odłączenie", icon: Unlink, className: "bg-slate-200 text-slate-700" },
  sync: { label: "Synchronizacja", icon: RefreshCw, className: "bg-red-100 text-red-700" },
}

const TYPE_ORDER: AuditEventType[] = [
  "status_change",
  "assignment_change",
  "priority_change",
  "task_change",
  "merge",
  "link",
  "unlink",
  "sync",
]

function actorName(actorId: string) {
  if (actorId === "system") return "System"
  return OPERATORS.find((o) => o.id === actorId)?.name ?? actorId
}

function actorInitials(actorId: string) {
  if (actorId === "system") return "SY"
  return OPERATORS.find((o) => o.id === actorId)?.initials ?? actorId.slice(0, 2).toUpperCase()
}

function actorColor(actorId: string) {
  if (actorId === "system") return "bg-slate-400"
  return OPERATORS.find((o) => o.id === actorId)?.color ?? "bg-slate-400"
}

function matchesQuery(event: AuditEvent, query: string) {
  if (!query.trim()) return true
  const haystack = [event.summary, event.caseId, event.patientId, event.before, event.after, actorName(event.actorId)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export function AuditLogView() {
  const { auditEvents } = useEntityStore()
  const [query, setQuery] = useState("")
  const [activeType, setActiveType] = useState<AuditEventType | "all">("all")

  // Relative timestamps ("24 mins ago") are computed against the real clock,
  // which ticks forward between the server render and client hydration and
  // can flip the rounded minute value. Deferring them to a client-only mount
  // avoids a hydration mismatch (no diff against server HTML after mount).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const sorted = useMemo(
    () => [...auditEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [auditEvents],
  )

  const filtered = useMemo(
    () => sorted.filter((e) => (activeType === "all" || e.type === activeType) && matchesQuery(e, query)),
    [sorted, activeType, query],
  )

  const last24h = useMemo(
    () => sorted.filter((e) => Date.now() - new Date(e.at).getTime() < 24 * 60 * 60 * 1000).length,
    [sorted],
  )

  const conflicts = useMemo(
    () => sorted.filter((e) => e.type === "sync" && e.summary.toLowerCase().includes("konflikt")).length,
    [sorted],
  )

  const typeCounts = useMemo(() => {
    const counts = new Map<AuditEventType, number>()
    for (const e of sorted) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    return counts
  }, [sorted])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Zdarzenia w systemie" value={sorted.length} />
        <Stat label="Ostatnie 24h" value={last24h} />
        <Stat label="Konflikty synchronizacji" value={conflicts} accent={conflicts > 0} />
        <Stat label="Typy zdarzeń" value={typeCounts.size} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po sprawie, aktorze, treści…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={activeType === "all"} onClick={() => setActiveType("all")}>
            Wszystkie ({sorted.length})
          </FilterChip>
          {TYPE_ORDER.filter((t) => (typeCounts.get(t) ?? 0) > 0).map((t) => (
            <FilterChip key={t} active={activeType === t} onClick={() => setActiveType(t)}>
              {TYPE_META[t].label} ({typeCounts.get(t) ?? 0})
            </FilterChip>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Dziennik zdarzeń
            <span className="ml-2 text-xs font-normal text-muted-foreground">({filtered.length})</span>
          </h3>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Brak zdarzeń spełniających kryteria filtrowania.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((event) => {
              const meta = TYPE_META[event.type]
              return (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.className)}
                  >
                    <meta.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{event.summary}</span>
                      {event.occurrences && event.occurrences > 1 ? (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          ×{event.occurrences}
                        </span>
                      ) : null}
                    </div>
                    {(event.before || event.after) && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {event.before ? <span className="rounded bg-secondary px-1.5 py-0.5">{event.before}</span> : null}
                        {event.before && event.after ? <ArrowRight className="h-3 w-3" /> : null}
                        {event.after ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">{event.after}</span>
                        ) : null}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white",
                          actorColor(event.actorId),
                        )}
                      >
                        {actorInitials(event.actorId)}
                      </span>
                      <span>{actorName(event.actorId)}</span>
                      {event.caseId ? <span>· sprawa {event.caseId}</span> : null}
                      {event.patientId ? <span>· pacjent {event.patientId}</span> : null}
                      <span title={formatDateTime(event.at)}>
                        · {mounted ? formatRelative(event.at) : formatDateTime(event.at)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold text-foreground", accent && value > 0 && "text-red-600")}>{value}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  )
}
