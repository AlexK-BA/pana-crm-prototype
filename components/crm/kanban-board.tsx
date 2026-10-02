"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react"
import type { CaseBoard } from "@/lib/crm/entities"
import { BOARD_COLUMNS, COLOR_CLASSES } from "@/lib/crm/boards"
import { CLINICS, DOCTORS, PROCEDURES } from "@/lib/crm/catalog"
import { getPatient, getIdentity } from "@/lib/crm/entity-data"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useRole } from "@/lib/crm/role-context"
import { useLanguage } from "@/lib/crm/language-context"
import { INITIAL_USERS } from "@/lib/crm/user-catalog"
import { EntityCaseCard } from "@/components/crm/entity-case-card"
import { useCasePanel } from "@/lib/crm/panel-context"
import { cn } from "@/lib/utils"
import type { DictionaryKey } from "@/lib/crm/language-context"
import { compareCaseWorkOrder } from "@/lib/crm/entity-queue"
import { getWorkflowStageRule } from "@/lib/crm/workflow-rules"
import { useAuthorization } from "@/lib/crm/authorization-context"

const BOARDS: { id: CaseBoard; labelKey: DictionaryKey }[] = [
  { id: "leads", labelKey: "board_lead" },
  { id: "deals", labelKey: "board_deal" },
  { id: "patients", labelKey: "board_patient_care" },
]

