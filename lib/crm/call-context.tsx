"use client"

/**
 * Global Call Card state (§7 Call Card).
 *
 * Models the Yeastar-backed call lifecycle: ringing → active → mandatory
 * wrap-up. A Task cannot be closed and the overlay cannot be dismissed until
 * a disposition is recorded, per the master spec's "no case left without a
 * next action" rule. Mounted once in providers.tsx so any screen can trigger
 * or observe a call.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { CallDisposition } from "./entities"
import { getClinic } from "./catalog"
import { useEntityStore } from "./entity-store"
import { isActive, getNextTaskForCase } from "./entity-queue"
import { useUserDirectory } from "./user-directory"
import { useAuthorization } from "./authorization-context"
import { useRole } from "./role-context"
import { assertMatchingAccess, patientWithinMatchingScope, routeIncomingPatientContact, type MatchingAccess } from "./patient-matching-service"
import type { ClinicId, EngagementCase } from "./entities"
import { useCasePanel } from "./panel-context"

export type CallPhase = "idle" | "incoming" | "active" | "wrapup"

export interface ActiveCall {
  caseId: string
  taskId?: string
  contactIdentityId?: string
  patientId?: string
  direction: "incoming" | "outgoing"
  callerLabel: string
  callerNumber: string
  clinicName: string
  startAt: string
  offeredToUserIds: string[]
  dismissedByUserIds: string[]
  claimedByUserId?: string
}

interface CallContextValue {
  phase: CallPhase
  call: ActiveCall | null
  elapsedSec: number
  simulateIncomingCall: (input: { caseId: string; taskId?: string; unknown?: boolean }) => void
  routeIncomingCall: (phone: string, clinicId?: ClinicId) => { caseIds: string[]; message: string }
  startOutgoingCall: (input: { caseId: string; taskId?: string; contactIdentityId?: string }) => void
  answer: () => void
  decline: () => void
  hangUp: () => void
  submitWrapUp: (disposition: CallDisposition, opts?: { rescheduleAt?: string; note?: string; duplicateOfCaseId?: string }) => boolean
}

const CallContext = createContext<CallContextValue | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { currentUser, users } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const { openCase } = useCasePanel()
  const { role } = useRole()
  const matchingAccess: MatchingAccess & {actorRole:typeof role} = { actorId: currentUser.id, active: currentUser.status === "active", hasPermission, globalScope: role === "admin" || role === "team_leader", clinicIds: currentUser.clinicIds, actorRole:role }
  const { tasks, cases, patients, identities, logCall, completeTask, rescheduleTask, ensureMissedCallTask, linkDuplicateCase, matchCaseToPatient, recordAudit } = useEntityStore()
  const [phase, setPhase] = useState<CallPhase>("idle")
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const actorId = currentUser.id
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    setElapsedSec(0)
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000)
  }, [stopTimer])

  const buildCall = useCallback(
    (input: { caseId: string; taskId?: string; contactIdentityId?: string; unknown?: boolean; direction: "incoming" | "outgoing" }): ActiveCall | null => {
      const engagementCase = cases.find((item) => item.id === input.caseId)
      if (!engagementCase) return null
      const clinicName = getClinic(engagementCase.clinicId)?.name ?? "Nieprzypisana klinika"
      const patient = patients.find((item) => item.id === engagementCase.patientId)
      const primaryIdentity = identities.find((item) => item.id === (input.contactIdentityId ?? engagementCase.contactIdentityId))
      if (input.contactIdentityId && (!primaryIdentity || primaryIdentity.channel !== "phone" || (!(engagementCase.patientId && primaryIdentity.patientId === engagementCase.patientId) && !(engagementCase.contactIdentityIds ?? [engagementCase.contactIdentityId]).includes(primaryIdentity.id)))) throw new Error("Numer nie należy do pacjenta / sprawy.")
      const offeredToUserIds = input.direction === "incoming"
        ? users
            .filter((user) => user.status === "active")
            .filter((user) => user.roles.some((role) => ["operator", "patient_care", "clinic_manager"].includes(role)))
            .filter((user) => !engagementCase.clinicId || user.clinicIds.includes(engagementCase.clinicId))
            .map((user) => user.id)
        : [actorId]
      return {
        caseId: input.caseId,
        taskId: input.taskId,
        contactIdentityId: primaryIdentity?.id,
        patientId: engagementCase.patientId,
        direction: input.direction,
        callerLabel: input.unknown
          ? "Nierozpoznany kontakt"
          : patient
            ? `${patient.firstName} ${patient.lastName}`
            : primaryIdentity?.displayName ?? "Nierozpoznany kontakt",
        callerNumber: primaryIdentity?.channel === "phone" ? primaryIdentity.value : "Numer nierozpoznany",
        clinicName,
        startAt: new Date().toISOString(),
        offeredToUserIds,
        dismissedByUserIds: [],
        claimedByUserId: input.direction === "outgoing" ? actorId : undefined,
      }
    },
    [actorId, cases, identities, patients, users],
  )

  const simulateIncomingCall = useCallback(
    (input: { caseId: string; taskId?: string; unknown?: boolean }) => {
      if (!hasPermission("call:handle") || phase !== "idle") return
      const target = cases.find(item => item.id === input.caseId)
      assertMatchingAccess(matchingAccess, "call:handle", target)
      if (!target) return
      const result = input.unknown ? undefined : matchCaseToPatient(input.caseId, actorId, matchingAccess, "incoming_call")
      const next = buildCall({ ...input, direction: "incoming" })
      if (!next) return
      if (result?.patientId) {
        next.patientId = result.patientId
        const patient = patients.find(item => item.id === result.patientId)
        if (patient) next.callerLabel = `${patient.firstName} ${patient.lastName}`
      } else if (!input.unknown && result && !result.matched) {
        // An ambiguous intake never displays the first candidate as an identified caller.
        next.patientId = undefined; next.callerLabel = "Kontakt wymaga weryfikacji Patient Link"
      }
      setCall(next)
      setPhase("incoming")
      openCase(next.caseId)
    },
    [buildCall, hasPermission, openCase, phase, cases, patients, matchCaseToPatient, actorId, currentUser, role],
  )

  const routeIncomingCall = (phone: string, clinicId?: ClinicId) => {
    assertMatchingAccess(matchingAccess, "call:handle", { clinicId } as EngagementCase)
    if (phase !== "idle") return { caseIds: [], message: "Zakończ bieżące połączenie i wrap-up przed kolejnym." }
    const route = routeIncomingPatientContact({ phone, clinicId }, patients, identities, cases)
    const patient = patients.find(item => item.id === route.patientId)
    const accessible = Boolean(patient && patientWithinMatchingScope(patient, matchingAccess))
    const caseIds = accessible ? route.caseIds.filter(id => cases.some(item => item.id === id && (matchingAccess.globalScope || (item.clinicId && currentUser.clinicIds.includes(item.clinicId))))) : []
    recordAudit({ type: route.result.decision === "conflict" ? "patient_match_conflict" : "patient_match_searched", actorId: "system",
      patientId: accessible ? route.patientId : undefined, confidence: route.result.candidates[0]?.confidence ?? 0,
      matchedSignals: route.result.candidates[0]?.matchedSignals ?? [], summary: `Routing połączenia · ${route.result.decision}`, correlationId: `incoming-${Date.now()}` })
    if (accessible && caseIds.length === 1) { simulateIncomingCall({ caseId: caseIds[0] }); return { caseIds: [], message: "Unikalny pacjent i aktywna sprawa — otwarto połączenie." } }
    return { caseIds, message: accessible ? "Pacjent rozpoznany. Wybierz aktywną sprawę lub utwórz nową — nie utworzono duplikatu." : "Kontakt wymaga weryfikacji albo nie ma dopasowania w Twoim zakresie. Utwórz samodzielną sprawę do oceny Patient Link." }
  }

  const startOutgoingCall = useCallback(
    (input: { caseId: string; taskId?: string; contactIdentityId?: string }) => {
      if (input.contactIdentityId) assertMatchingAccess(matchingAccess, "call:handle", cases.find(item => item.id === input.caseId))
      if (!hasPermission("call:handle") || phase !== "idle") return
      if(input.taskId){const task=tasks.find(task=>task.id===input.taskId);assertMatchingAccess(matchingAccess,"task:work",cases.find(item=>item.id===input.caseId));if(!task || task.caseId!==input.caseId || !isActive(task) || (task.ownerId && task.ownerId!==actorId && !hasPermission("task:assign")))throw new Error("Zadanie połączenia poza zakresem / zakończone.")}
      const next = buildCall({ ...input, direction: "outgoing" })
      if (!next) return
      setCall(next)
      setPhase("active")
      openCase(next.caseId)
      startTimer()
    },
    [buildCall, hasPermission, openCase, phase, startTimer, cases, tasks, actorId, currentUser, role],
  )

  const answer = useCallback(() => {
    if (!hasPermission("call:handle") || !call || call.claimedByUserId || !call.offeredToUserIds.includes(actorId)) return
    setCall((current) => (current ? { ...current, claimedByUserId: actorId } : current))
    setPhase("active")
    openCase(call.caseId)
    startTimer()
  }, [actorId, call, hasPermission, openCase, startTimer])

  const decline = useCallback(() => {
    if (!hasPermission("call:handle")) return
    if (call?.direction === "incoming") {
      if (!call.offeredToUserIds.includes(actorId)) return
      const dismissedByUserIds = [...new Set([...call.dismissedByUserIds, actorId])]
      const remaining = call.offeredToUserIds.filter((userId) => !dismissedByUserIds.includes(userId))
      if (remaining.length > 0) {
        setCall({ ...call, dismissedByUserIds })
        return
      }
      logCall({
        caseId: call.caseId,
        taskId: call.taskId,
        contactIdentityId: call.contactIdentityId,
        patientId: call.patientId,
        direction: call.direction,
        actorId,
        extension: currentUser.telephonyExtension ?? "101",
        clinicId: cases.find((item) => item.id === call.caseId)?.clinicId ?? "pana-medica",
        startAt: call.startAt,
        answered: false,
      })
      ensureMissedCallTask(call.caseId, call.patientId, matchingAccess)
    }
    stopTimer()
    setPhase("idle")
    setCall(null)
  }, [actorId, call, cases, currentUser.telephonyExtension, ensureMissedCallTask, hasPermission, logCall, matchingAccess, stopTimer])

  const hangUp = useCallback(() => {
    if (!hasPermission("call:handle")) return
    stopTimer()
    setPhase("wrapup")
  }, [hasPermission, stopTimer])

  const submitWrapUp = useCallback(
    (disposition: CallDisposition, opts?: { rescheduleAt?: string; note?: string; duplicateOfCaseId?: string }) => {
      if (!hasPermission("call:handle")) return false
      if (!call) {
        setPhase("idle")
        return false
      }

      const candidateTask = call.taskId ?? getNextTaskForCase(tasks.filter(task=>!task.ownerId||task.ownerId===actorId||hasPermission("task:assign")), call.caseId)?.id
      const relatedTask = tasks.find(task=>task.id===candidateTask)?.type==="send_treatment_plan" ? undefined : candidateTask
      const requiresRetry = disposition === "call_later" || disposition === "no_answer" || disposition === "not_reached" || disposition === "contact_failed"
      const retryAt = opts?.rescheduleAt ? new Date(opts.rescheduleAt).getTime() : Number.NaN
      if (requiresRetry && (!Number.isFinite(retryAt) || retryAt <= Date.now())) return false
      if (disposition === "duplicate" && (!opts?.duplicateOfCaseId || opts.duplicateOfCaseId === call.caseId)) return false

      const loggedCall = logCall({
        caseId: call.caseId,
        taskId: relatedTask,
        contactIdentityId: call.contactIdentityId,
        patientId: call.patientId,
        direction: call.direction,
        actorId,
        extension: currentUser.telephonyExtension ?? "101",
        clinicId: cases.find((item) => item.id === call.caseId)?.clinicId ?? "pana-medica",
        startAt: call.startAt,
        answered: disposition !== "no_answer" && disposition !== "not_reached",
        disposition,
        talkTimeSec: elapsedSec,
        note: opts?.note,
      })

      if (disposition === "duplicate" && opts?.duplicateOfCaseId) {
        linkDuplicateCase(call.caseId, opts.duplicateOfCaseId, actorId)
      }

      if (relatedTask) {
        if (requiresRetry) {
          const reason = opts?.note || (disposition === "call_later" ? "Ustalono kolejny kontakt po rozmowie" : `Nie udało się skontaktować · ${disposition}`)
          rescheduleTask(relatedTask, opts!.rescheduleAt!, reason, { actorId, callId: loggedCall.id, access: matchingAccess })
        } else {
          completeTask(relatedTask, disposition, { actorId, callId: loggedCall.id, access: matchingAccess })
        }
      }

      setCall(null)
      setElapsedSec(0)
      setPhase("idle")
      return true
    },
    [actorId, call, cases, completeTask, currentUser.telephonyExtension, elapsedSec, hasPermission, linkDuplicateCase, logCall, rescheduleTask, tasks],
  )

  const value = useMemo(
    () => ({ phase, call, elapsedSec, simulateIncomingCall, routeIncomingCall, startOutgoingCall, answer, decline, hangUp, submitWrapUp }),
    [phase, call, elapsedSec, simulateIncomingCall, routeIncomingCall, startOutgoingCall, answer, decline, hangUp, submitWrapUp],
  )

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCall must be used within CallProvider")
  return ctx
}
