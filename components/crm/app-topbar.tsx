"use client"

import { useMemo, useState } from "react"
import { Search, Bell, Plus, PhoneIncoming, Loader2, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCall } from "@/lib/crm/call-context"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useLanguage, type Language } from "@/lib/crm/language-context"
import { CLINICS, getClinicTone } from "@/lib/crm/catalog"
import { getQueue } from "@/lib/crm/entity-queue"
import { buildQueueItem, PRIORITY_TONE } from "@/lib/crm/entity-selectors"
import { formatRelative } from "@/lib/crm/format"
import type { ContactChannel, ClinicId } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"
import { useAuthorization } from "@/lib/crm/authorization-context"

const DEMO_INCOMING_CALLS = [
  { caseId: "case-1004", taskId: "task-02", label: "Nierozpoznany numer (Scenario 2/17)", unknown: true },
  { caseId: "case-1006", taskId: "task-01", label: "Eskalacja pacjentki — P0 (Scenario 5)", unknown: false },
  { caseId: "case-1007", taskId: "task-06", label: "Vera Kavalchuk — kolejna próba (Scenario 4)", unknown: false },
]

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  phone: "Telefon",
  email: "E-mail",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  tiktok: "TikTok · Potencjalny",
  viber: "Viber",
  website: "Czat na stronie",
  personal_account: "Konto pacjenta",
}

