"use client"

/**
 * Inbox = chat as an independent channel, not a view onto the kanban card.
 * Every text-like Interaction across every EngagementCase is reachable here,
 * an operator can reply without ever opening a case, and a message from an
 * unknown contact shows up immediately as its own draft conversation
 * (see EntityStore.createDraftCase) — the "chat as a lead source" scenario.
 */
import { useMemo, useState } from "react"
import {
  Search,
  CheckCheck,
  Phone,
  Mail,
  MessageCircle,
  Send,
  Globe,
  User,
  Plus,
  ExternalLink,
} from "lucide-react"
import { PageShell } from "@/components/crm/page-shell"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { ConversationThread } from "@/components/crm/conversation-thread"
import { useEntityStore } from "@/lib/crm/entity-store"
import { getPatient, getIdentity } from "@/lib/crm/entity-data"
import { getClinic, getClinicTone, CLINICS } from "@/lib/crm/catalog"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useRole } from "@/lib/crm/role-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"
import { OPERATORS } from "@/lib/crm/data"
import { formatRelative } from "@/lib/crm/format"
import type { ContactChannel } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

const CHANNEL_ICON: Record<ContactChannel, typeof Phone> = {
  phone: Phone,
  email: Mail,
  instagram: MessageCircle,
  facebook: MessageCircle,
  whatsapp: MessageCircle,
  telegram: Send,
  viber: MessageCircle,
  website: Globe,
  personal_account: User,
}

const SIMULATE_CHANNELS: ContactChannel[] = ["instagram", "facebook", "whatsapp", "telegram", "website"]

