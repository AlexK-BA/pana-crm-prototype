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
import { StageTransitionDialog, type PendingStageTransition } from "@/components/crm/stage-transition-dialog"
import { EntityCaseCard } from "@/components/crm/entity-case-card"
import { useCasePanel } from "@/lib/crm/panel-context"
import { cn } from "@/lib/utils"
import type { DictionaryKey } from "@/lib/crm/language-context"
import { toLocalDateTime } from "./task-actions"
import { compareCaseWorkOrder, isActive } from "@/lib/crm/entity-queue"
import { TASK_TYPES } from "@/lib/crm/entity-store"
import { getWorkflowStageRule } from "@/lib/crm/workflow-rules"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { hasManualOrder, sortWithManualOrder } from "@/lib/crm/manual-order"
import { SortableColumn, SortableColumns, SortableItem } from "@/components/crm/sortable-columns"

const BOARDS: { id: CaseBoard; labelKey: DictionaryKey }[] = [
  { id: "leads", labelKey: "board_lead" },
  { id: "deals", labelKey: "board_deal" },
  { id: "patients", labelKey: "board_patient_care" },
]

const listKey = (board: CaseBoard, columnId: string) => `cases:${board}:${columnId}`

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
  const [pendingTransition, setPendingTransition] = useState<PendingStageTransition | null>(null)
  const { cases, tasks, patients, identities, moveCase, currentUser, manualOrder, saveManualOrder, clearManualOrder } = useScopedEntityStore()
  const { openCase } = useCasePanel()
  const { role } = useRole()
  const { hasPermission } = useAuthorization()
  const { t, tr } = useLanguage()
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
      const patient = patients.find(item=>item.id===c.patientId)
      const identity = identities.find(item=>item.id===c.contactIdentityId)
      const name = patient ? `${patient.firstName} ${patient.lastName}` : ""
      return name.toLowerCase().includes(q) || identity?.value.toLowerCase().includes(q)
    })
    const map: Record<string, typeof filtered> = {}
    for (const col of columns) map[col.id] = []
    for (const c of filtered) {
      if (!map[c.status]) map[c.status] = []
      map[c.status].push(c)
    }
    for (const [columnId, columnCases] of Object.entries(map)) {
      map[columnId] = sortWithManualOrder(columnCases, manualOrder[listKey(board, columnId)], item => item.id, (a, b) => compareCaseWorkOrder(a, b, tasks, nowMs))
    }
    return map
  }, [board, cases, patients, identities, tasks, columns, query, clinic, doctor, service, assignee, manualOrder])

  const reorderDisabled = activeFilterCount > 0 || query !== ""
  const boardHasManualOrder = hasManualOrder(manualOrder, listKey(board, ""))
  const columnIds = Object.fromEntries(Object.entries(casesByColumn).map(([columnId, items]) => [columnId, items.map(item => item.id)]))

  function handleMove(caseId: string, _from: string, columnId: string) {
    if (canMoveCase) setPendingTransition({ caseId, newStatus: columnId })
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

        <span className="ml-auto hidden text-xs text-muted-foreground xl:inline">
          {reorderDisabled
            ? tr("Zmiana kolejności jest wyłączona przy aktywnych filtrach.", "Изменение порядка отключено при активных фильтрах.")
            : tr("Przeciągnij uchwyt, aby zmienić kolejność kart. Priorytet i etap się nie zmieniają.", "Перетащите маркер, чтобы изменить порядок карточек. Приоритет и этап не меняются.")}
        </span>
        {boardHasManualOrder && (
          <Button variant="outline" size="sm" className="h-8" onClick={() => clearManualOrder(listKey(board, ""))}>
            {tr("Przywróć kolejność automatyczną", "Вернуть автоматический порядок")}
          </Button>
        )}
        <div className="relative w-56">
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
        <SortableColumns
          id={`board-${board}`}
          columns={columnIds}
          reorderDisabled={reorderDisabled}
          onReorder={(columnId, orderedIds) => saveManualOrder(listKey(board, columnId), orderedIds)}
          onMove={handleMove}
          renderOverlay={(caseId) => {
            const engagementCase = cases.find((item) => item.id === caseId)
            return engagementCase ? <EntityCaseCard engagementCase={engagementCase} tasks={tasks.filter((item) => item.caseId === caseId)} /> : null
          }}
        >
        <div className="flex h-full min-w-max gap-3 p-4 md:p-6">
          {columns.map((col) => {
            const colorClass = COLOR_CLASSES[col.color]
            const columnCases = casesByColumn[col.id] ?? []
            return (
              <SortableColumn
                key={col.id}
                columnId={col.id}
                ids={columnIds[col.id] ?? []}
                overClassName="ring-2 ring-primary/40"
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
                    <SortableItem key={c.id} id={c.id} handleLabel={tr("Zmień kolejność karty", "Изменить порядок карточки")}>
                      {(handle) => (
                        <div className="flex items-start gap-1">
                          <div className="pt-2">{handle}</div>
                          <div className="min-w-0 flex-1">
                            <EntityCaseCard
                              engagementCase={c}
                              tasks={tasks.filter((t) => t.caseId === c.id)}
                              onClick={() => openCase(c.id)}
                            />
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                  {columnCases.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No cases
                    </div>
                  )}
                </div>
              </SortableColumn>
            )
          })}
        </div>
        </SortableColumns>
      </div>

      <StageTransitionDialog pending={pendingTransition} onClose={() => setPendingTransition(null)} />
    </div>
  )
}