export function AppTopbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [showKbd] = useState(true)
  const { simulateIncomingCall, routeIncomingCall } = useCall()
  const { tasks, cases, createDraftCase } = useScopedEntityStore()
  const { openCase } = useCasePanel()
  const { language, setLanguage, t } = useLanguage()
  const { hasPermission } = useAuthorization()
  const canHandleCalls = hasPermission("call:handle")
  const canViewTasks = hasPermission("task:view")
  const canCreateCase = hasPermission("case:edit")

  const [incomingOpen, setIncomingOpen] = useState(false)
  const [incomingPhone, setIncomingPhone] = useState("")
  const [incomingResult, setIncomingResult] = useState<{ caseIds: string[]; message: string } | null>(null)
  const [callError, setCallError] = useState("")
  function simulateCaseCall(input: Parameters<typeof simulateIncomingCall>[0]) {
    try { setCallError(""); simulateIncomingCall(input) }
    catch (error) { setCallError(error instanceof Error ? error.message : "Nie udało się otworzyć połączenia.") }
  }
  const [newCaseOpen, setNewCaseOpen] = useState(false)
  const [newCaseChannel, setNewCaseChannel] = useState<ContactChannel>("phone")
  const [newCaseFirstName, setNewCaseFirstName] = useState("")
  const [newCaseLastName, setNewCaseLastName] = useState("")
  const [newCasePhone, setNewCasePhone] = useState("")
  const [newCaseEmail, setNewCaseEmail] = useState("")
  const [newCasePatientId, setNewCasePatientId] = useState("")
  const [newCasePesel, setNewCasePesel] = useState("")
  const [newCaseError, setNewCaseError] = useState("")
  const [newCaseMessage, setNewCaseMessage] = useState("")
  const [newCaseClinic, setNewCaseClinic] = useState<string>("none")
  const [creating, setCreating] = useState(false)

  const hasIdentifier = Boolean(newCasePhone.trim() || newCaseEmail.trim() || newCasePatientId.trim() || newCasePesel.trim() || (newCaseFirstName.trim() && newCaseLastName.trim()))

  const notifications = useMemo(() => {
    if (!canViewTasks) return []
    const queue = getQueue(tasks, {}, Date.now())
    return queue
      .map((t) => buildQueueItem(t, Date.now(), cases))
      .filter((i): i is NonNullable<typeof i> => !!i && (i.task.priority === "P0" || i.task.priority === "P1" || i.overdue))
      .slice(0, 6)
  }, [tasks, cases, canViewTasks])

  function resetNewCase() {
    setNewCaseChannel("phone")
    setNewCaseFirstName("")
    setNewCaseLastName("")
    setNewCasePhone("")
    setNewCaseEmail("")
    setNewCasePatientId("")
    setNewCasePesel("")
    setNewCaseError("")
    setNewCaseMessage("")
    setNewCaseClinic("none")
  }

  function handleCreateCase() {
    if (!hasIdentifier) return
    setCreating(true)
    try {
      setNewCaseError("")
      const { caseId } = createDraftCase({
        channel: newCaseChannel,
        firstName: newCaseFirstName.trim() || undefined,
        lastName: newCaseLastName.trim() || undefined,
        phone: newCasePhone.trim() || undefined,
        email: newCaseEmail.trim() || undefined,
        externalPatientId: newCasePatientId.trim() || undefined,
        pesel: newCasePesel.trim() || undefined,
        clinicId: newCaseClinic !== "none" ? newCaseClinic as ClinicId : undefined,
        text: newCaseMessage.trim() || "Nowa sprawa utworzona ręcznie",
      })
      setNewCaseOpen(false)
      resetNewCase()
      openCase(caseId)
    } catch (error) { setNewCaseError(error instanceof Error ? error.message : "Nie udało się utworzyć sprawy.") }
    finally { setCreating(false) }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <div className="flex-1 leading-tight">
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>

      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="hidden w-64 items-center gap-2 rounded-md border border-input bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary lg:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{t("search_placeholder")}</span>
        {showKbd && (
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5" aria-label={t("language")}>
              <Languages className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === "pl" ? "PL" : "RU"}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t("language")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["pl", "ru"] as Language[]).map((lang) => (
              <DropdownMenuItem key={lang} onClick={() => setLanguage(lang)} className="justify-between">
                {lang === "pl" ? "Polski" : "Русский"}
                {language === lang && <span className="text-xs text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {canHandleCalls && <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="hidden gap-1.5 sm:flex">
              <PhoneIncoming className="h-3.5 w-3.5" />
              {t("simulate_call")}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t("demo_incoming_call")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setIncomingResult(null); setIncomingOpen(true) }}>Sprawdź znany numer (Patient Matching)</DropdownMenuItem>
            {DEMO_INCOMING_CALLS.map((demo) => (
              <DropdownMenuItem key={demo.caseId} onClick={() => simulateCaseCall(demo)}>
                {demo.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>}

      {callError && <p role="alert" className="text-xs text-destructive">{callError}</p>}
      <Dialog open={incomingOpen} onOpenChange={setIncomingOpen}>
        <DialogContent><DialogHeader><DialogTitle>Routing znanego numeru · demo</DialogTitle></DialogHeader>
          <Input aria-label="Numer przychodzący" value={incomingPhone} onChange={event => setIncomingPhone(event.target.value)} placeholder="+48 611 924 357" />
          <Button onClick={() => { try { setIncomingResult(routeIncomingCall(incomingPhone)) } catch (error) { setIncomingResult({ caseIds: [], message: error instanceof Error ? error.message : "Brak dostępu." }) } }}>Sprawdź i otwórz unikalną sprawę</Button>
          {incomingResult && <p role="status" className="text-sm">{incomingResult.message}</p>}
          {incomingResult?.caseIds.map(id => <Button key={id} variant="outline" onClick={() => { simulateCaseCall({ caseId: id }); setIncomingOpen(false) }}>Wybierz {id}</Button>)}
          <Button variant="outline" disabled={!canCreateCase} onClick={() => { setNewCasePhone(incomingPhone); setIncomingOpen(false); setNewCaseOpen(true) }}>Utwórz sprawę świadomie</Button>
        </DialogContent>
      </Dialog>
      {canViewTasks && <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications")}>
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("needs_attention")} ({notifications.length})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t("no_new_notifications")}</p>
            )}
            {notifications.map((item) => (
              <DropdownMenuItem
                key={item.task.id}
                className="flex flex-col items-start gap-0.5 whitespace-normal"
                onClick={() => openCase(item.case.id)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{item.patientName}</span>
                  <Badge className={cn("shrink-0 border-0 text-[10px] text-white", PRIORITY_TONE[item.task.priority])}>
                    {item.task.priority}
                  </Badge>
                </div>
                <span className="truncate text-xs text-muted-foreground">{item.task.title}</span>
                <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                  {item.clinicName} · {item.task.dueAt ? formatRelative(item.task.dueAt) : "—"}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>}

      <Dialog
        open={newCaseOpen}
        onOpenChange={(open) => {
          setNewCaseOpen(open)
          if (!open) resetNewCase()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("new_case")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("contact_channel")}</Label>
                <Select value={newCaseChannel} onValueChange={(v) => setNewCaseChannel(v as ContactChannel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("clinic_optional")}</Label>
                <Select value={newCaseClinic} onValueChange={(value) => setNewCaseClinic(value ?? "none")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("no_assignment")}</SelectItem>
                    {CLINICS.map((c) => {
                      const tone = getClinicTone(c.id)
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                            {c.name}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("first_name")}</Label>
                <Input value={newCaseFirstName} onChange={(e) => setNewCaseFirstName(e.target.value)} placeholder="Anna" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("last_name")}</Label>
                <Input value={newCaseLastName} onChange={(e) => setNewCaseLastName(e.target.value)} placeholder="Kowalska" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("phone_number")}</Label>
                <Input value={newCasePhone} onChange={(e) => setNewCasePhone(e.target.value)} placeholder="+48 600 000 000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input value={newCaseEmail} onChange={(e) => setNewCaseEmail(e.target.value)} placeholder="anna@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("patient_id_optional")}</Label>
              <Input
                value={newCasePatientId}
                onChange={(e) => setNewCasePatientId(e.target.value)}
                placeholder="np. MED-10234"
              />
              <p className="text-[11px] text-muted-foreground">
                Tylko unikalne, bezpieczne dopasowanie połączy sprawę automatycznie. Pozostałe wyniki wymagają weryfikacji.
              </p>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">PESEL do wyszukania (opcjonalny)</Label><Input value={newCasePesel} onChange={(event) => setNewCasePesel(event.target.value)} /></div>
            {newCaseError && <p role="alert" className="text-sm text-destructive">{newCaseError}</p>}
            <div className="space-y-1.5">
              <Label className="text-xs">Pierwsza notatka / wiadomość</Label>
              <Textarea
                value={newCaseMessage}
                onChange={(e) => setNewCaseMessage(e.target.value)}
                placeholder="Krótki opis zapytania pacjenta..."
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Anuluj</Button>} />
            <Button onClick={handleCreateCase} disabled={!hasIdentifier || creating} className="gap-1.5">
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Utwórz sprawę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canCreateCase && <Button size="sm" className="gap-1.5" onClick={() => setNewCaseOpen(true)}>
        <Plus className="h-4 w-4" />
        Nowa sprawa
      </Button>}
    </header>
  )
}
