"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { maskMatchingIdentifier } from "@/lib/crm/patient-matching-service"
import { getClinic } from "@/lib/crm/catalog"
import { formatDateTime } from "@/lib/crm/format"
import { patientLinkLabel, resolvePatientLinkState } from "@/lib/crm/patient-link-state"
import { useLanguage } from "@/lib/crm/language-context"


/** A decision panel over canonical EntityStore references, not another patient profile. */
export function PatientLinkPanel({ caseId }: { caseId: string }) {
  const { cases, patients, identities, matchDecisions, currentUser, matchCaseToPatient, approvePatientMatch, rejectPatientMatch } = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { language } = useLanguage()
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState<{ decisionId: string; patientId?: string } | null>(null)
  const [reason, setReason] = useState("")
  const target = cases.find(item => item.id === caseId)
  const patient = patients.find(item => item.id === target?.patientId)
  const decision = matchDecisions.filter(item => item.caseId === caseId).at(-1)
  const canReview = hasPermission("patient:match_approve") && hasPermission("patient:view_basic")
  const unresolved = decision && ["pending", "conflict"].includes(decision.status)
  // A local Patient record is not proof of a Medical CRM link. The canonical
  // integration state remains authoritative until matching is approved.
  const state = patientLinkLabel(resolvePatientLinkState(target, patient, decision), language)
  function runSearch() {
    try { setError(""); matchCaseToPatient(caseId, currentUser.id) }
    catch (error) { setError(error instanceof Error ? error.message : "Wyszukiwanie nie powiodło się.") }
  }
  function confirm() {
    if (!confirmation) return
    try {
      setError("")
      if (confirmation.patientId) approvePatientMatch(confirmation.decisionId, confirmation.patientId, reason)
      else rejectPatientMatch(confirmation.decisionId, reason)
      setConfirmation(null); setReason("")
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać decyzji.") }
  }
  return <section aria-label="Patient Link" className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong>Patient Link · {state}</strong>
      <Button size="sm" variant="outline" disabled={!hasPermission("patient:edit_local")} onClick={runSearch}>Sprawdź ponownie</Button>
    </div>
    {patient && <p>{patient.firstName} {patient.lastName} {hasPermission("patient:view_basic") && <Link className="ml-2 underline" href={`/patients/${patient.id}`}>Otwórz profil</Link>}</p>}
    {decision && <p className="text-muted-foreground">{decision.reason} {canReview && <>· confidence {decision.confidence.toFixed(3)} · {decision.resolvedBy === "system" ? "System" : decision.resolvedBy ?? "Wyszukiwanie"} · {formatDateTime(decision.createdAt)}</>}</p>}
    {decision?.decision === "conflict" && <p role="status" className="text-amber-700">Nie wykonano automatycznego scalenia ani przeniesienia kontaktów.</p>}
    {!canReview && unresolved && decision.decision !== "no_match" && <p role="status">Możliwy pacjent wymaga sprawdzenia przez osobę uprawnioną. Możesz kontynuować pracę i uzupełnić kontakt.</p>}
    {canReview && decision?.candidates.map(candidate => {
      const item = patients.find(patient => patient.id === candidate.candidatePatientId)
      if (!item) return null
      const contacts = identities.filter(identity => identity.patientId === item.id && ["phone", "email"].includes(identity.channel))
      return <div key={item.id} className="space-y-1 rounded border border-border bg-background p-2">
        <p className="font-medium">{item.firstName} {item.lastName} · {getClinic(item.primaryClinicId)?.name} · {candidate.confidence.toFixed(3)}</p>
        <p>PESEL {maskMatchingIdentifier(item.pesel)} · {contacts.map(contact => `${contact.channel}: ${maskMatchingIdentifier(contact.value)}`).join(" · ") || "Kontakt ukryty / brak"}
          {hasPermission("patient:view_medical") && item.externalPatientId && <> · Medical CRM ID: {item.externalPatientId}</>}</p>
        <p>Sygnały: {candidate.matchedSignals.join(", ")} {candidate.conflictingSignals.length > 0 && <>· Konflikty: {candidate.conflictingSignals.join(", ")}</>}</p>
        <div className="flex flex-wrap gap-2">
          {hasPermission("patient:view_basic") && <Link className="underline" href={`/patients/${item.id}`}>Profil kandydata</Link>}
          {unresolved && <Button size="sm" variant="outline" onClick={() => { setReason(""); setError(""); setConfirmation({ decisionId: decision.id, patientId: item.id }) }}>Potwierdź pacjenta</Button>}
        </div>
      </div>
    })}
    {canReview && unresolved && <Button size="sm" variant="outline" onClick={() => { setReason(""); setError(""); setConfirmation({ decisionId: decision.id }) }}>Odrzuć / pozostaw bez powiązania</Button>}
    {!confirmation && error && <p role="alert" className="text-destructive">{error}</p>}
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open) setConfirmation(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{confirmation?.patientId ? "Potwierdzić powiązanie pacjenta?" : "Odrzucić propozycję powiązania?"}</DialogTitle></DialogHeader>
        <p className="text-sm">Decyzja zostanie zapisana. Dane Medical CRM i zadania pozostają zachowane.</p>
        <Input aria-label="Uzasadnienie decyzji" placeholder="Wymagane uzasadnienie" value={reason} onChange={event => setReason(event.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)}>Anuluj</Button><Button disabled={!reason.trim()} onClick={confirm}>Potwierdź decyzję</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
