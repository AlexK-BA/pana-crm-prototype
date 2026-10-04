"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { TaskType } from "@/lib/crm/entities"
import { BOARD_COLUMNS } from "@/lib/crm/boards"
import { TASK_TYPES } from "@/lib/crm/entity-store"
import { isActive } from "@/lib/crm/entity-queue"
import { getWorkflowStageRule } from "@/lib/crm/workflow-rules"
import { taskTypeLabel } from "@/lib/crm/task-type-labels"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useLanguage } from "@/lib/crm/language-context"
import { formatDateTime } from "@/lib/crm/format"

export interface PendingStageTransition { caseId: string; newStatus: string }

function formatDueIn(minutes: number, tr: (pl: string, ru: string) => string) {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} ${tr("godz.", "ч")}`
  return `${Math.round(minutes / 1440)} ${tr("dni", "дн.")}`
}

/** Remount with a new `key` per transition so form state is always fresh. */
export function StageTransitionDialog({ pending, onClose }: { pending: PendingStageTransition | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(pending)} onOpenChange={open => { if (!open) onClose() }}>
      {pending && <TransitionForm key={`${pending.caseId}/${pending.newStatus}`} pending={pending} onClose={onClose} />}
    </Dialog>
  )
}

function TransitionForm({ pending, onClose }: { pending: PendingStageTransition; onClose: () => void }) {
  const { cases, tasks, moveCase, currentUser } = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { users } = useUserDirectory()
  const { tr, t, locale, language } = useLanguage()
  const [reason, setReason] = useState("")
  const [commentOpen, setCommentOpen] = useState(false)
  const [due, setDue] = useState("")
  const [activeDecision, setActiveDecision] = useState<"keep" | "cancel">("keep")
  const [advanced, setAdvanced] = useState({ override: false, skipAutomatic: false, allowPast: false, taskType: "", ownerId: "", title: "", description: "" })
  const [error, setError] = useState("")

  const engagementCase = cases.find(item => item.id === pending.caseId)
  const rule = engagementCase ? getWorkflowStageRule(engagementCase.board, pending.newStatus) : undefined
  const columns = engagementCase ? BOARD_COLUMNS[engagementCase.board] : []
  const label = (id?: string) => { const column = columns.find(item => item.id === id); return column ? t(column.labelKey) : id ?? "" }
  const activeTasks = useMemo(() => tasks.filter(task => task.caseId === pending.caseId && isActive(task)), [tasks, pending.caseId])
  const canAssign = hasPermission("task:assign")
  const automatic = rule?.automaticTask
  const needsExplicitDate = Boolean(!rule?.terminal && !advanced.skipAutomatic && (advanced.taskType || (automatic && automatic.duePolicy !== "sla")))
  const reasonRequired = Boolean(rule?.requiresReason || activeDecision === "cancel" || advanced.override || advanced.skipAutomatic)
  const nextType = (advanced.taskType || automatic?.type) as TaskType | undefined
  const nextTitle = nextType ? taskTypeLabel(nextType, language) : automatic?.title
  const customTitleInvalid = advanced.taskType === "custom" && !advanced.title.trim()
  const customDescriptionInvalid = advanced.taskType === "custom" && !advanced.description.trim()
  const customTaskInvalid = customTitleInvalid || customDescriptionInvalid
  const blocked = (reasonRequired && !reason.trim()) || (needsExplicitDate && !due) || customTaskInvalid

  function confirm() {
    if (blocked) return
    try {
      moveCase(pending.caseId, pending.newStatus, currentUser.id, {
        reason: reason.trim(), override: advanced.override || advanced.skipAutomatic, skipAutomatic: advanced.skipAutomatic, allowPast: advanced.allowPast,
        taskTitle: advanced.title.trim() || undefined, taskDescription: advanced.description.trim() || undefined,
        activeTaskDecision: activeDecision, dueAt: due || undefined,
        taskType: advanced.taskType ? advanced.taskType as TaskType : undefined, ownerId: advanced.ownerId || undefined,
      })
      onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Przejście zablokowane.", "Переход заблокирован.")) }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{tr("Zmiana etapu", "Смена этапа")}</DialogTitle>
        <DialogDescription>{label(engagementCase?.status)} → <strong>{label(pending.newStatus)}</strong></DialogDescription>
      </DialogHeader>

      {rule?.terminal ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{tr("To etap końcowy: nie powstanie nowe zadanie. Sprawa pozostanie w profilu pacjenta i raportach.", "Это конечный этап: новая задача не создаётся. Дело останется в профиле пациента и отчётах.")}</p>
      ) : (
        <section className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm" aria-label={tr("Następne działanie", "Следующее действие")}>
          <p className="text-xs text-muted-foreground">{tr("Następne działanie", "Следующее действие")}</p>
          <p className="font-medium">{advanced.skipAutomatic ? tr("Brak — pominięte przez administratora", "Нет — пропущено администратором") : nextTitle ?? tr("Brak automatycznego zadania", "Нет автоматической задачи")}</p>
          {automatic && !advanced.skipAutomatic && <p className="text-xs text-muted-foreground">
            {tr("Priorytet", "Приоритет")} {automatic.priority} · {automatic.duePolicy === "sla" ? `${tr("termin za", "срок через")} ${formatDueIn(automatic.dueInMinutes, tr)}` : tr("termin ustawia pracownik", "срок задаёт сотрудник")}
            {automatic.requiresCall || advanced.taskType === "call" ? ` · ${tr("wymaga połączenia", "требует звонка")}` : ""}
          </p>}
          {needsExplicitDate && <label className="mt-2 block text-xs font-medium">{tr("Termin zadania *", "Срок задачи *")}
            <Input type="datetime-local" value={due} onChange={event => setDue(event.target.value)} className="mt-1" />
          </label>}
        </section>
      )}

      {activeTasks.length > 0 && (
        <fieldset className="space-y-2 rounded-md border p-3 text-sm">
          <legend className="px-1 text-xs text-muted-foreground">{tr("Aktywne zadania w sprawie", "Активные задачи по делу")}</legend>
          <ul className="space-y-1">{activeTasks.map(task => <li key={task.id} className="flex justify-between gap-2"><span className="truncate">{task.title}</span><span className="shrink-0 text-xs text-muted-foreground">{task.dueAt ? formatDateTime(task.dueAt, "Europe/Warsaw", locale) : tr("bez terminu", "без срока")}</span></li>)}</ul>
          <label className="flex items-center gap-2"><input type="radio" name="active-decision" checked={activeDecision === "keep"} onChange={() => setActiveDecision("keep")} />{tr("Zostaw aktywne zadania", "Оставить активные задачи")}</label>
          {canAssign && <label className="flex items-center gap-2"><input type="radio" name="active-decision" checked={activeDecision === "cancel"} onChange={() => setActiveDecision("cancel")} />{tr("Anuluj aktywne zadania (wymaga powodu)", "Отменить активные задачи (нужна причина)")}</label>}
        </fieldset>
      )}

      {(reasonRequired || commentOpen) && (
        <div className="space-y-1.5">
          <label htmlFor="transition-reason" className="text-sm font-medium">{tr("Powód", "Причина")} {reasonRequired ? "*" : ""}</label>
          <Textarea id="transition-reason" value={reason} onChange={event => setReason(event.target.value)} className="min-h-20" placeholder={tr("Wpisz powód zmiany", "Укажите причину изменения")} />
        </div>
      )}
      {!reasonRequired && !commentOpen && <button type="button" className="text-left text-xs underline" onClick={() => setCommentOpen(true)}>{tr("Dodaj komentarz do historii", "Добавить комментарий в историю")}</button>}

      {canAssign && (
        <details className="rounded-md border p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium">{tr("Szczegóły techniczne i override (administrator / TL)", "Технические детали и override (админ / TL)")}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">{tr("Reguła", "Правило")}: {automatic?.id ?? tr("brak", "нет")} · {tr("Automatyzacja zewnętrzna", "Внешняя автоматизация")}: {rule?.automationWorkflowKey ?? tr("niepodłączona (prototyp)", "не подключена (прототип)")}</p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={advanced.override} onChange={event => setAdvanced({ ...advanced, override: event.target.checked, taskType: "" })} />{tr("Ręczny override zadania (powód wymagany)", "Ручной override задачи (причина обязательна)")}</label>
            {!rule?.terminal && <label className="flex items-center gap-2"><input type="checkbox" checked={advanced.skipAutomatic} onChange={event => setAdvanced({ ...advanced, skipAutomatic: event.target.checked })} />{tr("Pomiń automatyczne zadanie (powód wymagany)", "Пропустить автоматическую задачу (причина обязательна)")}</label>}
            {!rule?.terminal && <>
              <label className="block text-xs">{tr("Typ zadania", "Тип задачи")}
                <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={advanced.taskType} onChange={event => setAdvanced({ ...advanced, taskType: event.target.value })}>
                  <option value="">{tr("Automatyczny", "Автоматический")}</option>
                  {(advanced.override ? TASK_TYPES : rule?.suggestedTasks ?? []).filter(type => type !== "send_treatment_plan" || hasPermission("patient:view_medical")).map(type => <option key={type} value={type}>{taskTypeLabel(type, language)}</option>)}
                </select>
              </label>
              <label className="block text-xs">{tr("Właściciel zadania", "Владелец задачи")}
                <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={advanced.ownerId} onChange={event => setAdvanced({ ...advanced, ownerId: event.target.value })}>
                  <option value="">{tr("Bieżący użytkownik", "Текущий пользователь")}</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </label>
              {advanced.taskType === "custom" && <>
                <label className="block text-xs">{tr("Tytuł zadania *", "Название задачи *")}<Input value={advanced.title} aria-invalid={customTitleInvalid} onChange={event => setAdvanced({ ...advanced, title: event.target.value })} className="mt-1" />
                  {customTitleInvalid && <span role="status" className="mt-1 block text-xs text-destructive">{tr("Zadanie indywidualne wymaga tytułu.", "Для индивидуальной задачи нужно название.")}</span>}
                </label>
                <label className="block text-xs">{tr("Opis zadania *", "Описание задачи *")}<Textarea value={advanced.description} aria-invalid={customDescriptionInvalid} onChange={event => setAdvanced({ ...advanced, description: event.target.value })} className="mt-1" />
                  {customDescriptionInvalid && <span role="status" className="mt-1 block text-xs text-destructive">{tr("Zadanie indywidualne wymaga opisu.", "Для индивидуальной задачи нужно описание.")}</span>}
                </label>
              </>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={advanced.allowPast} onChange={event => setAdvanced({ ...advanced, allowPast: event.target.checked })} />{tr("Dopuszczam termin w przeszłości", "Допускаю срок в прошлом")}</label>
            </>}
          </div>
        </details>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>{tr("Anuluj", "Отмена")}</Button>
        <Button disabled={blocked} onClick={confirm}>{tr("Potwierdź zmianę", "Подтвердить смену")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
