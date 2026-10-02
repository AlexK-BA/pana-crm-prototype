"use client"

import { useMemo, useState } from "react"
import { MessageSquare, Phone, Mail, Send, Share2, Globe, StickyNote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ConversationThread } from "@/components/crm/conversation-thread"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { formatRelative } from "@/lib/crm/format"
import type { ContactChannel } from "@/lib/crm/entities"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { cn } from "@/lib/utils"

const CHANNEL_ICON: Record<ContactChannel, typeof MessageSquare> = {
  phone: Phone,
  email: Mail,
  instagram: Share2,
  facebook: Share2,
  whatsapp: MessageSquare,
  telegram: Send,
  tiktok: Share2,
  viber: MessageSquare,
  website: Globe,
  personal_account: StickyNote,
}

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  phone: "Telefon / SMS",
  email: "E-mail",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  tiktok: "TikTok",
  viber: "Viber",
  website: "Czat WWW",
  personal_account: "Konto pacjenta",
}

export function PatientConversationWorkspace({
  patientId,
  currentCaseId,
  authorId,
  className,
  initialView,
  taskId,
}: {
  patientId?: string
  currentCaseId: string
  authorId?: string
  className?: string
  initialView?: "sms"
  taskId?: string
}) {
  const { hasPermission } = useAuthorization()
  const [smsHistory, setSmsHistory] = useState(initialView === "sms")
  const { cases, identities, interactions, readAt } = useScopedEntityStore()
  const patientCases = useMemo(() => {
    const scoped = patientId ? cases.filter((item) => item.patientId === patientId) : cases.filter((item) => item.id === currentCaseId)
    const withMeta = scoped.map((item) => {
      const messages = interactions.filter((interaction) => interaction.caseId === item.id && interaction.type !== "call")
      const lastMessage = messages.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
      const lastReadAt = readAt[item.id]
      const unread = messages.filter(
        (message) => message.direction === "incoming" && (!lastReadAt || new Date(message.at).getTime() > new Date(lastReadAt).getTime()),
      ).length
      return { item, lastMessage, unread }
    })
    return withMeta
      .sort((a, b) => new Date(b.lastMessage?.at ?? b.item.createdAt).getTime() - new Date(a.lastMessage?.at ?? a.item.createdAt).getTime())
      .map((entry) => entry.item)
  }, [cases, currentCaseId, interactions, patientId, readAt])
  const [selectedCaseId, setSelectedCaseId] = useState(currentCaseId)
  const activeCaseId = patientCases.some((item) => item.id === selectedCaseId) ? selectedCaseId : patientCases[0]?.id ?? currentCaseId

  if (!hasPermission("communication:view")) return <p className="p-4 text-sm">Brak dostępu do komunikacji.</p>

  return (
    <div className={cn("flex h-full min-h-0 overflow-hidden", className)}>
      <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-muted/20">
        <div className="border-b border-border px-3 py-3">
          <p className="text-sm font-semibold">Rozmowy z kontaktem</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {patientId ? "Wszystkie rozmowy powiązane z tym pacjentem." : "Kontakt nie jest jeszcze powiązany z pacjentem."}
          </p>
        </div>
        {patientId && <button type="button" onClick={() => setSmsHistory(true)} aria-pressed={smsHistory}
          className={cn("w-full border-b border-border px-3 py-3 text-left text-sm font-medium hover:bg-accent", smsHistory && "bg-accent")}>
          SMS · historia pacjenta
          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Wszystkie dostępne sprawy i SMS bez sprawy</span>
        </button>}
        {patientCases.map((item) => {
          const identity = identities.find((entry) => entry.id === item.contactIdentityId)
          const messages = interactions
            .filter((interaction) => interaction.caseId === item.id && interaction.type !== "call")
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          const lastMessage = messages[0]
          const lastReadAt = readAt[item.id]
          const unread = messages.filter(
            (message) => message.direction === "incoming" && (!lastReadAt || new Date(message.at).getTime() > new Date(lastReadAt).getTime()),
          ).length
          const channel = identity?.channel ?? "website"
          const Icon = CHANNEL_ICON[channel]
          const selected = !smsHistory && item.id === activeCaseId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setSelectedCaseId(item.id); setSmsHistory(false) }}
              className={cn("flex w-full items-start gap-2.5 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent", selected && "bg-accent")}
            >
              <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {unread > 0 && !selected && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-xs", unread > 0 ? "font-semibold" : "font-medium")}>{CHANNEL_LABEL[channel]}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{lastMessage ? formatRelative(lastMessage.at) : "—"}</span>
                    {unread > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {unread}
                      </span>
                    )}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{identity?.value ?? item.id}</span>
                <span className={cn("mt-1 block truncate text-[11px]", unread > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {lastMessage?.text ?? "Brak wiadomości"}
                </span>
              </span>
            </button>
          )
        })}
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="px-3 py-3 text-[11px] text-muted-foreground">
                TikTok <Badge variant="outline" className="ml-1 text-[9px]">Potencjalny</Badge>
              </div>
            }
          />
          <TooltipContent side="top">Integracja nie jest jeszcze podłączona</TooltipContent>
        </Tooltip>
      </aside>

      <div className="min-w-0 flex-1">
        <ConversationThread
          key={smsHistory ? `sms-${patientId}` : activeCaseId}
          caseIds={smsHistory ? patientCases.map((item) => item.id) : [activeCaseId]}
          primaryCaseId={activeCaseId}
          patientId={patientId}
          patientSmsHistory={smsHistory && Boolean(patientId)}
          taskId={taskId}
          authorId={authorId}
          className="h-full px-4 py-4"
          emptyLabel="Brak wiadomości w tej rozmowie."
        />
      </div>
    </div>
  )
}