function formatDueIn(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} godz.`
  return `${Math.round(minutes / 1440)} dni`
}

export function KanbanBoard() {
  const [board, setBoard] = useState<CaseBoard>("leads")
  const [query, setQuery] = useState("")
  const [clinic, setClinic] = useState<string>("all")
  const [doctor, setDoctor] = useState<string>("all")
  const [service, setService] = useState<string>("all")
  const [assignee, setAssignee] = useState<string>("all")
  const [dragCaseId, setDragCaseId] = useState<string | null>(null)
  const [pendingTransition, setPendingTransition] = useState<{ caseId: string; newStatus: string } | null>(null)
  const [transitionReason, setTransitionReason] = useState("")
  const { cases, tasks, moveCase, currentUser } = useScopedEntityStore()
  const { openCase } = useCasePanel()
  const { role } = useRole()
  const { hasPermission } = useAuthorization()
  const { t } = useLanguage()
  const actorId = currentUser.id
  const canMoveCase = hasPermission("case:move")

  const activeFilterCount = [clinic, doctor, service, assignee].filter((v) => v !== "all").length

  const columns = BOARD_COLUMNS[board]

  const casesByColumn = useMemo(() => {
    const nowMs = Date.now()
    const filtered = cases.filter((c) => {
      if (c.board !== board) return false
      if (clinic !== "all" && c.clinicId !== clinic) return false
      if (doctor !== "all" && c.doctorId !== doctor) return false
      if (service !== "all" && c.serviceInterest !== service) return false
      if (assignee !== "all" && c.responsibleTeamId !== assignee) return false
      if (!query) return true
      const q = query.toLowerCase()
      const patient = getPatient(c.patientId)
      const identity = getIdentity(c.contactIdentityId)
      const name = patient ? `${patient.firstName} ${patient.lastName}` : ""
      return name.toLowerCase().includes(q) || identity?.value.toLowerCase().includes(q)
    })
    const map: Record<string, typeof filtered> = {}
    for (const col of columns) map[col.id] = []
    for (const c of filtered) {
      if (!map[c.status]) map[c.status] = []
      map[c.status].push(c)
    }
    for (const columnCases of Object.values(map)) {
      columnCases.sort((a, b) => compareCaseWorkOrder(a, b, tasks, nowMs))
    }
    return map
  }, [board, cases, tasks, columns, query, clinic, doctor, service, assignee])

  function handleDrop(columnId: string) {
    const engagementCase = cases.find((item) => item.id === dragCaseId)
    if (engagementCase && engagementCase.status !== columnId && canMoveCase) {
      setTransitionReason("")
      setPendingTransition({ caseId: engagementCase.id, newStatus: columnId })
    }
    setDragCaseId(null)
  }

  const transitionCase = pendingTransition ? cases.find((item) => item.id === pendingTransition.caseId) : undefined
  const transitionRule = transitionCase && pendingTransition
    ? getWorkflowStageRule(transitionCase.board, pendingTransition.newStatus)
    : undefined
  const fromLabel = transitionCase
    ? BOARD_COLUMNS[transitionCase.board].find((item) => item.id === transitionCase.status)?.label ?? transitionCase.status
    : ""
  const toLabel = transitionCase && pendingTransition
    ? BOARD_COLUMNS[transitionCase.board].find((item) => item.id === pendingTransition.newStatus)?.label ?? pendingTransition.newStatus
    : ""

  function confirmTransition() {
    if (!pendingTransition || !transitionCase || (transitionRule?.requiresReason && !transitionReason.trim())) return
    moveCase(pendingTransition.caseId, pendingTransition.newStatus, actorId, {
      reason: transitionReason.trim() || undefined,
      override: role === "admin",
    })
    setPendingTransition(null)
    setTransitionReason("")
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 md:px-6">
        <Tabs value={board} onValueChange={(v) => setBoard(v as CaseBoard)}>
          <TabsList>
            {BOARDS.map((b) => (
              <TabsTrigger key={b.id} value={b.id}>
                {t(b.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative ml-auto w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-56 space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Klinika</label>
              <Select value={clinic} onValueChange={(v) => setClinic(v ?? "all")}>
                <SelectTrigger className="h-8 w-full text-sm">
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
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Lekarz</label>
              <Select value={doctor} onValueChange={(v) => setDoctor(v ?? "all")}>
                <SelectTrigger className="h-8 w-full text-sm">
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
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Usługa</label>
              <Select value={service} onValueChange={(v) => setService(v ?? "all")}>
                <SelectTrigger className="h-8 w-full text-sm">
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
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Właściciel</label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v ?? "all")}>
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Właściciel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy właściciele</SelectItem>
                  {INITIAL_USERS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => {
                  setClinic("all")
                  setDoctor("all")
                  setService("all")
                  setAssignee("all")
                }}
              >
                Wyczyść filtry
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <div className="flex items-center rounded-md border border-input p-0.5">
          <Button variant="secondary" size="icon" className="h-7 w-7">
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-3 p-4 md:p-6">
          {columns.map((col) => {
            const colorClass = COLOR_CLASSES[col.color]
            const columnCases = casesByColumn[col.id] ?? []
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.id)}
                className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-muted/40"
              >
                <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2.5", colorClass.header)}>
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", colorClass.dot)} />
                    <span className="text-sm font-semibold text-foreground">{t(col.labelKey)}</span>
                    <span className="text-xs text-muted-foreground">({columnCases.length})</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3 pt-2">
                  {columnCases.map((c) => (
                    <EntityCaseCard
                      key={c.id}
                      engagementCase={c}
                      tasks={tasks.filter((t) => t.caseId === c.id)}
                      draggable={canMoveCase}
                      onDragStart={() => canMoveCase && setDragCaseId(c.id)}
                      onClick={() => openCase(c.id)}
                    />
                  ))}
                  {columnCases.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No cases
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={Boolean(pendingTransition)} onOpenChange={(open) => {
        if (!open) {
          setPendingTransition(null)
          setTransitionReason("")
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Potwierdź zmianę etapu</DialogTitle>
            <DialogDescription>
              Sprawa zostanie przeniesiona z etapu „{fromLabel}” do „{toLabel}”. Zmiana zostanie zapisana w historii aktywności.
            </DialogDescription>
          </DialogHeader>

          {transitionRule?.automaticTask && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Automatyczne następne działanie</p>
              <p className="mt-1 text-muted-foreground">{transitionRule.automaticTask.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Priorytet {transitionRule.automaticTask.priority} · termin za {formatDueIn(transitionRule.automaticTask.dueInMinutes)}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="transition-reason" className="text-sm font-medium">
              Powód zmiany {transitionRule?.requiresReason ? "*" : "(opcjonalnie)"}
            </label>
            <Textarea
              id="transition-reason"
              value={transitionReason}
              onChange={(event) => setTransitionReason(event.target.value)}
              placeholder={transitionRule?.requiresReason ? "Wpisz wymagany powód zmiany etapu" : "Dodaj kontekst dla historii aktywności"}
              className="min-h-20"
            />
          </div>

          {transitionRule?.terminal && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              To etap końcowy. Sprawa pozostanie widoczna w profilu pacjenta i raportach.
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingTransition(null)}>Anuluj</Button>
            <Button disabled={Boolean(transitionRule?.requiresReason && !transitionReason.trim())} onClick={confirmTransition}>
              Potwierdź zmianę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
