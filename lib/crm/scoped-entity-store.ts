"use client"

import { useMemo } from "react"
import { useEntityStore } from "./entity-store"
import { useAuthorization } from "./authorization-context"
import { isSmsMessage } from "./sms-service"
import { useRole } from "./role-context"
import { useUserDirectory } from "./user-directory"

/**
 * Prototype equivalent of backend row-level security.
 * Production must apply the same clinic/team predicates in every API query
 * and mutation; filtering in the browser is not a security boundary.
 */
export function useScopedEntityStore() {
  const store = useEntityStore()
  const { role } = useRole()
  const { currentUser } = useUserDirectory()
  const { hasPermission } = useAuthorization()

  return useMemo(() => {
    const mayTriageUnassigned = role === "operator" || role === "patient_care" || role === "team_leader" || role === "admin"
    const hasGlobalScope = role === "admin" || role === "team_leader"
    const operationalAccess = role !== "marketing"
    const cases = operationalAccess
      ? store.cases.filter((item) => hasGlobalScope || (item.clinicId ? currentUser.clinicIds.includes(item.clinicId) : mayTriageUnassigned))
      : []
    const caseIds = new Set(cases.map((item) => item.id))
    const patientIds = new Set(cases.map((item) => item.patientId).filter((id): id is string => Boolean(id)))
    const identityIds = new Set(cases.map((item) => item.contactIdentityId))

    const interactions = store.interactions.filter((item) => item.caseId ? caseIds.has(item.caseId)
      : isSmsMessage(item) && Boolean(item.patientId && patientIds.has(item.patientId))
        && (hasGlobalScope || Boolean(item.clinicId && currentUser.clinicIds.includes(item.clinicId))))
    const requirePermission = (permission: Parameters<typeof hasPermission>[0]) => {
      if (currentUser.status !== "active" || !hasPermission(permission)) throw new Error("Brak uprawnień do tej operacji SMS.")
    }
    const assertSmsScope = (input: { caseId?: string; patientId?: string; clinicId?: string }) => {
      if (input.caseId ? !caseIds.has(input.caseId) : !input.patientId || !patientIds.has(input.patientId)) {
        throw new Error("SMS poza zakresem dostępu.")
      }
      if (input.clinicId && !hasGlobalScope && !currentUser.clinicIds.includes(input.clinicId as typeof currentUser.clinicIds[number])) {
        throw new Error("Klinika poza zakresem dostępu.")
      }
    }

    return {
      ...store,
      cases,
      tasks: store.tasks.filter((item) => caseIds.has(item.caseId)),
      patients: store.patients.filter((item) => patientIds.has(item.id)),
      identities: store.identities.filter((item) => identityIds.has(item.id) || Boolean(item.patientId && patientIds.has(item.patientId))),
      interactions,
      sendSms: (input: Parameters<typeof store.sendSms>[0]) => {
        requirePermission("communication:send")
        requirePermission("sms:send_custom")
        if (input.retryOfId) requirePermission("sms:retry")
        const clinicId = cases.find((item) => item.id === input.caseId)?.clinicId
          ?? input.clinicId ?? store.patients.find((item) => item.id === input.patientId)?.primaryClinicId
        assertSmsScope({ ...input, clinicId })
        return store.sendSms({ ...input, authorId: currentUser.id })
      },
      retrySms: (id: string, _authorId: string, simulateError = false) => {
        requirePermission("communication:send")
        requirePermission("sms:send_custom")
        requirePermission("sms:retry")
        const original = interactions.find((item) => item.id === id)
        if (!original || !isSmsMessage(original)) throw new Error("SMS poza zakresem dostępu.")
        assertSmsScope(original)
        return store.retrySms(id, currentUser.id, simulateError)
      },
      updateSmsProviderConfiguration: (id: string, patch: Parameters<typeof store.updateSmsProviderConfiguration>[1]) => {
        requirePermission("sms:provider_manage")
        const config = store.smsProviderConfigurations.find((item) => item.id === id)
        if (!config || (!hasGlobalScope && (!config.clinicId || !currentUser.clinicIds.includes(config.clinicId)))) {
          throw new Error("Konfiguracja poza zakresem dostępu.")
        }
        store.updateSmsProviderConfiguration(id, patch, currentUser.id)
      },
      testSmsProviderConfiguration: (id: string) => {
        requirePermission("sms:provider_manage")
        const config = store.smsProviderConfigurations.find((item) => item.id === id)
        if (!config || (!hasGlobalScope && (!config.clinicId || !currentUser.clinicIds.includes(config.clinicId)))) {
          throw new Error("Konfiguracja poza zakresem dostępu.")
        }
        store.testSmsProviderConfiguration(id, currentUser.id)
      },
      auditEvents: store.auditEvents.filter((item) => !item.caseId || caseIds.has(item.caseId)),
      broadcasts: store.broadcasts.filter((item) => hasGlobalScope || !item.clinicId || currentUser.clinicIds.includes(item.clinicId)),
      currentUser,
    }
  }, [currentUser, hasPermission, role, store])
}
