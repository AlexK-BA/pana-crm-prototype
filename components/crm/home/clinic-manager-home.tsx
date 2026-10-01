"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BOARD_COLUMNS } from "@/lib/crm/boards"
import { CLINICS, getDoctor, getProcedure } from "@/lib/crm/catalog"
import { useEntityStore } from "@/lib/crm/entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { formatRelative } from "@/lib/crm/format"
import type { ClinicId } from "@/lib/crm/entities"

export function ClinicManagerHome() {
  const { openCase } = useCasePanel()
  const { cases, tasks, patients, identities } = useEntityStore()
  const [clinicId, setClinicId] = useState<ClinicId>("pana-medica")
  const clinicCases = useMemo(() => cases.filter((c) => c.clinicId === clinicId), [cases, clinicId])
  const activeTasks = useMemo(() => tasks.filter((t) => clinicCases.some((c) => c.id === t.caseId) && !["completed", "cancelled", "failed"].includes(t.status)), [tasks, clinicCases])
  const overdue = activeTasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now())
  const upcoming = [...activeTasks].filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= Date.now()).sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
  const doctorLoad = new Map<string, number>()
  const serviceLoad = new Map<string, number>()
  clinicCases.forEach((c) => { if (c.doctorId) doctorLoad.set(c.doctorId, (doctorLoad.get(c.doctorId) ?? 0) + 1); if (c.serviceInterest) serviceLoad.set(c.serviceInterest, (serviceLoad.get(c.serviceInterest) ?? 0) + 1) })
  const stages = BOARD_COLUMNS.patients.map((stage) => ({ ...stage, count: clinicCases.filter((c) => c.board === "patients" && c.status === stage.id).length }))
  const caseName = (caseId: string) => { const c = cases.find((item) => item.id === caseId); const p = patients.find((item) => item.id === c?.patientId); const i = identities.find((item) => item.id === c?.contactIdentityId); return p ? `${p.firstName} ${p.lastName}` : i?.displayName ?? "Nierozpoznany kontakt" }

  return <div className="mx-auto max-w-6xl space-y-6">
    <Tabs value={clinicId} onValueChange={(value) => setClinicId(value as ClinicId)}><TabsList>{CLINICS.map((clinic) => <TabsTrigger key={clinic.id} value={clinic.id}>{clinic.name}</TabsTrigger>)}</TabsList></Tabs>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Aktywne sprawy" value={clinicCases.filter((c) => !["closed", "completed", "complete"].includes(c.status)).length} /><Stat label="Aktywne zadania" value={activeTasks.length} /><Stat label="Przeterminowane" value={overdue.length} accent={overdue.length > 0} /><Stat label="Nadchodzące działania" value={upcoming.length} /></section>
    <div className="grid gap-4 lg:grid-cols-2"><MetricList title="Obciążenie lekarzy" rows={[...doctorLoad.entries()].map(([id, count]) => [getDoctor(id)?.name ?? id, count])} /><MetricList title="Procedury / usługi" rows={[...serviceLoad.entries()].map(([id, count]) => [getProcedure(id)?.name ?? id, count])} /></div>
    <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h3 className="text-sm font-medium">Ścieżka pacjenta w klinice</h3></div><div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-6">{stages.map((stage) => <div key={stage.id} className="rounded-md border border-border p-2.5"><p className="text-[11px] font-medium text-muted-foreground">{stage.label}</p><p className="mt-1 text-lg font-semibold">{stage.count}</p></div>)}</div></section>
    <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h3 className="text-sm font-medium">Najbliższe działania</h3></div><div className="divide-y divide-border">{upcoming.slice(0, 8).map((task) => <button key={task.id} onClick={() => openCase(task.caseId)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40"><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">{task.priority}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{caseName(task.caseId)}</p><p className="truncate text-xs text-muted-foreground">{task.title}</p></div><span className="text-xs text-muted-foreground">{task.dueAt ? formatRelative(task.dueAt) : "—"}</span></button>)}{upcoming.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Brak zaplanowanych działań.</p>}</div></section>
  </div>
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) { return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold ${accent ? "text-red-600" : ""}`}>{value}</p></div> }
function MetricList({ title, rows }: { title: string; rows: [string, number][] }) { return <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h3 className="text-sm font-medium">{title}</h3></div><div className="divide-y divide-border">{rows.sort((a, b) => b[1] - a[1]).map(([label, count]) => <div key={label} className="flex justify-between px-4 py-2.5 text-sm"><span>{label}</span><span className="text-xs text-muted-foreground">{count} spraw</span></div>)}{rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Brak danych.</p>}</div></section> }
