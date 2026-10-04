"use client"

/**
 * Unified conversation surface: renders every text-like Interaction (chat,
 * WhatsApp, SMS, social, note) for one or many cases in a single thread and
 * lets an operator reply on any channel from the same composer — per the
 * "chat as a lead source, chat as a channel independent of the card"
 * requirement. Used standalone in Inbox, inside the case drawer, and
 * aggregated across all of a patient's cases in the Patient Profile.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useLanguage } from "@/lib/crm/language-context"
import { potentialChannelText, sendChannelText } from "@/lib/crm/display-labels"
import { AlertTriangle, Check, CheckCheck, CircleAlert, Clock3, Loader2, Paperclip, Phone, MessageSquare, StickyNote, Send, Smartphone, Smile, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import type { ContactChannel, InteractionType, SmsMessage } from "@/lib/crm/entities"
import { formatDateTime } from "@/lib/crm/format"
import { cn } from "@/lib/utils"
import { calculateSmsParts, getDefaultSmsText, getSmsStatusLabel, isSmsMessage, selectSmsProvider } from "@/lib/crm/sms-service"
import { useCasePanel } from "@/lib/crm/panel-context"
import { getNextTaskForCase } from "@/lib/crm/entity-queue"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { isBotInteraction } from "@/lib/crm/conversation-control"

const SEND_CHANNELS: { value: ContactChannel; potential?: boolean }[] = [
  { value: "website" },
  { value: "phone" },
  { value: "whatsapp" },
  { value: "telegram" },
  { value: "instagram" },
  { value: "facebook" },
  { value: "email" },
  { value: "tiktok", potential: true },
]

const EMOJIS = ["😊", "👍", "🙏", "😀", "😉", "❤️", "👋", "✅", "📅", "🦷", "😁", "🙂", "👌", "🎉", "😢", "🤝", "⏰", "📞", "✨", "💬"]
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
  patientSmsHistory = false,
  taskId,
  threadChannel, threadIdentityId, threadKey, messageIds, highlight, operatorCanReply = true, replyBlockedReason,
}: {
  /** Search term from the inbox; matching messages get a visible marker. */
  highlight?: string
  /** All case ids whose messages should appear merged in this thread. */
  caseIds: string[]
  /** Which case a new outgoing message gets attached to (defaults to caseIds[0]). */
  primaryCaseId?: string
  patientId?: string
  authorId?: string
  className?: string
  emptyLabel?: string
  /** Patient-level SMS projection of the same interactions, with optional case binding. */
  patientSmsHistory?: boolean
  taskId?: string
  threadChannel?: ContactChannel | "sms"
  threadIdentityId?: string
  threadKey?: string
  messageIds?: string[]
  operatorCanReply?: boolean
  replyBlockedReason?: string
}) {
  const { interactions, sendMessage, sendSms, retrySms, markRead, cases, patients, tasks, identities, smsProviderConfigurations, currentUser } = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const [draft, setDraft] = useState("")
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { tr, language } = useLanguage()
  const [channel, setChannel] = useState<ContactChannel>(threadChannel === "sms" ? "phone" : threadChannel ?? (patientSmsHistory ? "phone" : "website"))
  const [smsCaseId, setSmsCaseId] = useState("")
  const [chosenTaskId, setChosenTaskId] = useState<string | undefined>(taskId)
  const [recipientId, setRecipientId] = useState(threadIdentityId ?? "")
  const [sendError, setSendError] = useState("")
  const toggleId = useId()
  const { openCase } = useCasePanel()
  const { users } = useUserDirectory()
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, "sending" | "sent" | "error">>({})
  /** Demo-only control (UAT requirement): delivery must be deterministic by
   * default (sending → sent). Failures are never randomized — they only
   * happen when this toggle is explicitly turned on by the operator. */
  const [simulateError, setSimulateError] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const targetCaseId = patientSmsHistory ? smsCaseId || undefined : primaryCaseId || caseIds[0] || undefined
  const targetCase = cases.find((item) => item.id === targetCaseId)
  const targetPatientId = patientId ?? targetCase?.patientId
  const patient = patients.find((item) => item.id === targetPatientId)
  const phoneIdentities = identities.filter((item) => item.channel === "phone" && (!threadIdentityId || item.id === threadIdentityId) &&
    (targetPatientId ? item.patientId === targetPatientId : item.id === targetCase?.contactIdentityId))
  const phoneIdentity = phoneIdentities.find((item) => item.id === recipientId)
    ?? phoneIdentities.find((item) => item.isPrimary) ?? phoneIdentities[0]
  const clinicId = targetCase?.clinicId ?? patient?.primaryClinicId
  const smsProvider = selectSmsProvider(smsProviderConfigurations, clinicId)
  const defaultSmsText = getDefaultSmsText(smsProviderConfigurations, clinicId)
  const openTasks = tasks.filter((item) => item.caseId === targetCaseId && !["completed", "cancelled", "failed"].includes(item.status))
  const nextTask = targetCaseId ? getNextTaskForCase(openTasks, targetCaseId) : undefined
  const selectedTaskId = chosenTaskId === "" ? undefined : openTasks.find((item) => item.id === chosenTaskId)?.id ?? nextTask?.id
  const composerContext = useRef("")
  useEffect(() => {
    const context = `${channel}/${targetCaseId ?? "patient"}/${targetPatientId ?? "contact"}`
    if (context === composerContext.current) return
    composerContext.current = context
    setChosenTaskId(taskId)
    setSendError("")
  }, [channel, targetCaseId, targetPatientId, taskId])
  const canSendMessage = operatorCanReply && hasPermission("communication:send") && (!threadChannel || Boolean(threadIdentityId && identities.some(item => item.id === threadIdentityId)))
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
          try { sendMessage({ caseId: targetCaseId!, patientId, text: pickAutoReply(sentText), type: interactionType, channel: sentChannel, contactIdentityId: threadIdentityId, direction: "incoming" }) }
          catch (error) { setSendError(error instanceof Error ? error.message : "Nie udało się obsłużyć wiadomości przychodzącej.") }
        }, 1500)
      }
    }, 600)
  }

  const messages = useMemo(() => {
    const caseIdSet = new Set(caseIds)
    return interactions
      .filter((i) => messageIds ? messageIds.includes(i.id) : patientSmsHistory
        ? i.type === "sms" && (i.patientId === targetPatientId || Boolean(i.caseId && caseIdSet.has(i.caseId)))
        : i.type !== "call" && Boolean(i.caseId && caseIdSet.has(i.caseId)))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  }, [interactions, caseIds, patientSmsHistory, targetPatientId, messageIds])

  useEffect(() => {
    if (threadKey) markRead(`thread:${threadKey}`)
    else if (targetCaseId) markRead(targetCaseId)
  }, [targetCaseId, threadKey, markRead, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  function handleSend() {
    if ((!draft.trim() && !attachments.length) || !canSendMessage) return
    const sentText = [draft.trim(), ...attachments.map((name) => `[Załącznik: ${name}]`)].filter(Boolean).join("\n")
    const interactionType = CHANNEL_TYPE[channel] ?? "chat"
    if (channel === "phone") {
      if (!canSendCustomSms || !phoneIdentity || (!targetCaseId && !targetPatientId)) return
      try {
        sendSms({ caseId: targetCaseId, patientId: targetPatientId, taskId: selectedTaskId, clinicId,
          recipient: phoneIdentity.value, text: sentText, authorId: currentUser.id, simulateError })
        setSendError("")
      } catch (error) { setSendError(error instanceof Error ? error.message : "Błąd SMS."); return }
    } else {
      if (!targetCaseId) return
      try {
        const sent = sendMessage({ caseId: targetCaseId, patientId, text: sentText, type: interactionType, channel, contactIdentityId: threadIdentityId, direction: "outgoing", authorId, senderKind: "user", threadKey })
        deliver(sent.id, sentText, interactionType, channel)
      } catch (error) { setSendError(error instanceof Error ? error.message : "Błąd wysyłki."); return }
    }
    setDraft("")
    setAttachments([])
    setEmojiOpen(false)
  }

  function handleRetry(m: (typeof messages)[number]) {
    if (isSmsMessage(m)) {
      if (!canSendMessage || !canSendCustomSms || !hasPermission("sms:retry")) return
      try { retrySms(m.id, currentUser.id, simulateError); setSendError("") }
      catch (error) { setSendError(error instanceof Error ? error.message : "Błąd ponowienia SMS.") }
      return
    }
    if (canSendMessage) deliver(m.id, m.text ?? "", m.type, m.channel ?? "website")
  }

  if (!hasPermission("communication:view")) return <p className="p-4 text-sm">Brak dostępu do komunikacji.</p>

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>}
        {messages.map((m, index) => {
          const Icon = TYPE_ICON[m.type] ?? MessageSquare
          const incoming = m.direction !== "outgoing"
          const status = incoming ? undefined : deliveryStatus[m.id]
          return (
            <div key={m.id} className={cn("flex flex-col gap-1", incoming ? "items-start" : "items-end")}>
              {(index === 0 || new Date(messages[index - 1].at).toDateString() !== new Date(m.at).toDateString()) && <p className="w-full py-2 text-center text-[10px] text-muted-foreground">{new Date(m.at).toLocaleDateString("pl-PL")}</p>}
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
                  {!incoming && isBotInteraction(m) && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Bot</p>}
                  <p className="whitespace-pre-wrap"><Highlighted text={m.text ?? ""} term={highlight} /></p>
                  <div className={cn("mt-1 flex flex-wrap items-center gap-1 text-[10px]", incoming ? "text-muted-foreground" : "text-primary-foreground/70")}>
                    <span>{m.type === "sms" ? "SMS" : TYPE_LABEL[m.channel ?? m.type] ?? m.channel ?? m.type} · {formatDateTime(m.at)}</span>
                    {m.type === "sms" && <span>· {incoming ? "Przychodzący" : "Wychodzący"} · {users.find((user) => user.id === m.authorId)?.name ?? (incoming ? "Pacjent (demo)" : m.authorId ?? "System")}</span>}
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
              {isBotInteraction(m) && "aiTrace" in m && m.aiTrace && hasPermission("ai:trace_view") && (
                <details className="max-w-[80%] rounded border bg-background px-3 py-2 text-xs text-foreground">
                  <summary className="cursor-pointer font-medium">Źródła odpowiedzi AI ({m.aiTrace.citations.length})</summary>
                  <div className="mt-2 space-y-2">
                    <p>Run: {m.aiTrace.runId} · {m.aiTrace.modelProvider}/{m.aiTrace.modelName}{m.aiTrace.modelVersion ? ` · ${m.aiTrace.modelVersion}` : ""}</p>
                    <p>Polityka: {m.aiTrace.policyId} v{m.aiTrace.policyVersion} · prompt: {m.aiTrace.promptTemplateId} v{m.aiTrace.promptTemplateVersion}</p>
                    {m.aiTrace.citations.map((source, sourceIndex) => <div key={`${source.sourceId}/${source.sourceVersion}/${source.chunkId ?? sourceIndex}`} className="rounded bg-muted p-2">
                      <p className="font-medium">{source.sourceTitle} · v{source.sourceVersion}</p>
                      <p>{[source.section, source.page ? `s. ${source.page}` : undefined, source.chunkId].filter(Boolean).join(" · ") || source.sourceId}</p>
                      <p className="text-muted-foreground">Pobrano: {formatDateTime(source.retrievedAt)}{source.relevance !== undefined ? ` · trafność ${Math.round(source.relevance * 100)}%` : ""}</p>
                    </div>)}
                    {!m.aiTrace.citations.length && <p>Brak źródła: {m.aiTrace.noSourceReason}</p>}
                    {m.aiTrace.escalationReason && <p className="text-amber-700">Eskalacja: {m.aiTrace.escalationReason}</p>}
                    <p className="text-muted-foreground">Pokazywane są źródła i wersje, nie ukryty tok rozumowania modelu.</p>
                  </div>
                </details>
              )}
              {isSmsMessage(m) && (
                <div className="flex max-w-[80%] flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {m.caseId ? <button type="button" className="underline" onClick={() => openCase(m.caseId!)}>Sprawa: {m.caseId}</button> : <span>Bez sprawy</span>}
                  {m.taskId && <span>Zadanie: {tasks.find((task) => task.id === m.taskId)?.title ?? m.taskId}</span>}
                  {m.retryOfId && <span>Ponowienie: {m.retryOfId}</span>}
                  {m.errorMessage && <span className="text-destructive">{m.errorMessage}</span>}
                  {m.direction === "outgoing" && m.deliveryStatus === "failed" && canSendMessage && canSendCustomSms && hasPermission("sms:retry") &&
                    <button type="button" className="font-medium underline" onClick={() => handleRetry(m)}>Ponów SMS</button>}
                </div>
              )}
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

      {patientSmsHistory && (
        <div className="border-t border-border py-2">
          <label className="text-xs">Powiązanie SMS ze sprawą
            <select className="ml-2 rounded border bg-background p-1" value={smsCaseId} onChange={(event) => setSmsCaseId(event.target.value)}>
              <option value="">Bez sprawy · profil pacjenta</option>
              {cases.filter((item) => item.patientId === patientId).map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
            </select>
          </label>
        </div>
      )}
      {channel === "phone" && (
        <div className="border-t border-border px-1 pt-2 text-[11px] text-muted-foreground">
          {phoneIdentity ? (
            <span>
              Do: <strong className="font-medium text-foreground">{phoneIdentity.value}</strong> · {smsProvider?.name ?? "Brak aktywnej konfiguracji"}
              {" · emulacja (bez API)"}
              {draft ? ` · ${draft.length} znaków · ${calculateSmsParts(draft)} SMS` : ""}
            </span>
          ) : (
            <span className="text-destructive">Brak numeru telefonu. Uzupełnij profil pacjenta przed wysłaniem SMS.</span>
          )}
          {defaultSmsText && <button type="button" className="ml-2 font-medium text-primary underline-offset-2 hover:underline" onClick={() => setDraft((current) => current.trim() ? current : defaultSmsText)}>
            Wstaw domyślny tekst kliniki
          </button>}
        </div>
      )}

      {channel === "phone" && (
        <div className="flex flex-wrap gap-3 py-2 text-xs">
          {phoneIdentities.length > 1 && <label>Telefon <select value={phoneIdentity?.id} onChange={(event) => setRecipientId(event.target.value)}>{phoneIdentities.map((identity) => <option key={identity.id} value={identity.id}>{identity.value}</option>)}</select></label>}
          {targetCaseId && <label>Zadanie SMS <select className="ml-2 max-w-xs rounded border bg-background p-1" value={selectedTaskId ?? ""} onChange={(event) => setChosenTaskId(event.target.value)}>
            <option value="">Bez zadania</option>{openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select></label>}
          <span className="text-muted-foreground">SMS nie kończy zadania. Następne działanie pozostaje w kolejce.</span>
        </div>
      )}
      {sendError && <p role="alert" className="text-xs text-destructive">{sendError}</p>}
      {!operatorCanReply && replyBlockedReason && <p role="status" className="text-xs font-medium text-amber-700">{replyBlockedReason}</p>}
      <div className="flex items-center justify-end gap-1.5 pb-1.5 text-[11px] text-muted-foreground">
        <input
          id={toggleId}
          type="checkbox"
          checked={simulateError}
          onChange={(e) => setSimulateError(e.target.checked)}
          className="h-3 w-3 accent-destructive"
        />
        <label htmlFor={toggleId} className="cursor-pointer select-none">
          Symuluj błąd wysyłki (test UAT)
        </label>
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
          {attachments.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
              <Paperclip className="h-3 w-3" aria-hidden />
              <span className="max-w-[160px] truncate">{name}</span>
              <span className="text-[10px] text-muted-foreground">demo</span>
              <button type="button" aria-label={`Usuń załącznik ${name}`} onClick={() => setAttachments((prev) => prev.filter((item) => item !== name))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      {emojiOpen && (
        <div className="flex flex-wrap gap-1 rounded-md border bg-background p-2" role="group" aria-label="Emoji">
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" className="h-8 w-8 rounded text-lg hover:bg-accent" onClick={() => setDraft((prev) => prev + emoji)}>{emoji}</button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 border-t border-border pt-3">
        <input ref={fileInputRef} type="file" multiple className="sr-only" tabIndex={-1} onChange={(event) => {
          const names = Array.from(event.target.files ?? []).map((file) => file.name)
          setAttachments((prev) => [...new Set([...prev, ...names])])
          event.target.value = ""
        }} />
        <Select disabled={patientSmsHistory || Boolean(threadKey)} value={channel} onValueChange={(v) => setChannel(v as ContactChannel)}>
          <SelectTrigger className="h-9 w-[150px] shrink-0 text-xs" aria-label={tr("Kanał wysyłki", "Канал отправки")}>
            <SelectValue>{sendChannelText(channel, language)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SEND_CHANNELS.map((c) =>
              c.potential ? (
                <Tooltip key={c.value}>
                  <TooltipTrigger
                    render={
                      <span>
                        <SelectItem value={c.value} disabled>
                          {sendChannelText(c.value, language)} · {potentialChannelText(language).badge}
                        </SelectItem>
                      </span>
                    }
                  />
                  <TooltipContent side="right">{potentialChannelText(language).tooltip}</TooltipContent>
                </Tooltip>
              ) : (
                <SelectItem key={c.value} value={c.value}>
                  {sendChannelText(c.value, language)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}>
          <Smile className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Dodaj załącznik (demo)" title="Demo: pliki nie są wysyłane do pacjenta" disabled={channel === "phone"} onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          data-message-composer
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
          disabled={!canSendMessage || (channel !== "phone" && !targetCaseId) || (channel === "phone" && !canSendCustomSms)}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={(!draft.trim() && !attachments.length) || !canSendMessage || (channel !== "phone" && !targetCaseId) || (channel === "phone" && (!canSendCustomSms || !phoneIdentity || !smsProvider))} aria-label="Wyślij">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SmsStatus({ message }: { message: SmsMessage }) {
  const Icon = message.deliveryStatus === "delivered"
    ? CheckCheck
    : (message.deliveryStatus === "sent" || message.deliveryStatus === "submitted")
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

function Highlighted({ text, term }: { text: string; term?: string }) {
  if (!term) return <>{text}</>
  const lower = text.toLowerCase()
  const parts: React.ReactNode[] = []
  let from = 0
  let at = lower.indexOf(term, from)
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(<mark key={at} className="rounded-sm bg-amber-300 px-0.5 text-foreground">{text.slice(at, at + term.length)}</mark>)
    from = at + term.length
    at = lower.indexOf(term, from)
  }
  parts.push(text.slice(from))
  return <>{parts}</>
}
