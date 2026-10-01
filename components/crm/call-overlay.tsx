"use client"

import { useMemo, useState } from "react"
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Clock, Building2, Search, LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useCall } from "@/lib/crm/call-context"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useRole } from "@/lib/crm/role-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"
import type { CallDisposition } from "@/lib/crm/entities"

/**
 * Wrap-up options differ by call direction: on an outgoing call (we dialed
 * the patient) "no answer"/"couldn't reach" are real outcomes, but on an
 * incoming call the contact plainly reached us — those don't apply, while a
 * mid-call disconnect or a caller who dialed the wrong clinic do.
 */
const OUTGOING_DISPOSITIONS: { value: CallDisposition; label: string }[] = [
  { value: "appointment_scheduled", label: "Umówiono wizytę" },
  { value: "call_later", label: "Zadzwonić później" },
  { value: "no_answer", label: "Brak odpowiedzi" },
  { value: "not_reached", label: "Nie udało się dotrzeć" },
  { value: "wrong_number", label: "Błędny numer" },
  { value: "duplicate", label: "Duplikat sprawy" },
  { value: "resignation", label: "Rezygnacja pacjenta" },
]

const INCOMING_DISPOSITIONS: { value: CallDisposition; label: string }[] = [
  { value: "appointment_scheduled", label: "Umówiono wizytę" },
  { value: "call_later", label: "Oddzwonić z informacją" },
  { value: "duplicate", label: "Duplikat sprawy" },
  { value: "wrong_number", label: "Pomylony numer / zła klinika" },
  { value: "contact_failed", label: "Rozłączono w trakcie" },
  { value: "resignation", label: "Rezygnacja pacjenta" },
]

