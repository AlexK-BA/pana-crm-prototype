"use client"

import { Progress } from "@/components/ui/progress"
import { useEntityStore } from "@/lib/crm/entity-store"
import { getProcedure } from "@/lib/crm/catalog"

export function MarketingHome() {
  // Aggregate-only demonstrator. Production receives a dedicated reporting
  // projection; Marketing never receives patient/contact rows from the API.
  const { cases } = useEntityStore()
  const converted = cases.filter((c) => ["converted", "completed", "complete"].includes(c.status))
  const bySource = new Map<string, { total: number; converted: number }>()
  const byService = new Map<string, number>()
  cases.forEach((c) => { const source = c.attribution.firstTouch.source || "Nieznane"; const row = bySource.get(source) ?? { total: 0, converted: 0 }; row.total += 1; if (converted.some((item) => item.id === c.id)) row.converted += 1; bySource.set(source, row); if (c.serviceInterest) byService.set(c.serviceInterest, (byService.get(c.serviceInterest) ?? 0) + 1) })
  const rate = cases.length ? Math.round(converted.length / cases.length * 100) : 0
  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="rounded-lg border border-primary/30 bg-primary/[0.03] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Widok tylko do odczytu</p><p className="mt-1.5 text-sm">Atrybucja i konwersja bez danych medycznych oraz danych kontaktowych pacjenta.</p></section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Łącznie spraw" value={cases.length} /><Stat label="Skonwertowane" value={converted.length} /><Stat label="Konwersja ogólna" value={`${rate}%`} /></section>
    <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h3 className="text-sm font-medium">Atrybucja źródeł — First Touch</h3></div><div className="space-y-4 p-4">{[...bySource.entries()].sort((a,b)=>b[1].total-a[1].total).map(([source, stats]) => { const sourceRate = Math.round(stats.converted / stats.total * 100); return <div key={source} className="space-y-1.5"><div className="flex justify-between text-sm"><span className="font-medium">{source}</span><span className="text-xs text-muted-foreground">{stats.converted}/{stats.total} · {sourceRate}%</span></div><Progress value={sourceRate} /></div>})}</div></section>
    <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h3 className="text-sm font-medium">Zapytania według usługi</h3></div><div className="divide-y divide-border">{[...byService.entries()].sort((a,b)=>b[1]-a[1]).map(([id,count]) => <div key={id} className="flex justify-between px-4 py-2.5 text-sm"><span>{getProcedure(id)?.name ?? id}</span><span className="text-xs text-muted-foreground">{count} zapytań</span></div>)}</div></section>
  </div>
}
function Stat({ label, value }: { label: string; value: number | string }) { return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