export default function InboxPage() {
  const [query, setQuery] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [clinicFilter, setClinicFilter] = useState<string>("all")
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [simulateOpen, setSimulateOpen] = useState(false)
  const [simChannel, setSimChannel] = useState<ContactChannel>("instagram")
  const [simValue, setSimValue] = useState("")
  const [simText, setSimText] = useState("")

  const { cases, interactions, identities, readAt, createDraftCase } = useEntityStore()
  const { openCase } = useCasePanel()
  const { role } = useRole()
  const meName = ROLE_PROFILES[role].user.name
  const actorId = OPERATORS.find((o) => o.name === meName)?.id ?? "system"

  const conversations = useMemo(() => {
    const list = cases
      .map((c) => {
        const messages = interactions.filter((i) => i.type !== "call" && i.caseId === c.id)
        if (messages.length === 0) return null
        const last = [...messages].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
        const lastReadAt = readAt[c.id]
        const unread = messages.filter(
          (m) => m.direction !== "outgoing" && (!lastReadAt || new Date(m.at).getTime() > new Date(lastReadAt).getTime()),
        ).length
        const identity = getIdentity(c.contactIdentityId) ?? identities.find((i) => i.id === c.contactIdentityId)
        const patient = getPatient(c.patientId)
        return {
          case: c,
          identity,
          patient,
          displayName: patient ? `${patient.firstName} ${patient.lastName}` : identity?.value ?? "Nierozpoznany kontakt",
          lastMessage: last?.text ?? "",
          lastAt: last?.at ?? c.createdAt,
          unread,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .filter((c) => (unreadOnly ? c.unread > 0 : true))
      .filter((c) => (clinicFilter === "all" ? true : c.case.clinicId === clinicFilter))
      .filter((c) => {
        if (!query) return true
        const q = query.toLowerCase()
        return c.displayName.toLowerCase().includes(q) || c.identity?.value.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    return list
  }, [cases, interactions, identities, readAt, unreadOnly, clinicFilter, query])

  const activeCaseId = selectedCaseId ?? conversations[0]?.case.id ?? null
  const active = conversations.find((c) => c.case.id === activeCaseId)
  const activeClinicTone = getClinicTone(active?.case.clinicId)
  const activeClinic = getClinic(active?.case.clinicId)

  function handleSimulate() {
    if (!simValue.trim() || !simText.trim()) return
    const isPhone = simChannel === "phone"
    const isEmail = simChannel === "email"
    const { caseId } = createDraftCase({
      channel: simChannel,
      phone: isPhone ? simValue.trim() : undefined,
      email: isEmail ? simValue.trim() : undefined,
      value: !isPhone && !isEmail ? simValue.trim() : undefined,
      text: simText.trim(),
    })
    setSelectedCaseId(caseId)
    setSimulateOpen(false)
    setSimValue("")
    setSimText("")
  }

  return (
    <PageShell title="Inbox" subtitle="Wszystkie rozmowy czatowe, niezależnie od kart CRM" noPadding>
      <div className="flex h-full">
        <div className="flex w-[340px] shrink-0 flex-col border-r border-border">
          <div className="space-y-2 border-b border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj rozmów..."
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => setSimulateOpen(true)} aria-label="Symuluj nową rozmowę">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={unreadOnly ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setUnreadOnly((v) => !v)}
              >
                <CheckCheck className="h-3 w-3" />
                Nieprzeczytane
              </Button>
              <Select value={clinicFilter} onValueChange={setClinicFilter}>
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue placeholder="Klinika" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie kliniki</SelectItem>
                  {CLINICS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => {
              const Icon = CHANNEL_ICON[c.identity?.channel ?? "website"]
              const tone = getClinicTone(c.case.clinicId)
              return (
                <button
                  key={c.case.id}
                  onClick={() => setSelectedCaseId(c.case.id)}
                  className={cn(
                    "relative flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent",
                    activeCaseId === c.case.id && "bg-accent",
                  )}
                >
                  <span className={cn("absolute left-0 top-0 h-full w-0.5", tone.bar)} aria-hidden="true" />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Icon className="h-4 w-4 text-secondary-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{c.displayName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground" suppressHydrationWarning>
                        {formatRelative(c.lastAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.lastMessage || "Brak treści"}</p>
                    {!c.case.clinicId && (
                      <Badge variant="outline" className="mt-1 border-slate-200 bg-white text-[10px] text-slate-500">
                        Do przypisania kliniki
                      </Badge>
                    )}
                  </div>
                  {c.unread > 0 && (
                    <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </button>
              )
            })}
            {conversations.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Brak rozmów spełniających filtry.</p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {active ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{active.displayName}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[11px]", activeClinicTone.chip)}>
                      {activeClinic?.name ?? "Nieprzypisano kliniki"}
                    </Badge>
                    {active.identity && <span className="text-xs text-muted-foreground">{active.identity.value}</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => openCase(active.case.id)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Otwórz sprawę
                </Button>
              </div>
              <div className="min-h-0 flex-1 px-4 py-3">
                <ConversationThread
                  caseIds={[active.case.id]}
                  primaryCaseId={active.case.id}
                  patientId={active.case.patientId}
                  authorId={actorId}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Wybierz rozmowę z listy po lewej.
            </div>
          )}
        </div>
      </div>

      <Dialog open={simulateOpen} onOpenChange={setSimulateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Symuluj nową wiadomość</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Demonstracja scenariusza &quot;chat jako źródło leadów&quot;: wiadomość od nieznanego kontaktu automatycznie tworzy
              szkic sprawy i zadanie &quot;odpowiedz i przypisz klinikę&quot;, widoczne od razu w kolejce operatora.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Kanał</label>
                <Select value={simChannel} onValueChange={(v) => setSimChannel(v as ContactChannel)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIMULATE_CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Identyfikator kontaktu</label>
                <Input value={simValue} onChange={(e) => setSimValue(e.target.value)} placeholder="@nowy_kontakt" className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Treść wiadomości</label>
              <Textarea
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="Dzień dobry, chciałabym zapytać o..."
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Anuluj</Button>} />
            <Button onClick={handleSimulate} disabled={!simValue.trim() || !simText.trim()}>
              Wyślij wiadomość
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
