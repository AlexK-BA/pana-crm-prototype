"use client"

import { useMemo, useState } from "react"
import { Globe, Mail, MessageCircle, Phone, Search, Send, Smartphone, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConversationThread } from "@/components/crm/conversation-thread"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { buildPatientThreads, type PatientThread, type ThreadChannel } from "@/lib/crm/patient-360-selectors"
import { getNextTaskForCase } from "@/lib/crm/entity-queue"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useCall } from "@/lib/crm/call-context"
import { getSmsStatusLabel, isSmsMessage } from "@/lib/crm/sms-service"
import type { Call, Interaction } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const CHANNEL_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "bg-emerald-100 text-emerald-700" },
  instagram: { label: "Instagram", icon: MessageCircle, tone: "bg-pink-100 text-pink-700" },
  facebook: { label: "Facebook", icon: MessageCircle, tone: "bg-blue-100 text-blue-700" },
  telegram: { label: "Telegram", icon: Send, tone: "bg-sky-100 text-sky-700" },
  website: { label: "Czat WWW", icon: Globe, tone: "bg-violet-100 text-violet-700" },
  email: { label: "E-mail", icon: Mail, tone: "bg-amber-100 text-amber-700" },
  sms: { label: "SMS", icon: Smartphone, tone: "bg-teal-100 text-teal-700" },
  phone: { label: "Telefon", icon: Phone, tone: "bg-slate-200 text-slate-700" },
  viber: { label: "Viber", icon: MessageCircle, tone: "bg-purple-100 text-purple-700" },
  personal_account: { label: "Konto pacjenta", icon: Globe, tone: "bg-slate-100 text-slate-700" },
}
const CHANNEL_ORDER = ["whatsapp", "instagram", "facebook", "telegram", "website", "email", "sms", "phone", "viber", "personal_account"]

type Item = Interaction | Call
type ReplyState = "new" | "awaiting" | "answered" | "bot" | "none"
type Filter = "all" | "unread" | "awaiting" | "bot"

const textOf = (item?: Item) => (item as Interaction | undefined)?.text ?? ""
const isBotAuthor = (id?: string) => Boolean(id && /^bot/i.test(id))
const lastIsBot = (item?: Item) => item?.direction === "outgoing" && isBotAuthor((item as Interaction).authorId)

interface ChannelGroup { channel: ThreadChannel; threads: PatientThread[]; unread: number; last?: Item; state: ReplyState; matches: Item[] }

function replyState(unread: number, last?: Item): ReplyState {
  if (!last) return "none"
  if (unread > 0) return "new"
  if (last.direction === "incoming") return "awaiting"
  return lastIsBot(last) ? "bot" : "answered"
}

const STATE_PRIORITY: ReplyState[] = ["new", "awaiting", "bot", "answered", "none"]
const worstState = (states: ReplyState[]) => STATE_PRIORITY.find(state => states.includes(state)) ?? "none"
const lastOf = (items: Item[]) => items.reduce<Item | undefined>((acc, item) => !acc || Date.parse(item.at) > Date.parse(acc.at) ? item : acc, undefined)

const STATE_BADGE: Record<ReplyState, { label: string; className: string } | null> = {
  new: { label: "Nowe", className: "bg-primary text-primary-foreground" },
  awaiting: { label: "Czeka na odpowiedź", className: "bg-amber-100 text-amber-800" },
  answered: { label: "Odpowiedziano", className: "bg-muted text-muted-foreground" },
  bot: { label: "Odpowiedział bot", className: "bg-violet-100 text-violet-800" },
  none: null,
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "unread", label: "Nowe" },
  { value: "awaiting", label: "Bez odpowiedzi" },
  { value: "bot", label: "Bot" },
]

