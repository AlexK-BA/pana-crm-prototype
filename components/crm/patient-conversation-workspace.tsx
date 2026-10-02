"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConversationThread } from "@/components/crm/conversation-thread"
import { PatientLinkPanel } from "@/components/crm/patient-link-panel"
import { Patient360Actions } from "@/components/crm/patient-360-actions"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { buildPatientThreads } from "@/lib/crm/patient-360-selectors"
import { getNextTaskForCase } from "@/lib/crm/entity-queue"
import { formatDateTime, formatRelative } from "@/lib/crm/format"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useCall } from "@/lib/crm/call-context"
import { getSmsStatusLabel, isSmsMessage } from "@/lib/crm/sms-service"
import type { Call } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const labels: Record<string, string> = { phone: "Telefon", sms: "SMS", email: "E-mail", website: "Czat WWW", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", telegram: "Telegram", tiktok: "TikTok · Potential", viber: "Viber", personal_account: "Konto pacjenta" }
export function PatientConversationWorkspace({ patientId, currentCaseId, authorId, className, initialView, taskId }: {
  patientId?: string; currentCaseId: string; authorId?: string; className?: string; initialView?: "sms"; taskId?: string
}) {
  const store = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { openCase } = useCasePanel()
  const { startOutgoingCall } = useCall()
  const [selected, setSelected] = useState(initialView === "sms" ? "sms-history" : "")
  const [mobileDetail, setMobileDetail] = useState(false)
  const [error, setError] = useState("")
  const patientCases = store.cases.filter(item => patientId ? item.patientId === patientId : item.id === currentCaseId)
  const ids = new Set(patientCases.map(item => item.id))
  const identities = store.identities.filter(item => (patientId && item.patientId === patientId) || patientCases.some(c => (c.contactIdentityIds ?? [c.contactIdentityId]).includes(item.id)))
  const messages = store.interactions.filter(item => item.caseId ? ids.has(item.caseId) : Boolean(patientId && item.patientId === patientId))
  const threads = useMemo(() => buildPatientThreads(patientCases, identities, messages, store.readAt), [store.cases, store.identities, store.interactions, store.readAt, patientId, currentCaseId])
  const activeThread = threads.find(item => item.id === selected) ?? threads.find(item => item.caseId === currentCaseId && item.channel !== "phone") ?? threads[0]
  const smsHistory = selected === "sms-history" && Boolean(patientId)
  const targetCase = patientCases.find(item => item.id === activeThread?.caseId)
  const next = targetCase ? getNextTaskForCase(store.tasks, targetCase.id) : undefined
  const patient = store.patients.find(item => item.id === patientId)
  const identity = identities.find(item => item.id === activeThread?.identityId)
  if (!hasPermission("communication:view")) return <p role="alert" className="p-4 text-sm">Brak dostępu do komunikacji.</p>
  function select(id: string) { setSelected(id); setMobileDetail(true); setError("") }
  return <div className={cn("flex h-full min-h-0 min-w-0 overflow-hidden", className)}>
    <aside className={cn("w-full shrink-0 overflow-y-auto border-r border-border bg-muted/20 md:block md:w-60", mobileDetail && "hidden")}>
      <div className="border-b p-3"><p className="text-sm font-semibold">Inbox pacjenta</p><p className="text-xs text-muted-foreground">Kanał · identity · sprawa. Audit nie jest wiadomością.</p></div>
      {patientId && <button type="button" className={cn("w-full border-b p-3 text-left text-sm", smsHistory && "bg-accent")} onClick={() => select("sms-history")}>SMS · historia pacjenta<span className="block text-xs text-muted-foreground">Wszystkie sprawy i SMS bez sprawy</span></button>}
      {!threads.length && <p className="p-3 text-sm text-muted-foreground">Brak komunikacji ani kontaktów.</p>}
      {threads.map(thread => {
        const contact = identities.find(item => item.id === thread.identityId)
        return <button key={thread.id} type="button" aria-pressed={!smsHistory && activeThread?.id === thread.id} onClick={() => select(thread.id)} className={cn("w-full min-w-0 space-y-1 border-b p-3 text-left text-xs hover:bg-accent", !smsHistory && activeThread?.id === thread.id && "bg-accent")}>
          <span className="flex justify-between gap-2"><strong>{labels[thread.channel]}</strong><span>{thread.unread ? `${thread.unread} unread` : ""}</span></span>
          <span className="block break-all text-muted-foreground">{contact?.displayName ?? contact?.value ?? "Kontakt niepowiązany"}</span>
          <span className="block">{thread.caseId ?? "Bez sprawy"} · {thread.active ? "Active" : "Closed"}</span>
          <span className="block truncate text-muted-foreground">{thread.last?.text ?? (thread.last?.type === "call" ? "Połączenie" : "Brak wiadomości")}</span>
          <span className="block text-muted-foreground">{thread.last ? formatRelative(thread.last.at) : "—"} {thread.last && isSmsMessage(thread.last) && `· ${getSmsStatusLabel(thread.last)}`}</span>
        </button>
      })}
      {!threads.some(item => item.channel === "tiktok") && <p className="p-3 text-xs text-muted-foreground">TikTok <Badge variant="outline">Potential</Badge></p>}
    </aside>
    <div className={cn("flex min-w-0 flex-1 flex-col", !mobileDetail && "hidden md:flex")}>
      <Button className="m-2 self-start md:hidden" variant="outline" size="sm" onClick={() => setMobileDetail(false)}>Wróć do listy rozmów</Button>
      {!smsHistory && patientId && <div className="shrink-0 space-y-2 border-b p-3 xl:hidden">
        <div className="flex flex-wrap items-center gap-2 text-xs">{targetCase && <Button size="sm" variant="outline" onClick={() => openCase(targetCase.id)}>{targetCase.id}</Button>}<span>Następne: {next?.title ?? "Nie ustalono — utwórz zadanie"}</span></div>
        {patientId && <Patient360Actions patientId={patientId} caseId={targetCase?.id} contactOnly />}
      </div>}
      <div className="min-h-0 flex-1">
        {smsHistory ? <ConversationThread key={`sms-${patientId}`} caseIds={patientCases.map(item => item.id)} primaryCaseId={currentCaseId} patientId={patientId} patientSmsHistory taskId={taskId} authorId={authorId} className="h-full p-4" />
          : !activeThread ? <p className="p-4 text-sm text-muted-foreground">Brak komunikacji. Dodaj kontakt i wybierz lub utwórz sprawę, aby rozpocząć rozmowę.</p>
          : activeThread.channel === "phone" ? <div className="h-full space-y-3 overflow-y-auto p-4"><p className="text-sm font-medium">Historia połączeń · {identity?.value ?? "Numer nieznany"}</p>
            <Button disabled={!targetCase || !hasPermission("call:handle")} onClick={() => { try { if (targetCase) startOutgoingCall({ caseId: targetCase.id, taskId: next?.id, contactIdentityId: identity?.id }) } catch (error) { setError(error instanceof Error ? error.message : "Błąd połączenia.") } }}>Zadzwoń przez istniejący call workflow</Button>
            {activeThread.messages.length === 0 && <p className="text-sm text-muted-foreground">Brak połączeń.</p>}
            {activeThread.messages.map(item => <div key={item.id} className="rounded border p-3 text-sm">{formatDateTime(item.at)} · {item.direction} · {(item as Call).disposition ?? (item as Call).telcoStatus}</div>)}
            {error && <p role="alert" className="text-destructive">{error}</p>}
          </div>
          : activeThread.channel === "tiktok" ? <div className="p-4 text-sm">TikTok · Potential. Integracja nieaktywna; wysyłka niedostępna.</div>
          : <ConversationThread key={activeThread.id} caseIds={activeThread.caseId ? [activeThread.caseId] : []} primaryCaseId={activeThread.caseId} patientId={patientId} authorId={authorId}
              threadKey={activeThread.id} threadChannel={activeThread.channel} threadIdentityId={activeThread.identityId} messageIds={activeThread.messages.map(item => item.id)} taskId={taskId} className="h-full p-4" />}
      </div>
    </div>
    {!smsHistory && <aside className="hidden w-72 shrink-0 space-y-3 overflow-y-auto border-l p-3 text-xs xl:block">
      <p className="font-semibold">{patient ? `${patient.firstName} ${patient.lastName}` : "Kontakt niepowiązany"}</p>
      <p className="break-all">{identity?.displayName} {identity?.value ?? "Brak identity"} · {identity?.verified ? "Zweryfikowany" : "Lokalny / niezweryfikowany"}</p>
      {targetCase ? <><Button size="sm" variant="outline" onClick={() => openCase(targetCase.id)}>Otwórz {targetCase.id}</Button><p>Następna czynność: {next?.title ?? "Brak — utwórz zadanie"}</p><PatientLinkPanel caseId={targetCase.id} /></> : <p>Bez sprawy. Wybierz lub utwórz Engagement Case dla kanałów innych niż SMS.</p>}
      {patientId && <Patient360Actions patientId={patientId} caseId={targetCase?.id} />}
    </aside>}
  </div>
}
