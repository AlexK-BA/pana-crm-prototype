"use client"

import { Phone, MessageSquare, CheckSquare, Clock } from "lucide-react"
import type { CrmCase } from "@/lib/crm/types"
import { ChannelIcon } from "@/components/crm/channel-icon"
import { formatRelative } from "@/lib/crm/format"
import { useCasePanel } from "@/lib/crm/panel-context"
import { cn } from "@/lib/utils"

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "",
  low: "",
}

export function CaseCard({ crmCase }: { crmCase: CrmCase }) {
  const { openCase } = useCasePanel()
  const openTasks = crmCase.tasks.filter((t) => !t.done).length

  return (
    <button
      onClick={() => openCase(crmCase.id)}
      className="group flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <ChannelIcon platform={crmCase.channelPlatform} className="mt-0.5 h-6 w-6" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {crmCase.priority !== "normal" && crmCase.priority !== "low" && (
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[crmCase.priority])} />
            )}
            <p className="truncate text-sm font-medium text-foreground">{crmCase.displayName}</p>
          </div>
          {crmCase.phone && <p className="truncate text-xs text-muted-foreground">{crmCase.phone}</p>}
        </div>
        {!!crmCase.unread && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
            {crmCase.unread}
          </span>
        )}
      </div>

      {crmCase.lastMessage && (
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{crmCase.lastMessage}</p>
      )}

      {crmCase.service && (
        <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {crmCase.service}
        </span>
      )}

      <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1" suppressHydrationWarning>
          <Clock className="h-3 w-3" />
          {formatRelative(crmCase.lastActivityAt)}
        </span>
        <div className="flex items-center gap-2.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Phone className="h-3.5 w-3.5" />
          <MessageSquare className="h-3.5 w-3.5" />
          {openTasks > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare className="h-3.5 w-3.5" />
              {openTasks}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
