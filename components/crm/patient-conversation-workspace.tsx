"use client"

import { useMemo, useState } from "react"
import { MessageSquare, Phone, Mail, Send, Share2, Globe, StickyNote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ConversationThread } from "@/components/crm/conversation-thread"
import { useEntityStore } from "@/lib/crm/entity-store"
import { formatRelative } from "@/lib/crm/format"
import type { ContactChannel } from "@/lib/crm/entities"
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
}: {
  patientId?: string
  currentCaseId: string
  authorId?: string
  className?: string
}) {
  const { cases, identities, interactions } = useEntityStore()
  const patientCases = useMemo(
    () => patientId ? cases.filter((item) => item.patientId === patientId) : cases.filter((item) => item.id === currentCaseId),
    [cases, currentCaseId, patientId],
  )
  const [selectedCaseId, setSelectedCaseId] = useState(currentCaseId)
  const activeCaseId = patientCases.some((item) => item.id === selectedCaseId) ? selectedCaseId : patientCases[0]?.id ?? currentCaseId

  return (
    <div className={cn("flex h-full min-h-0 overflow-hidden", className)}>
      <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-muted/20">
        <div className="border-b border-border px-3 py-3">
          <p className="text-sm font-semibold">Rozmowy z kontaktem</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {patientId ? "Wszystkie rozmowy powiązane z tym pacjentem." : "Kontakt nie jest jeszcze powiązany z pacjentem."}
          </p>
        </div>
        {patientCases.map((item) => {
          const identity = identities.find((entry) => entry.id === item.contactIdentityId)
          const messages = interactions
            .filter((interaction) => interaction.caseId === item.id && interaction.type !== "call")
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          const lastMessage = messages[0]
          const channel = identity?.channel ?? "website"
          const Icon = CHANNEL_ICON[channel]
          const selected = item.id === activeCaseId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedCaseId(item.id)}
              className={cn("flex w-full items-start gap-2.5 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent", selected && "bg-accent")}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{CHANNEL_LABEL[channel]}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{lastMessage ? formatRelative(lastMessage.at) : "—"}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{identity?.value ?? item.id}</span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">{lastMessage?.text ?? "Brak wiadomości"}</span>
              </span>
            </button>
          )
        })}
        <div className="px-3 py-3 text-[11px] text-muted-foreground">
          TikTok <Badge variant="outline" className="ml-1 text-[9px]">Potencjalny</Badge>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <ConversationThread
          key={activeCaseId}
          caseIds={[activeCaseId]}
          primaryCaseId={activeCaseId}
          patientId={patientId}
          authorId={authorId}
          className="h-full px-4 py-4"
          emptyLabel="Brak wiadomości w tej rozmowie."
        />
      </div>
    </div>
  )
}
