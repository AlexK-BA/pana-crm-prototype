"use client"

import { useMemo } from "react"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { getClinic, getProcedure } from "@/lib/crm/catalog"
import { formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

const SEGMENTS = [
  { key: "post_visit", title: "Kontrola po wizycie", tone: "text-amber-600" }, { key: "recall", title: "Rekomendowany recall", tone: "text-violet-600" },
  { key: "in_treatment", title: "W leczeniu", tone: "text-violet-600" }, { key: "control", title: "Kontrola RTG", tone: "text-amber-600" },
  { key: "no_show", title: "No-show do odzyskania", tone: "text-red-600" }, { key: "new_patient", title: "Nowi pacjenci", tone: "text-rose-600" },
]

export function PatientCareHome() {
  const { cases, tasks, patients, identities } = useScopedEntityStore()
  const { openCase } = useCasePanel()
  const segments = useMemo(() => SEGMENTS.map((segment) => ({ ...segment, cases: cases.filter((c) => c.status === segment.key) })), [cases])
  const active = tasks.filter((t) => !["completed", "cancelled", "failed"].includes(t.status) && cases.some((c) => c.id === t.caseId && (c.board === "patients" || ["post_visit", "recall", "care", "no_show"].includes(c.status))))
  const name = (caseId: string) => { const c = cases.find((item) => item.id === caseId); const p = patients.find((item) => item.id === c?.patientId); const i = identities.find((item) => item.id === c?.contactIdentityId); return p ? `${p.firstName} ${p.lastName}` : i?.displayName ?? "Nierozpoznany kontakt" }
  const primaryTask = (caseId: string) => tasks.filter((t) => t.caseId === caseId && !["completed", "cancelled", "failed"].includes(t.status)).sort((a,b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity))[0]
  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="rounded-lg border border-primary/30 bg-primary/[0.03] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Podsumowanie dnia</p><p className="mt-1.5 text-sm"><span className="font-semibold">{active.length}</span> aktywnych działań Patient Care wymaga realizacji.</p></section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{segments.map((s) => <div key={s.key} className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] font-medium text-muted-foreground">{s.title}</p><p className={cn("mt-1 text-xl font-semibold", s.tone)}>{s.cases.length}</p></div>)}</section>
    <div className="grid gap-4 lg:grid-cols-2">{segments.filter((s) => s.cases.length > 0).map((s) => <section key={s.key} className="rounded-lg border border-border bg-card"><div className="flex justify-between border-b border-border px-4 py-2.5"><h3 className="text-sm font-medium">{s.title}</h3><span className="text-xs text-muted-foreground">{s.cases.length}</span></div><div className="divide-y divide-border">{s.cases.map((c) => { const task = primaryTask(c.id); return <button key={c.id} onClick={() => openCase(c.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name(c.id)}</p><p className="truncate text-xs text-muted-foreground">{getClinic(c.clinicId)?.name ?? "Brak kliniki"} · {getProcedure(c.serviceInterest)?.name ?? "Brak usługi"}</p><p className="truncate text-xs">{task?.title ?? "Brak następnego działania"}</p></div><span className="text-xs text-muted-foreground">{task?.dueAt ? formatRelative(task.dueAt) : "—"}</span></button> })}</div></section>)}</div>
  </div>
}
