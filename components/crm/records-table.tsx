"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Search, BookmarkPlus, X, MessageSquareText, Check } from "lucide-react"
import { getPatient, getIdentity } from "@/lib/crm/entity-data"
import { getClinic, getClinicTone, getProcedure, DOCTORS, PROCEDURES } from "@/lib/crm/catalog"
import { getOperator } from "@/lib/crm/entity-selectors"
import { BOARD_LABELS, BOARD_LABEL_KEYS, BOARD_COLUMNS } from "@/lib/crm/boards"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useRole } from "@/lib/crm/role-context"
import { useLanguage } from "@/lib/crm/language-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"
import { INITIAL_USERS } from "@/lib/crm/user-catalog"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import type { CaseBoard, ClinicId } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

interface SavedView {
  id: string
  name: string
  query: string
  board: CaseBoard | "all"
  clinic: string
  doctor: string
  service: string
  assignee: string
}

let savedViewSeq = 0

export function RecordsTable() {
  const [query, setQuery] = useState("")
  const [board, setBoard] = useState<CaseBoard | "all">("all")
  const [clinic, setClinic] = useState<string>("all")
  const [doctor, setDoctor] = useState<string>("all")
  const [service, setService] = useState<string>("all")
  const [assignee, setAssignee] = useState<string>("all")
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [viewName, setViewName] = useState("")
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastName, setBroadcastName] = useState("")
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [justSent, setJustSent] = useState(false)

  const { cases, tasks, broadcasts, sendBroadcast } = useScopedEntityStore()
  const { openCase } = useCasePanel()
  const { role } = useRole()
  const { t } = useLanguage()
  const meName = ROLE_PROFILES[role].user.name
  const actorId = INITIAL_USERS.find((o) => o.name === meName)?.id ?? "system"

  const clinics = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of cases) {
      const clinicRecord = getClinic(c.clinicId)
      if (clinicRecord) map.set(clinicRecord.id, clinicRecord.name)
    }
    return Array.from(map.entries())
  }, [cases])

  const doctors = useMemo(() => {
    const usedIds = new Set(cases.map((c) => c.doctorId).filter(Boolean))
    return DOCTORS.filter((d) => usedIds.has(d.id))
  }, [cases])

  const services = useMemo(() => {
    const usedIds = new Set(cases.map((c) => c.serviceInterest).filter(Boolean))
    return PROCEDURES.filter((p) => usedIds.has(p.id))
  }, [cases])

  const assignees = useMemo(() => {
    const usedIds = new Set(cases.map((c) => c.responsibleTeamId).filter(Boolean))
    return INITIAL_USERS.filter((o) => usedIds.has(o.id))
  }, [cases])

  const rows = useMemo(() => {
    return cases
      .filter((c) => board === "all" || c.board === board)
      .filter((c) => clinic === "all" || c.clinicId === clinic)
      .filter((c) => doctor === "all" || c.doctorId === doctor)
      .filter((c) => service === "all" || c.serviceInterest === service)
      .filter((c) => assignee === "all" || c.responsibleTeamId === assignee)
      .filter((c) => {
        if (!query) return true
        const q = query.toLowerCase()
        const patient = getPatient(c.patientId)
        const name = patient ? `${patient.firstName} ${patient.lastName}` : ""
        return (
          name.toLowerCase().includes(q) ||
          getIdentity(c.contactIdentityId)?.value.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [cases, board, clinic, doctor, service, assignee, query])

  function applyView(v: SavedView) {
    setQuery(v.query)
    setBoard(v.board)
    setClinic(v.clinic)
    setDoctor(v.doctor)
    setService(v.service)
    setAssignee(v.assignee)
  }

  function saveCurrentView() {
    if (!viewName.trim()) return
    savedViewSeq += 1
    setSavedViews((prev) => [
      ...prev,
      { id: `view-${savedViewSeq}`, name: viewName.trim(), query, board, clinic, doctor, service, assignee },
    ])
    setViewName("")
  }

  const audienceLabel = [
    board === "all" ? "wszystkie tablice" : BOARD_LABELS[board].split(" ·")[0],
    clinic === "all" ? "wszystkie kliniki" : clinics.find(([id]) => id === clinic)?.[1] ?? clinic,
    query ? `filtr "${query}"` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  function handleSendBroadcast() {
    if (!broadcastName.trim() || !broadcastMessage.trim()) return
    sendBroadcast({
      name: broadcastName.trim(),
      message: broadcastMessage.trim(),
      audienceLabel,
      clinicId: clinic === "all" ? undefined : (clinic as ClinicId),
      recipientCount: rows.length,
      createdBy: actorId,
    })
    setBroadcastOpen(false)
    setBroadcastName("")
    setBroadcastMessage("")
    setJustSent(true)
    setTimeout(() => setJustSent(false), 2500)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>

        <Select value={board} onValueChange={(v) => setBoard(v as CaseBoard | "all")}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder={t("board")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_boards")}</SelectItem>
            {Object.entries(BOARD_LABEL_KEYS).map(([id, key]) => (
              <SelectItem key={id} value={id}>
                {t(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={clinic} onValueChange={(v) => setClinic(v ?? "all")}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Klinika" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kliniki</SelectItem>
            {clinics.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
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
            {doctors.map((d) => (
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
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
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
            {assignees.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <BookmarkPlus className="h-3.5 w-3.5" />
                Zapisz widok
              </Button>
            }
          />
        
          <PopoverContent align="start" className="w-64 space-y-2">
            <p className="text-xs font-medium text-foreground">Nazwa widoku</p>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="np. Deale kliniki Centrum"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) saveCurrentView()
              }}
            />
            <Button size="sm" className="h-8 w-full" onClick={saveCurrentView} disabled={!viewName.trim()}>
              Zapisz filtry
            </Button>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setBroadcastOpen(true)}>
          {justSent ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <MessageSquareText className="h-3.5 w-3.5" />}
          {justSent ? "Wysłano" : "Kampania SMS"}
        </Button>

        <span className="ml-auto text-xs text-muted-foreground">{rows.length} rekordów</span>
      </div>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa kampania SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Odbiorcy: <span className="font-medium text-foreground">{rows.length}</span> kontaktów · {audienceLabel}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nazwa kampanii</label>
              <Input
                value={broadcastName}
                onChange={(e) => setBroadcastName(e.target.value)}
                placeholder="np. Przypomnienie o wizycie kontrolnej"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Treść wiadomości</label>
              <Textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Wpisz treść SMS..."
                className="min-h-24 text-sm"
                maxLength={480}
              />
              <p className="text-right text-[11px] text-muted-foreground">{broadcastMessage.length}/480</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Anuluj</Button>} />
            <Button onClick={handleSendBroadcast} disabled={!broadcastName.trim() || !broadcastMessage.trim()}>
              Wyślij do {rows.length} kontaktów
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-2 md:px-6">
          <span className="text-[11px] text-muted-foreground">Zapisane widoki:</span>
          {savedViews.map((v) => (
            <span key={v.id} className="flex items-center gap-1 rounded-full border border-border bg-background pl-2.5 pr-1 py-0.5 text-[11px]">
              <button onClick={() => applyView(v)} className="hover:underline">
                {v.name}
              </button>
              <button
                onClick={() => setSavedViews((prev) => prev.filter((sv) => sv.id !== v.id))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Usuń widok ${v.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium md:px-6">Kontakt / Pacjent</th>
              <th className="px-3 py-2 font-medium">Tablica</th>
              <th className="px-3 py-2 font-medium">Etap</th>
              <th className="px-3 py-2 font-medium">Klinika</th>
              <th className="px-3 py-2 font-medium">Usługa</th>
              <th className="px-3 py-2 font-medium">Właściciel</th>
              <th className="px-3 py-2 font-medium">Zadania</th>
              <th className="px-3 py-2 font-medium">Utworzono</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const patient = getPatient(c.patientId)
              const identity = getIdentity(c.contactIdentityId)
              const name = patient ? `${patient.firstName} ${patient.lastName}` : identity?.value ?? "Nierozpoznany kontakt"
              const clinicRecord = getClinic(c.clinicId)
              const tone = getClinicTone(c.clinicId)
              const procedure = getProcedure(c.serviceInterest)
              const owner = getOperator(c.responsibleTeamId)
              const statusLabel = BOARD_COLUMNS[c.board].find((col) => col.id === c.status)?.label ?? c.status
              const openTasks = tasks.filter((t) => t.caseId === c.id && t.status !== "completed" && t.status !== "cancelled").length

              return (
                <tr
                  key={c.id}
                  onClick={() => openCase(c.id)}
                  className="cursor-pointer border-b border-border/60 hover:bg-accent/50"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground md:px-6">
                    <span className={cn("mr-2 inline-block h-2 w-2 rounded-full align-middle", tone.dot)} aria-hidden="true" />
                    {name}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{t(BOARD_LABEL_KEYS[c.board])}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[11px]">
                      {statusLabel}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={cn("text-[11px]", tone.chip)}>
                      {clinicRecord?.name ?? "Nieprzypisano"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{procedure?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{owner?.name ?? "Nieprzypisane"}</td>
                  <td className={cn("px-3 py-2.5", openTasks > 0 ? "text-foreground" : "text-muted-foreground")}>{openTasks}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDateTime(c.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Brak rekordów dla wybranych filtrów.</div>
        )}
      </div>
    </div>
  )
}