const RETRY_DISPOSITIONS: CallDisposition[] = ["call_later", "no_answer", "not_reached", "contact_failed"]

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Local datetime-input value defaulted to `hoursFromNow` from now. */
function defaultLocalDateTime(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  d.setSeconds(0, 0)
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CallOverlay() {
  const { phase, call, elapsedSec, answer, decline, hangUp, submitWrapUp } = useCall()
  const { cases, identities, patients } = useScopedEntityStore()
  const { role } = useRole()
  const actorId = ROLE_PROFILES[role].user.name
  const [disposition, setDisposition] = useState<CallDisposition | null>(null)
  const [note, setNote] = useState("")
  const [rescheduleAt, setRescheduleAt] = useState(() => defaultLocalDateTime(24))
  const [duplicateQuery, setDuplicateQuery] = useState("")
  const [duplicateOfCaseId, setDuplicateOfCaseId] = useState<string | null>(null)

  const dispositions = call?.direction === "incoming" ? INCOMING_DISPOSITIONS : OUTGOING_DISPOSITIONS

  const duplicateResults = useMemo(() => {
    const q = duplicateQuery.trim().toLowerCase()
    if (!q || !call) return []
    return cases
      .filter((c) => c.id !== call.caseId)
      .map((c) => {
        const identity = identities.find((i) => i.id === c.contactIdentityId)
        const patient = patients.find((p) => p.id === c.patientId)
        const name = patient ? `${patient.firstName} ${patient.lastName}` : identity?.displayName ?? "Nierozpoznany kontakt"
        const value = identity?.value ?? ""
        return { case: c, name, value }
      })
      .filter((r) => r.name.toLowerCase().includes(q) || r.value.toLowerCase().includes(q))
      .slice(0, 6)
  }, [duplicateQuery, cases, identities, patients, call])

  if (phase === "idle" || !call) return null

  if (call.direction === "incoming" && call.dismissedBy.includes(actorId)) return null

  if (phase === "active" && call.claimedBy && call.claimedBy !== actorId) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-card p-4 shadow-2xl">
        <p className="text-sm font-semibold text-foreground">Połączenie zostało odebrane</p>
        <p className="mt-1 text-xs text-muted-foreground">Obsługuje: {call.claimedBy}</p>
      </div>
    )
  }

  if (phase === "incoming" || phase === "active") {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-medium text-white",
            phase === "incoming" ? "bg-emerald-600" : "bg-sky-600",
          )}
        >
          {call.direction === "incoming" ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
          {phase === "incoming" ? "Połączenie przychodzące" : "Połączenie w trakcie"}
          {phase === "active" && (
            <span className="ml-auto flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {formatElapsed(elapsedSec)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
              phase === "incoming" ? "animate-pulse bg-emerald-500" : "bg-sky-500",
            )}
          >
            <Phone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{call.callerLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{call.callerNumber}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {call.clinicName}
            </p>
            {call.direction === "incoming" && phase === "incoming" && (
              <p className="mt-1 text-[11px] text-emerald-700">
                Wspólna kolejka · dostępne dla {call.offeredTo.length - call.dismissedBy.length} konsultantów
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          {phase === "incoming" ? (
            <>
              <Button variant="destructive" size="sm" className="flex-1 gap-1.5" onClick={decline}>
                <PhoneOff className="h-3.5 w-3.5" />
                Odrzuć
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={answer}>
                <Phone className="h-3.5 w-3.5" />
                Odbierz
              </Button>
            </>
          ) : (
            <Button variant="destructive" size="sm" className="w-full gap-1.5" onClick={hangUp}>
              <PhoneOff className="h-3.5 w-3.5" />
              Zakończ połączenie
            </Button>
          )}
        </div>
      </div>
    )
  }

  const retryRequired = Boolean(disposition && RETRY_DISPOSITIONS.includes(disposition))
  const rescheduleTime = rescheduleAt ? new Date(rescheduleAt).getTime() : Number.NaN
  const validRetryDate = !retryRequired || (Number.isFinite(rescheduleTime) && rescheduleTime > Date.now())
  const canSubmit = Boolean(disposition) && validRetryDate && (disposition !== "duplicate" || Boolean(duplicateOfCaseId))

  const handleSubmit = () => {
    if (!disposition) return
    submitWrapUp(disposition, {
      note: note.trim() || undefined,
      rescheduleAt: retryRequired ? new Date(rescheduleAt).toISOString() : undefined,
      duplicateOfCaseId: disposition === "duplicate" ? duplicateOfCaseId ?? undefined : undefined,
    })
    setDisposition(null)
    setNote("")
    setRescheduleAt(defaultLocalDateTime(24))
    setDuplicateQuery("")
    setDuplicateOfCaseId(null)
  }

  // Mandatory wrap-up: no escape/backdrop dismissal until a disposition is submitted.
  return (
    <Dialog open disablePointerDismissal onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {call.direction === "incoming" ? (
              <PhoneIncoming className="h-4 w-4 text-emerald-600" />
            ) : (
              <PhoneOutgoing className="h-4 w-4 text-sky-600" />
            )}
            <DialogTitle>Podsumowanie rozmowy</DialogTitle>
          </div>
          <DialogDescription>
            {call.direction === "incoming" ? "Połączenie przychodzące" : "Połączenie wychodzące"} · {call.callerLabel} · czas rozmowy{" "}
            {formatElapsed(elapsedSec)} — wybierz wynik, aby zamknąć zadanie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Wynik rozmowy</Label>
            <div className="grid grid-cols-2 gap-2">
              {dispositions.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    setDisposition(d.value)
                    if (d.value !== "duplicate") {
                      setDuplicateQuery("")
                      setDuplicateOfCaseId(null)
                    }
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors",
                    disposition === d.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground hover:bg-secondary",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {retryRequired && (
            <div className="rounded-md border border-input bg-secondary/40 p-3">
              <Label htmlFor="call-reschedule" className="mb-2 block text-xs text-muted-foreground">
                Kiedy zadzwonić ponownie
              </Label>
              <Input
                id="call-reschedule"
                type="datetime-local"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
                className="text-sm"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Zadanie pozostanie aktywne, zostanie przełożone na wybrany termin i wróci do kolejki.
              </p>
              {!validRetryDate && (
                <p className="mt-1 text-[11px] font-medium text-red-600">Wybierz termin w przyszłości.</p>
              )}
            </div>
          )}

          {disposition === "duplicate" && (
            <div className="rounded-md border border-input bg-secondary/40 p-3">
              <Label htmlFor="call-duplicate" className="mb-2 block text-xs text-muted-foreground">
                Znajdź sprawę, której to jest duplikat
              </Label>
              {duplicateOfCaseId ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                  <span className="flex items-center gap-1.5 truncate">
                    <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                    {duplicateResults.find((r) => r.case.id === duplicateOfCaseId)?.name ?? "Wybrana sprawa"}
                  </span>
                  <button type="button" className="shrink-0 text-[11px] underline" onClick={() => setDuplicateOfCaseId(null)}>
                    Zmień
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="call-duplicate"
                      value={duplicateQuery}
                      onChange={(e) => setDuplicateQuery(e.target.value)}
                      placeholder="Imię, nazwisko, telefon lub e-mail..."
                      className="pl-8 text-sm"
                    />
                  </div>
                  {duplicateQuery.trim() && (
                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                      {duplicateResults.length === 0 ? (
                        <p className="px-1 py-1 text-[11px] text-muted-foreground">Brak wyników — spróbuj innego imienia lub numeru.</p>
                      ) : (
                        duplicateResults.map((r) => (
                          <button
                            key={r.case.id}
                            type="button"
                            onClick={() => setDuplicateOfCaseId(r.case.id)}
                            className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
                          >
                            <span className="font-medium text-foreground">{r.name}</span>
                            <span className="text-[11px] text-muted-foreground">{r.value || r.case.id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="call-note" className="mb-2 block text-xs text-muted-foreground">
              Notatka (opcjonalnie)
            </Label>
            <Textarea
              id="call-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Szczegóły rozmowy dla zespołu..."
              className="min-h-20 text-sm"
            />
          </div>

          <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
            Zapisz i zamknij
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
