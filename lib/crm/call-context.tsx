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
import { getCase } from "./entity-data"
import { ROLE_PROFILES } from "./roles"
import { getClinic } from "./catalog"
import { useEntityStore } from "./entity-store"
import { getNextTaskForCase } from "./entity-queue"
import { useUserDirectory } from "./user-directory"
import { useAuthorization } from "./authorization-context"

export type CallPhase = "idle" | "incoming" | "active" | "wrapup"

export interface ActiveCall {
  caseId: string
  taskId?: string
  patientId?: string
  direction: "incoming" | "outgoing"
  callerLabel: string
  callerNumber: string
  clinicName: string
  startAt: string
  offeredTo: string[]
  dismissedBy: string[]
  claimedBy?: string
}

interface CallContextValue {
  phase: CallPhase
  call: ActiveCall | null
  elapsedSec: number
  simulateIncomingCall: (input: { caseId: string; taskId?: string; unknown?: boolean }) => void
  startOutgoingCall: (input: { caseId: string; taskId?: string }) => void
  answer: () => void
  decline: () => void
  hangUp: () => void
  submitWrapUp: (disposition: CallDisposition, opts?: { rescheduleAt?: string; note?: string; duplicateOfCaseId?: string }) => void
}

const CallContext = createContext<CallContextValue | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const { tasks, logCall, completeTask, rescheduleTask, ensureMissedCallTask, linkDuplicateCase } = useEntityStore()
  const [phase, setPhase] = useState<CallPhase>("idle")
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const actorId = currentUser.id
  const actorName = currentUser.name

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
    (input: { caseId: string; taskId?: string; unknown?: boolean; direction: "incoming" | "outgoing" }): ActiveCall | null => {
      const engagementCase = getCase(input.caseId)
      if (!engagementCase) return null
      const clinicName = getClinic(engagementCase.clinicId)?.name ?? "Nieprzypisana klinika"
      return {
        caseId: input.caseId,
        taskId: input.taskId,
        patientId: engagementCase.patientId,
        direction: input.direction,
        callerLabel: input.unknown || !engagementCase.patientId ? "Nierozpoznany kontakt" : "Pacjent",
        callerNumber: "+48 592 817 364",
        clinicName,
        startAt: new Date().toISOString(),
        offeredTo: input.direction === "incoming"
          ? [ROLE_PROFILES.operator.user.name, ROLE_PROFILES.patient_care.user.name, ROLE_PROFILES.clinic_manager.user.name]
          : [actorName],
        dismissedBy: [],
        claimedBy: input.direction === "outgoing" ? actorName : undefined,
      }
    },
    [actorName],
  )

  const simulateIncomingCall = useCallback(
    (input: { caseId: string; taskId?: string; unknown?: boolean }) => {
      if (!hasPermission("call:handle")) return
      const next = buildCall({ ...input, direction: "incoming" })
      if (!next) return
      setCall(next)
      setPhase("incoming")
    },
    [buildCall, hasPermission],
  )

  const startOutgoingCall = useCallback(
    (input: { caseId: string; taskId?: string }) => {
      if (!hasPermission("call:handle")) return
      const next = buildCall({ ...input, direction: "outgoing" })
      if (!next) return
      setCall(next)
      setPhase("active")
      startTimer()
    },
    [buildCall, hasPermission, startTimer],
  )

  const answer = useCallback(() => {
    if (!hasPermission("call:handle") || !call || call.claimedBy) return
    setCall((current) => (current ? { ...current, claimedBy: actorName } : current))
    setPhase("active")
    startTimer()
  }, [actorName, call, hasPermission, startTimer])

  const decline = useCallback(() => {
    if (!hasPermission("call:handle")) return
    if (call?.direction === "incoming") {
      const dismissedBy = [...new Set([...call.dismissedBy, actorName])]
      const remaining = call.offeredTo.filter((operator) => !dismissedBy.includes(operator))
      if (remaining.length > 0) {
        setCall({ ...call, dismissedBy })
        return
      }
      logCall({
        caseId: call.caseId,
        taskId: call.taskId,
        patientId: call.patientId,
        direction: call.direction,
        actorId,
        extension: currentUser.telephonyExtension ?? "101",
        clinicId: getCase(call.caseId)?.clinicId ?? "pana-medica",
        startAt: call.startAt,
        answered: false,
      })
      ensureMissedCallTask(call.caseId, call.patientId)
    }
    stopTimer()
    setPhase("idle")
    setCall(null)
  }, [actorId, actorName, call, currentUser.telephonyExtension, ensureMissedCallTask, hasPermission, logCall, stopTimer])

  const hangUp = useCallback(() => {
    if (!hasPermission("call:handle")) return
    stopTimer()
    setPhase("wrapup")
  }, [hasPermission, stopTimer])

  const submitWrapUp = useCallback(
    (disposition: CallDisposition, opts?: { rescheduleAt?: string; note?: string; duplicateOfCaseId?: string }) => {
      if (!hasPermission("call:handle")) return
      if (!call) {
        setPhase("idle")
        return
      }
      logCall({
        caseId: call.caseId,
        taskId: call.taskId,
        patientId: call.patientId,
        direction: call.direction,
        actorId,
        extension: currentUser.telephonyExtension ?? "101",
        clinicId: getCase(call.caseId)?.clinicId ?? "pana-medica",
        startAt: call.startAt,
        answered: disposition !== "no_answer" && disposition !== "not_reached",
        disposition,
        talkTimeSec: elapsedSec,
        note: opts?.note,
      })

      if (disposition === "duplicate" && opts?.duplicateOfCaseId) {
        linkDuplicateCase(call.caseId, opts.duplicateOfCaseId, actorId)
      }

      const relatedTask = call.taskId ?? getNextTaskForCase(tasks, call.caseId)?.id
      const requiresRetry = disposition === "call_later" || disposition === "no_answer" || disposition === "not_reached" || disposition === "contact_failed"

      if (relatedTask) {
        if (requiresRetry) {
          if (!opts?.rescheduleAt) return
          const reason = opts.note || (disposition === "call_later" ? "Ustalono kolejny kontakt po rozmowie" : `Nie udało się skontaktować · ${disposition}`)
          rescheduleTask(relatedTask, opts.rescheduleAt, reason)
        } else {
          completeTask(relatedTask, disposition)
        }
      }

      setCall(null)
      setElapsedSec(0)
      setPhase("idle")
    },
    [actorId, call, completeTask, currentUser.telephonyExtension, elapsedSec, hasPermission, linkDuplicateCase, logCall, rescheduleTask, tasks],
  )

  const value = useMemo(
    () => ({ phase, call, elapsedSec, simulateIncomingCall, startOutgoingCall, answer, decline, hangUp, submitWrapUp }),
    [phase, call, elapsedSec, simulateIncomingCall, startOutgoingCall, answer, decline, hangUp, submitWrapUp],
  )

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCall must be used within CallProvider")
  return ctx
}