export function PatientConversationWorkspace({ patientId, currentCaseId, authorId, className, initialView, taskId }: {
  patientId?: string; currentCaseId: string; authorId?: string; className?: string; initialView?: "sms"; taskId?: string
}) {
  const store = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { startOutgoingCall } = useCall()
  const [selectedChannel, setSelectedChannel] = useState<string>(initialView === "sms" ? "sms" : "")
  const [selectedThread, setSelectedThread] = useState(initialView === "sms" ? "sms-history" : "")
  const [mobileDetail, setMobileDetail] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [error, setError] = useState("")

  const patientCases = store.cases.filter(item => patientId ? item.patientId === patientId : item.id === currentCaseId)
  const ids = new Set(patientCases.map(item => item.id))
  const identities = store.identities.filter(item => (patientId && item.patientId === patientId) || patientCases.some(c => (c.contactIdentityIds ?? [c.contactIdentityId]).includes(item.id)))
  const messages = store.interactions.filter(item => item.caseId ? ids.has(item.caseId) : Boolean(patientId && item.patientId === patientId))
  const threads = useMemo(() => buildPatientThreads(patientCases, identities, messages, store.readAt), [store.cases, store.identities, store.interactions, store.readAt, patientId, currentCaseId])

  const needle = query.trim().toLowerCase()
  const groups = useMemo<ChannelGroup[]>(() => {
    const byChannel = new Map<ThreadChannel, PatientThread[]>()
    for (const thread of threads) byChannel.set(thread.channel, [...(byChannel.get(thread.channel) ?? []), thread])
    const result: ChannelGroup[] = []
    for (const [channel, list] of byChannel) {
      const all = list.flatMap(thread => thread.messages)
      const last = all.reduce<Item | undefined>((acc, item) => !acc || Date.parse(item.at) > Date.parse(acc.at) ? item : acc, undefined)
      const unread = list.reduce((sum, thread) => sum + thread.unread, 0)
      const matches = needle ? all.filter(item => textOf(item).toLowerCase().includes(needle)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : []
      const state = worstState(list.map(thread => replyState(thread.unread, lastOf(thread.messages))))
      result.push({ channel, threads: list, unread, last, state, matches })
    }
    return result.sort((a, b) => Date.parse(b.last?.at ?? "1970-01-01") - Date.parse(a.last?.at ?? "1970-01-01") || CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel))
  }, [threads, needle])

  const visibleGroups = groups.filter(group => {
    if (needle && !group.matches.length) return false
    if (filter === "unread") return group.unread > 0
    if (filter === "awaiting") return group.state === "awaiting" || group.state === "new"
    if (filter === "bot") return group.threads.some(thread => thread.messages.some(item => lastIsBot(item)))
    return true
  })

  const activeGroup = groups.find(group => group.channel === selectedChannel)
    ?? groups.find(group => group.threads.some(thread => thread.caseId === currentCaseId && thread.channel !== "phone"))
    ?? groups[0]
  const smsHistory = activeGroup?.channel === "sms" && selectedThread === "sms-history" && Boolean(patientId)
  const activeThread = activeGroup?.threads.find(thread => thread.id === selectedThread)
    ?? activeGroup?.threads.find(thread => thread.caseId === currentCaseId)
    ?? activeGroup?.threads[0]
  const targetCase = patientCases.find(item => item.id === activeThread?.caseId)
  const next = targetCase ? getNextTaskForCase(store.tasks, targetCase.id) : undefined
  const identity = identities.find(item => item.id === activeThread?.identityId)
  const botInvolved = Boolean(activeThread?.messages.some(item => lastIsBot(item)))

  if (!hasPermission("communication:view")) return <p role="alert" className="p-4 text-sm">Brak dostępu do komunikacji.</p>

  function pickChannel(channel: string) { setSelectedChannel(channel); setSelectedThread(""); setMobileDetail(true); setError("") }

  return <div className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden", className)}>
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className={cn("flex w-full shrink-0 flex-col border-r bg-muted/20 md:w-72", mobileDetail && "hidden md:flex")}>
        <div className="space-y-2 border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Szukaj w wiadomościach" aria-label="Szukaj w wiadomościach" className="h-9 pl-8 pr-8 text-sm" />
            {query && <button type="button" aria-label="Wyczyść wyszukiwanie" className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setQuery("")}><X className="h-4 w-4" /></button>}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtr rozmów">
            {FILTERS.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", filter === item.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>{item.label}</button>)}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!groups.length && <p className="p-3 text-sm text-muted-foreground">Brak komunikacji ani kontaktów.</p>}
          {groups.length > 0 && !visibleGroups.length && <p className="p-3 text-sm text-muted-foreground">Brak rozmów dla wybranych filtrów.</p>}
          {visibleGroups.map(group => {
            const meta = CHANNEL_META[group.channel] ?? { label: group.channel, icon: MessageCircle, tone: "bg-muted text-foreground" }
            const Icon = meta.icon
            const badge = STATE_BADGE[group.state]
            const preview = group.matches.at(-1) ?? group.last
            const previewText = textOf(preview) || (preview?.type === "call" ? "Połączenie" : "Brak wiadomości")
            const active = activeGroup?.channel === group.channel
            return <button key={group.channel} type="button" aria-pressed={active} onClick={() => pickChannel(group.channel)}
              className={cn("flex w-full items-start gap-3 border-b p-3 text-left transition-colors hover:bg-accent", active && "bg-accent")}>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.tone)}><Icon className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="flex items-center justify-between gap-2">
                  <strong className={cn("truncate text-sm", group.unread > 0 && "text-foreground")}>{meta.label}</strong>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{group.last ? formatRelative(group.last.at) : ""}</span>
                </span>
                <span className={cn("flex items-center gap-1 truncate text-xs", group.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {preview?.direction === "outgoing" && <span className="shrink-0 text-muted-foreground">{lastIsBot(preview) ? "Bot:" : "Ty:"}</span>}
                  <span className="truncate">{previewText}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1 pt-0.5">
                  {badge && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>{badge.label}</span>}
                  {group.threads.length > 1 && <span className="text-[10px] text-muted-foreground">{group.threads.length} rozmowy</span>}
                  {needle && group.matches.length > 0 && <span className="text-[10px] text-muted-foreground">{group.matches.length} trafień</span>}
                </span>
              </span>
              {group.unread > 0 && <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{group.unread}</span>}
            </button>
          })}
          {!groups.some(group => group.channel === "tiktok") && <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">TikTok <Badge variant="outline">Potential</Badge></p>}
        </div>
      </aside>

      <section className={cn("flex min-w-0 flex-1 flex-col", !mobileDetail && "hidden md:flex")}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button className="md:hidden" variant="outline" size="sm" onClick={() => setMobileDetail(false)}>Wróć do listy</Button>
          {activeGroup && <strong className="text-sm">{CHANNEL_META[activeGroup.channel]?.label ?? activeGroup.channel}</strong>}
          {activeGroup && (activeGroup.threads.length > 1 || activeGroup.channel === "sms") && <div className="flex flex-wrap gap-1" role="group" aria-label="Rozmowy w kanale">
            {activeGroup.channel === "sms" && patientId && <button type="button" aria-pressed={smsHistory} onClick={() => setSelectedThread("sms-history")} className={cn("rounded-full border px-2.5 py-0.5 text-xs", smsHistory ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>Cała historia</button>}
            {activeGroup.threads.map(thread => {
              const contact = identities.find(item => item.id === thread.identityId)
              const on = !smsHistory && activeThread?.id === thread.id
              const threadBadge = STATE_BADGE[replyState(thread.unread, lastOf(thread.messages))]
              return <button key={thread.id} type="button" aria-pressed={on} onClick={() => setSelectedThread(thread.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>
                {thread.caseId ?? "Bez sprawy"}{contact ? ` · ${contact.displayName ?? contact.value}` : ""}{thread.unread ? ` · ${thread.unread}` : ""}
                {threadBadge && <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium", on ? "bg-background/20 text-primary-foreground" : threadBadge.className)}>{threadBadge.label}</span>}
              </button>
            })}
          </div>}
          {!smsHistory && activeThread && <Badge variant="outline" className="ml-auto text-[10px]">{activeThread.active ? "Sprawa aktywna" : "Sprawa zamknięta"}</Badge>}
        </div>
        {botInvolved && !smsHistory && <p role="status" className="shrink-0 border-b bg-violet-50 px-3 py-1.5 text-xs text-violet-800">Bot uczestniczył w tej rozmowie. Odpowiedź wpisana poniżej zostanie wysłana jako operator w tym samym wątku.</p>}
        <div className="min-h-0 flex-1">
          {smsHistory ? <ConversationThread key={`sms-${patientId}`} caseIds={patientCases.map(item => item.id)} primaryCaseId={currentCaseId} patientId={patientId} patientSmsHistory taskId={taskId} authorId={authorId} className="h-full p-3" />
            : !activeThread ? <p className="p-4 text-sm text-muted-foreground">Brak komunikacji. Dodaj kontakt i wybierz lub utwórz sprawę, aby rozpocząć rozmowę.</p>
            : activeThread.channel === "phone" ? <div className="h-full space-y-3 overflow-y-auto p-4"><p className="text-sm font-medium">Historia połączeń · {identity?.value ?? "Numer nieznany"}</p>
              <Button disabled={!targetCase || !hasPermission("call:handle")} onClick={() => { try { if (targetCase) startOutgoingCall({ caseId: targetCase.id, taskId: next?.id, contactIdentityId: identity?.id }) } catch (err) { setError(err instanceof Error ? err.message : "Błąd połączenia.") } }}>Zadzwoń przez istniejący call workflow</Button>
              {activeThread.messages.length === 0 && <p className="text-sm text-muted-foreground">Brak połączeń.</p>}
              {activeThread.messages.map(item => <div key={item.id} className="rounded border p-3 text-sm">{formatDateTime(item.at)} · {item.direction} · {(item as Call).disposition ?? (item as Call).telcoStatus}</div>)}
              {error && <p role="alert" className="text-destructive">{error}</p>}
            </div>
            : <ConversationThread key={activeThread.id} caseIds={activeThread.caseId ? [activeThread.caseId] : []} primaryCaseId={activeThread.caseId} patientId={patientId} authorId={authorId}
                threadKey={activeThread.id} threadChannel={activeThread.channel} threadIdentityId={activeThread.identityId} messageIds={activeThread.messages.map(item => item.id)} taskId={taskId} highlight={needle} className="h-full p-3" />}
        </div>
      </section>
    </div>
  </div>
}
