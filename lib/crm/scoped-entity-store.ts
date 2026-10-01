"use client"

import { useMemo } from "react"
import { useEntityStore } from "./entity-store"
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

    return {
      ...store,
      cases,
      tasks: store.tasks.filter((item) => caseIds.has(item.caseId)),
      patients: store.patients.filter((item) => patientIds.has(item.id)),
      identities: store.identities.filter((item) => identityIds.has(item.id) || Boolean(item.patientId && patientIds.has(item.patientId))),
      interactions: store.interactions.filter((item) => caseIds.has(item.caseId)),
      auditEvents: store.auditEvents.filter((item) => !item.caseId || caseIds.has(item.caseId)),
      broadcasts: store.broadcasts.filter((item) => hasGlobalScope || !item.clinicId || currentUser.clinicIds.includes(item.clinicId)),
      currentUser,
    }
  }, [currentUser, role, store])
}
