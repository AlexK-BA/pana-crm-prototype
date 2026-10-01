"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, PhoneCall, Clock } from "lucide-react"
import { getPatient, getIdentity } from "@/lib/crm/entity-data"
import { getClinic, getDoctor, getProcedure, CLINICS, DOCTORS, PROCEDURES } from "@/lib/crm/catalog"
import { getOperator } from "@/lib/crm/entity-selectors"
import { useEntityStore } from "@/lib/crm/entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useRole } from "@/lib/crm/role-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"
import { OPERATORS } from "@/lib/crm/data"
import { formatRelative, formatDateTime } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

export function WaitlistView() {
  const [query, setQuery] = useState("")
  const [clinic, setClinic] = useState<string>("all")
  const [doctor, setDoctor] = useState<string>("all")
  const [service, setService] = useState<string>("all")
  const [assignee, setAssignee] = useState<string>("all")
  const { cases, moveCase } = useEntityStore()
  const { openCase } = useCasePanel()
  const { role } = useRole()
  const actorId = OPERATORS.find((o) => o.name === ROLE_PROFILES[role].user.name)?.id ?? "system"

  const waitlisted = useMemo(() => {
    return cases
      .filter((c) => c.status === "waiting")
      .filter((c) => clinic === "all" || c.clinicId === clinic)
      .filter((c) => doctor === "all" || c.doctorId === doctor)
      .filter((c) => service === "all" || c.serviceInterest === service)
      .filter((c) => assignee === "all" || c.responsibleTeamId === assignee)
      .filter((c) => {
        if (!query) return true
        const q = query.toLowerCase()
        const patient = getPatient(c.patientId)
        const name = patient ? `${patient.firstName} ${patient.lastName}` : ""
        return name.toLowerCase().includes(q) || getIdentity(c.contactIdentityId)?.value.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [cases, query, clinic, doctor, service, assignee])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj pacjenta lub kontaktu..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        <Select value={clinic} onValueChange={(v) => setClinic(v ?? "all")}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Klinika" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kliniki</SelectItem>
            {CLINICS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={doctor} onValueChange={(v) => setDoctor(v ?? "all")}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Lekarz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy lekarze</SelectItem>
            {DOCTORS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={service} onValueChange={(v) => setService(v ?? "all")}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Usługa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie usługi</SelectItem>
            {PROCEDURES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assignee} onValueChange={(v) => setAssignee(v ?? "all")}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Właściciel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy właściciele</SelectItem>
            {OPERATORS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">{waitlisted.length} na liście oczekujących</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {waitlisted.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Lista oczekujących jest pusta.
          </div>
        ) : (
          <div className="space-y-2">
            {waitlisted.map((c) => {
              const patient = getPatient(c.patientId)
              const identity = getIdentity(c.contactIdentityId)
              const clinic = getClinic(c.clinicId)
              const procedure = getProcedure(c.serviceInterest)
              const doctor = getDoctor(c.doctorId)
              const owner = getOperator(c.responsibleTeamId)
              const name = patient ? `${patient.firstName} ${patient.lastName}` : identity?.value ?? "Nierozpoznany kontakt"

              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <button onClick={() => openCase(c.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground hover:underline">{name}</p>
                      <Badge variant="outline" className={cn("text-[10px]", `text-${clinic?.color}-700`)}>
                        {clinic?.name}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {procedure?.name ?? "Bez określonej usługi"}
                      {doctor ? ` · ${doctor.name}` : ""}
                    </p>
                  </button>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={formatDateTime(c.createdAt)}>
                    <Clock className="h-3.5 w-3.5" />
                    <span suppressHydrationWarning>Czeka od {formatRelative(c.createdAt).replace("in ", "")}</span>
                  </div>

                  <span className="text-xs text-muted-foreground">{owner?.name ?? "Nieprzypisane"}</span>

                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => moveCase(c.id, "call_later", actorId)}
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    Zaproponuj termin
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
