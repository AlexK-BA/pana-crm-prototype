"use client"

/**
 * Unified conversation surface: renders every text-like Interaction (chat,
 * WhatsApp, SMS, social, note) for one or many cases in a single thread and
 * lets an operator reply on any channel from the same composer — per the
 * "chat as a lead source, chat as a channel independent of the card"
 * requirement. Used standalone in Inbox, inside the case drawer, and
 * aggregated across all of a patient's cases in the Patient Profile.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, CheckCheck, CircleAlert, Clock3, Loader2, Phone, MessageSquare, StickyNote, Send, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import type { ContactChannel, InteractionType, SmsMessage } from "@/lib/crm/entities"
import { formatDateTime } from "@/lib/crm/format"
import { cn } from "@/lib/utils"
import { calculateSmsParts, getSmsStatusLabel, isSmsMessage, selectSmsProvider } from "@/lib/crm/sms-service"
import { useAuthorization } from "@/lib/crm/authorization-context"

const SEND_CHANNELS: { value: ContactChannel; label: string; potential?: boolean }[] = [
  { value: "website", label: "Czat" },
  { value: "phone", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "email", label: "E-mail" },
  { value: "tiktok", label: "TikTok", potential: true },
]

const CHANNEL_TYPE: Partial<Record<ContactChannel, InteractionType>> = {
  website: "chat", phone: "sms", whatsapp: "whatsapp", telegram: "social", instagram: "social", facebook: "social", email: "email", tiktok: "social",
}

const TYPE_ICON: Record<string, typeof MessageSquare> = {
  call: Phone,
  note: StickyNote,
  chat: MessageSquare,
  whatsapp: MessageSquare,
  sms: Smartphone,
  social: MessageSquare,
  email: MessageSquare,
}

const TYPE_LABEL: Record<string, string> = {
  chat: "Czat",
  whatsapp: "WhatsApp",
  sms: "SMS",
  social: "Social",
  email: "E-mail",
  telegram: "Telegram",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
}

/**
 * Canned patient replies for the chat emulation, so testing a conversation
 * doesn't require a second operator/browser. Picked loosely by keyword, with
 * a generic fallback — this is a demo simulator, not a real patient.
 */
const AUTO_REPLY_POOL = [
  "Dziękuję za informację, będę pamiętać o tym terminie.",
  "Ok, pasuje mi ten termin.",
  "Czy mogę prosić o inny termin, ten mi nie pasuje?",
  "Dobrze, do zobaczenia!",
  "Rozumiem, dziękuję za kontakt.",
]

function pickAutoReply(sentText: string): string {
  const lower = sentText.toLowerCase()
  if (lower.includes("wizyt") || lower.includes("termin")) {
    return Math.random() > 0.5 ? "Ok, pasuje mi ten termin." : "Czy mogę prosić o inny termin, ten mi nie pasuje?"
  }
  return AUTO_REPLY_POOL[Math.floor(Math.random() * AUTO_REPLY_POOL.length)]
}

