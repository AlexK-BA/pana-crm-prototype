"use client"

import { useEffect, useState } from "react"
import type { DragEvent } from "react"
import { Phone, MessageSquare, StickyNote, Share2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { EngagementCase, Task } from "@/lib/crm/entities"
import { getPatient, getIdentity, getTasksForCase } from "@/lib/crm/entity-data"
import { getClinic, getClinicTone, getProcedure, getDoctor } from "@/lib/crm/catalog"
import { getOperator, PRIORITY_TONE, priorityLabel } from "@/lib/crm/entity-selectors"
import { formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

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
  const patient = getPatient(engagementCase.patientId)
  const identity = getIdentity(engagementCase.contactIdentityId)
  const clinic = getClinic(engagementCase.clinicId)
  const tone = getClinicTone(engagementCase.clinicId)
  const procedure = getProcedure(engagementCase.serviceInterest)
  const doctor = getDoctor(engagementCase.doctorId)
  const caseTasks = tasks ?? getTasksForCase(engagementCase.id)
  const openTask = caseTasks.find((t) => t.status !== "completed" && t.status !== "cancelled")
  const owner = openTask ? getOperator(openTask.ownerId) : undefined
  const overdue = useIsOverdue(openTask?.dueAt)
  const ChannelIcon = CHANNEL_ICON[identity?.channel ?? ""] ?? StickyNote

  const name = patient ? `${patient.firstName} ${patient.lastName}` : "Nierozpoznany kontakt"
  const initials = patient ? `${patient.firstName[0]}${patient.lastName[0]}` : "NK"

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
              title={priorityLabel(openTask.priority)}
            >
              {openTask.priority}
            </span>
          )}
        </div>

        <p className="truncate text-xs text-muted-foreground">
          {clinic ? (
            <span className={cn("mr-1 inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium", tone.chip)}>
              {clinic.name}
            </span>
          ) : (
            <span className={cn("mr-1 inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium", tone.chip)}>
              Klinika nieprzypisana
            </span>
          )}
          {procedure?.name ?? "Brak usługi"}
          {doctor ? ` · ${doctor.name}` : ""}
        </p>

        {identity && (
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <ChannelIcon className="h-3 w-3 shrink-0" />
            {identity.value}
          </p>
        )}

        {openTask && (
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <Clock className={cn("h-3 w-3 shrink-0", overdue && "text-red-600")} suppressHydrationWarning />
            <span className="min-w-0 truncate">{openTask.title}</span>
            {openTask.dueAt && (
              <span className={cn("shrink-0", overdue ? "font-medium text-red-600" : "text-muted-foreground")} suppressHydrationWarning>
                {formatRelative(openTask.dueAt)}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback className="text-[10px]">{owner ? owner.initials : "—"}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{owner?.name ?? "Nieprzypisane"}</span>
          </div>
          {patient && (
            <Badge variant="outline" className="text-[10px]">
              {patient.integrationState === "linked"
                ? "Powiązano"
                : patient.integrationState === "conflict"
                  ? "Konflikt"
                  : patient.integrationState === "sync_failed"
                    ? "Błąd synchronizacji"
                    : "Oczekuje"}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
