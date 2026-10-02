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
import { getNextTaskForCase } from "./entity-queue"
import { useUserDirectory } from "./user-directory"
import { useAuthorization } from "./authorization-context"
import { useCasePanel } from "./panel-context"

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
  offeredToUserIds: string[]
  dismissedByUserIds: string[]
  claimedByUserId?: string
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
  submitWrapUp: (disposition: CallDisposition, opts?: { rescheduleAt?: string; note?: string; duplicateOfCaseId?: string }) => boolean
}

const CallContext = createContext<CallContextValue | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { currentUser, users } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const { openCase } = useCasePanel()
  const { tasks, cases, patients, identities, logCall, completeTask, rescheduleTask, ensureMissedCallTask, linkDuplicateCase } = useEntityStore()
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
    (input: { caseId: string; taskId?: string; unknown?: boolean; direction: "incoming" | "outgoing" }): ActiveCall | null => {
      const engagementCase = cases.find((item) => item.id === input.caseId)
      if (!engagementCase) return null
      const clinicName = getClinic(engagementCase.clinicId)?.name ?? "Nieprzypisana klinika"
      const patient = patients.find((item) => item.id === engagementCase.patientId)
      const primaryIdentity = identities.find((item) => item.id === engagementCase.contactIdentityId)
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
      const next = buildCall({ ...input, direction: "incoming" })
      if (!next) return
      setCall(next)
      setPhase("incoming")
      openCase(next.caseId)
    },
    [buildCall, hasPermission, openCase, phase],
  )

  const startOutgoingCall = useCallback(
    (input: { caseId: string; taskId?: string }) => {
      if (!hasPermission("call:handle") || phase !== "idle") return
      const next = buildCall({ ...input, direction: "outgoing" })
      if (!next) return
      setCall(next)
      setPhase("active")
      openCase(next.caseId)
      startTimer()
    },
    [buildCall, hasPermission, openCase, phase, startTimer],
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
        patientId: call.patientId,
        direction: call.direction,
        actorId,
        extension: currentUser.telephonyExtension ?? "101",
        clinicId: cases.find((item) => item.id === call.caseId)?.clinicId ?? "pana-medica",
        startAt: call.startAt,
        answered: false,
      })
      ensureMissedCallTask(call.caseId, call.patientId)
    }
    stopTimer()
    setPhase("idle")
    setCall(null)
  }, [actorId, call, cases, currentUser.telephonyExtension, ensureMissedCallTask, hasPermission, logCall, stopTimer])

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

      const relatedTask = call.taskId ?? getNextTaskForCase(tasks, call.caseId)?.id
      const requiresRetry = disposition === "call_later" || disposition === "no_answer" || disposition === "not_reached" || disposition === "contact_failed"
      const retryAt = opts?.rescheduleAt ? new Date(opts.rescheduleAt).getTime() : Number.NaN
      if (requiresRetry && (!Number.isFinite(retryAt) || retryAt <= Date.now())) return false
      if (disposition === "duplicate" && (!opts?.duplicateOfCaseId || opts.duplicateOfCaseId === call.caseId)) return false

      const loggedCall = logCall({
        caseId: call.caseId,
        taskId: call.taskId,
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
          rescheduleTask(relatedTask, opts!.rescheduleAt!, reason, { actorId, callId: loggedCall.id })
        } else {
          completeTask(relatedTask, disposition, { actorId, callId: loggedCall.id })
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