export function ConversationThread({
  caseIds,
  primaryCaseId,
  patientId,
  authorId,
  className,
  emptyLabel = "Brak wiadomości w tej rozmowie.",
}: {
  /** All case ids whose messages should appear merged in this thread. */
  caseIds: string[]
  /** Which case a new outgoing message gets attached to (defaults to caseIds[0]). */
  primaryCaseId?: string
  patientId?: string
  authorId?: string
  className?: string
  emptyLabel?: string
}) {
  const { interactions, sendMessage, sendSms, markRead, cases, identities, smsProviderConfigurations } = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const [draft, setDraft] = useState("")
  const [channel, setChannel] = useState<ContactChannel>("website")
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, "sending" | "sent" | "error">>({})
  /** Demo-only control (UAT requirement): delivery must be deterministic by
   * default (sending → sent). Failures are never randomized — they only
   * happen when this toggle is explicitly turned on by the operator. */
  const [simulateError, setSimulateError] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const targetCaseId = primaryCaseId ?? caseIds[0]
  const targetCase = cases.find((item) => item.id === targetCaseId)
  const phoneIdentity = identities.find((item) => item.patientId === patientId && item.channel === "phone")
    ?? identities.find((item) => item.id === targetCase?.contactIdentityId && item.channel === "phone")
  const smsProvider = selectSmsProvider(smsProviderConfigurations, targetCase?.clinicId)
  const canSendMessage = hasPermission("communication:send")
  const canSendCustomSms = hasPermission("sms:send_custom")

  useEffect(() => {
    return () => {
      if (autoReplyTimer.current) clearTimeout(autoReplyTimer.current)
      Object.values(deliveryTimers.current).forEach(clearTimeout)
    }
  }, [])

  /** Emulates network delivery: brief "sending" state, then deterministically
   * "sent" — unless the operator has explicitly enabled "Symuluj błąd
   * wysyłki" for this test, in which case it deterministically fails so the
   * retry affordance has something to do. No randomness in the outcome. */
  function deliver(messageId: string, sentText: string, interactionType: InteractionType, sentChannel: ContactChannel) {
    setDeliveryStatus((prev) => ({ ...prev, [messageId]: "sending" }))
    if (deliveryTimers.current[messageId]) clearTimeout(deliveryTimers.current[messageId])
    deliveryTimers.current[messageId] = setTimeout(() => {
      const failed = simulateError
      setDeliveryStatus((prev) => ({ ...prev, [messageId]: failed ? "error" : "sent" }))
      if (!failed) {
        if (autoReplyTimer.current) clearTimeout(autoReplyTimer.current)
        autoReplyTimer.current = setTimeout(() => {
          sendMessage({ caseId: targetCaseId, patientId, text: pickAutoReply(sentText), type: interactionType, channel: sentChannel, direction: "incoming" })
        }, 1500)
      }
    }, 600)
  }

  const messages = useMemo(() => {
    const caseIdSet = new Set(caseIds)
    return interactions
      .filter((i) => i.type !== "call" && caseIdSet.has(i.caseId))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  }, [interactions, caseIds])

  useEffect(() => {
    if (targetCaseId) markRead(targetCaseId)
  }, [targetCaseId, markRead, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  function handleSend() {
    if (!draft.trim() || !targetCaseId) return
    const sentText = draft.trim()
    const interactionType = CHANNEL_TYPE[channel] ?? "chat"
    if (channel === "phone") {
      if (!phoneIdentity) return
      sendSms({
        caseId: targetCaseId,
        patientId,
        clinicId: targetCase?.clinicId,
        recipient: phoneIdentity.value,
        text: sentText,
        authorId,
      })
    } else {
      const sent = sendMessage({ caseId: targetCaseId, patientId, text: sentText, type: interactionType, channel, direction: "outgoing", authorId })
      deliver(sent.id, sentText, interactionType, channel)
    }
    setDraft("")
  }

  function handleRetry(m: (typeof messages)[number]) {
    if (isSmsMessage(m)) return
    deliver(m.id, m.text ?? "", m.type, m.channel ?? "website")
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>}
        {messages.map((m) => {
          const Icon = TYPE_ICON[m.type] ?? MessageSquare
          const incoming = m.direction !== "outgoing"
          const status = incoming ? undefined : deliveryStatus[m.id]
          return (
            <div key={m.id} className={cn("flex flex-col gap-1", incoming ? "items-start" : "items-end")}>
              <div className={cn("flex items-end gap-2", incoming ? "justify-start" : "justify-end")}>
                {incoming && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    incoming ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
                    status === "error" && "opacity-70",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <div className={cn("mt-1 flex flex-wrap items-center gap-1 text-[10px]", incoming ? "text-muted-foreground" : "text-primary-foreground/70")}>
                    <span>{TYPE_LABEL[m.channel ?? m.type] ?? m.channel ?? m.type} · {formatDateTime(m.at)}</span>
                    {isSmsMessage(m) ? (
                      <SmsStatus message={m} />
                    ) : (
                      <>
                        {status === "sending" && <Loader2 className="h-2.5 w-2.5 animate-spin" aria-label="Wysyłanie" />}
                        {status === "sent" && <Check className="h-2.5 w-2.5" aria-label="Dostarczono" />}
                      </>
                    )}
                  </div>
                </div>
                {!incoming && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Icon className="h-3 w-3 text-primary" />
                  </span>
                )}
              </div>
              {status === "error" && !isSmsMessage(m) && (
                <div className="flex items-center gap-1.5 pr-8 text-[10px] text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Błąd wysyłki</span>
                  <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => handleRetry(m)}>
                    Spróbuj ponownie
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {channel === "phone" && (
        <div className="border-t border-border px-1 pt-2 text-[11px] text-muted-foreground">
          {phoneIdentity ? (
            <span>
              Do: <strong className="font-medium text-foreground">{phoneIdentity.value}</strong> · {smsProvider?.name ?? "Brak aktywnej konfiguracji"}
              {smsProvider && !smsProvider.capabilities.deliveryReports ? " · bez potwierdzenia dostarczenia" : ""}
              {draft ? ` · ${draft.length} znaków · ${calculateSmsParts(draft)} SMS` : ""}
            </span>
          ) : (
            <span className="text-destructive">Brak numeru telefonu. Uzupełnij profil pacjenta przed wysłaniem SMS.</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 pb-1.5 text-[11px] text-muted-foreground">
        <input
          id="simulate-send-error"
          type="checkbox"
          checked={simulateError}
          onChange={(e) => setSimulateError(e.target.checked)}
          className="h-3 w-3 accent-destructive"
        />
        <label htmlFor="simulate-send-error" className="cursor-pointer select-none">
          Symuluj błąd wysyłki (test UAT)
        </label>
      </div>
      <div className="flex items-end gap-2 border-t border-border pt-3">
        <Select value={channel} onValueChange={(v) => setChannel(v as ContactChannel)}>
          <SelectTrigger className="h-9 w-[150px] shrink-0 text-xs" aria-label="Kanał wysyłki">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEND_CHANNELS.map((c) =>
              c.potential ? (
                <Tooltip key={c.value}>
                  <TooltipTrigger
                    render={
                      <span>
                        <SelectItem value={c.value} disabled>
                          {c.label} · Potencjalny
                        </SelectItem>
                      </span>
                    }
                  />
                  <TooltipContent side="right">Integracja nie jest jeszcze podłączona</TooltipContent>
                </Tooltip>
              ) : (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Napisz wiadomość..."
          rows={1}
          className="min-h-9 flex-1 resize-none text-sm"
          disabled={!canSendMessage || (channel === "phone" && !canSendCustomSms)}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={!draft.trim() || !canSendMessage || (channel === "phone" && (!canSendCustomSms || !phoneIdentity || !smsProvider))} aria-label="Wyślij">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SmsStatus({ message }: { message: SmsMessage }) {
  const Icon = message.deliveryStatus === "delivered"
    ? CheckCheck
    : message.deliveryStatus === "submitted"
      ? Check
      : message.deliveryStatus === "failed" || message.deliveryStatus === "undelivered"
        ? CircleAlert
        : Clock3
  return (
    <span className="inline-flex items-center gap-0.5" title={message.errorMessage ?? message.providerStatus}>
      <Icon className="h-3 w-3" />
      {getSmsStatusLabel(message)} · {message.providerType}
    </span>
  )
}
