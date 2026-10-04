"use client"

import { useEffect, useState } from "react"
import type { DragEvent } from "react"
import { Phone, MessageSquare, StickyNote, Share2, Clock, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { EngagementCase, Task } from "@/lib/crm/entities"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { getClinic, getClinicTone, getProcedure, getDoctor } from "@/lib/crm/catalog"
import { PRIORITY_TONE } from "@/lib/crm/entity-selectors"
import { priorityText } from "@/lib/crm/display-labels"
import { formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"
import { getCaseWorkState, getNextTaskForCase } from "@/lib/crm/entity-queue"
import { useLanguage } from "@/lib/crm/language-context"

const CHANNEL_ICON: Record<string, typeof Phone> = {
  phone: Phone,
  email: MessageSquare,
  whatsapp: MessageSquare,
  telegram: MessageSquare,
  viber: MessageSquare,
  instagram: Share2,
  facebook: Share2,
  website: Share2,
  personal_account: StickyNote,
}

/**
 * Deterministic on the server and on the initial client render (always false),
 * then corrected once mounted. Comparing against Date.now() directly during
 * render would differ between SSR and hydration and trigger a mismatch.
 */
function useIsOverdue(dueAt: string | undefined) {
  const [overdue, setOverdue] = useState(false)
  useEffect(() => {
    if (!dueAt) return
    const dueTime = new Date(dueAt).getTime()
    const update = () => setOverdue(Date.now() >= dueTime)
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [dueAt])
  return overdue
}

/** Unified kanban card shared by every board, per master spec §8 required-field checklist. */
export function EntityCaseCard({
  engagementCase,
  tasks,
  draggable,
  onDragStart,
  onClick,
}: {
  engagementCase: EngagementCase
  tasks?: Task[]
  draggable?: boolean
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void
  onClick?: () => void
}) {
  const store=useScopedEntityStore()
  const { tr, language } = useLanguage()
  const {users}=useUserDirectory()
  const patient = store.patients.find(item=>item.id===engagementCase.patientId)
  const identity = store.identities.find(item=>item.id===engagementCase.contactIdentityId)
  const clinic = getClinic(engagementCase.clinicId)
  const tone = getClinicTone(engagementCase.clinicId)
  const procedure = getProcedure(engagementCase.serviceInterest)
  const doctor = getDoctor(engagementCase.doctorId)
  const caseTasks = tasks ?? store.tasks
  const work=getCaseWorkState(engagementCase,caseTasks)
  const openTask = getNextTaskForCase(caseTasks, engagementCase.id)
  const owner = users.find(user=>user.id===openTask?.ownerId)
  const overdue = useIsOverdue(openTask?.dueAt)
  const ChannelIcon = CHANNEL_ICON[identity?.channel ?? ""] ?? StickyNote

  const name = patient ? `${patient.firstName} ${patient.lastName}` : tr("Nierozpoznany kontakt", "Неопознанный контакт")

  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="flex w-full items-stretch overflow-hidden rounded-md border border-border bg-card text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-secondary/30"
    >
      <span className={cn("w-1 shrink-0", tone.bar)} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">{name}</p>
          {openTask && (
            <span
              className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white", PRIORITY_TONE[openTask.priority])}
              title={priorityText(openTask.priority, language)}
            >
              {openTask.priority}
            </span>
          )}
        </div>

        <div className="space-y-0.5 text-xs">
          {work.previousCompletedTask && <p className="truncate text-muted-foreground">{tr("Ostatnio", "Последнее действие")}: {work.previousCompletedTask.title}</p>}
          {openTask?.currentWorkerId && <p className="truncate text-sky-700">{tr("Aktualnie pracuje", "Сейчас работает")}: {users.find(user=>user.id===openTask.currentWorkerId)?.name ?? tr("inny konsultant", "другой сотрудник")}</p>}
          {work.activeTaskCount > 1 && <p className="text-muted-foreground">{tr("Pozostałe aktywne zadania", "Другие активные задачи")}: {work.activeTaskCount - 1}</p>}
        </div>
        {work.missingNextAction&&<p className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{tr("Brak następnego działania — wymaga decyzji", "Нет следующего действия — требуется решение")}</p>}
        <p className="truncate text-xs text-muted-foreground">
          {clinic ? (
            <span className={cn("mr-1 inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium", tone.chip)}>
              {clinic.name}
            </span>
          ) : (
            <span className={cn("mr-1 inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium", tone.chip)}>
              {tr("Klinika nieprzypisana", "Клиника не назначена")}
            </span>
          )}
          {procedure?.name ?? tr("Brak usługi", "Без услуги")}
          {doctor ? ` · ${doctor.name}` : ""}
        </p>

        {identity && (
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <ChannelIcon className="h-3 w-3 shrink-0" />
            {identity.value}
          </p>
        )}

        {openTask && (
          <div className="flex items-center gap-1.5 rounded bg-muted/40 px-2 py-1.5 text-xs text-foreground">
            {overdue
              ? <AlertCircle className="h-3 w-3 shrink-0 text-red-600" aria-hidden="true" suppressHydrationWarning />
              : <Clock className="h-3 w-3 shrink-0" aria-hidden="true" suppressHydrationWarning />}
            <span className="min-w-0 truncate"><span className="text-muted-foreground">{tr("Dalej", "Далее")}:</span> {openTask.title}</span>
            {openTask.dueAt && (
              <span className={cn("shrink-0", overdue ? "font-medium text-red-600" : "text-muted-foreground")} suppressHydrationWarning>
                {overdue && <span className="sr-only">{tr("Po terminie: ", "Просрочено: ")}</span>}
                {formatRelative(openTask.dueAt, language)}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback className="text-[10px]">{owner ? owner.initials : "—"}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{owner?.name ?? tr("Nieprzypisane", "Не назначено")}</span>
          </div>
          {patient && (patient.integrationState === "conflict" || patient.integrationState === "sync_failed") && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
              {patient.integrationState === "conflict"
                ? tr("Konflikt danych", "Конфликт данных")
                : tr("Błąd synchronizacji", "Ошибка синхронизации")}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
