"use client"

import { useMemo, useRef } from "react"
import { useEntityStore } from "./entity-store"
import { useAuthorization } from "./authorization-context"
import { patientWithinMatchingScope, type MatchingAccess } from "./patient-matching-service"
import { CLINICS } from "./catalog"
import { AccessCommandError } from "./permissions"
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
  const { currentUser, users } = useUserDirectory()
  const { hasPermission } = useAuthorization()
  const matchingAccessRef = useRef<MatchingAccess>({ actorId: currentUser.id, active: currentUser.status === "active", globalScope: role === "admin" || role === "team_leader", clinicIds: currentUser.clinicIds, hasPermission })
  matchingAccessRef.current = { actorId: currentUser.id, active: currentUser.status === "active", globalScope: role === "admin" || role === "team_leader", clinicIds: currentUser.clinicIds, hasPermission }
  Object.assign(matchingAccessRef.current, { actorRole: role, assignableUserScopes: Object.fromEntries(users.filter(user=>user.status==="active").map(user=>[user.id,user.roles.includes("admin")||user.roles.includes("team_leader")?CLINICS.map(clinic=>clinic.id):user.clinicIds])), assignableUserIds: users.filter(user => user.status === "active" && (role === "admin" || role === "team_leader" || user.clinicIds.some(id => currentUser.clinicIds.includes(id)))).map(user=>user.id) })

  return useMemo(() => {
    const mayTriageUnassigned = role === "operator" || role === "patient_care" || role === "team_leader" || role === "admin"
    const hasGlobalScope = role === "admin" || role === "team_leader"
    const operationalAccess = role !== "marketing" && currentUser.status === "active"
    const cases = operationalAccess && hasPermission("case:view")
      ? store.cases.filter((item) => hasGlobalScope || (item.clinicId ? currentUser.clinicIds.includes(item.clinicId) : mayTriageUnassigned))
      : []
    const caseIds = new Set(cases.map((item) => item.id))
    const matchingAccess: MatchingAccess = { actorId: currentUser.id, active: currentUser.status === "active", globalScope: hasGlobalScope, clinicIds: currentUser.clinicIds, hasPermission }
    const canReview = operationalAccess && hasPermission("patient:match_approve") && hasPermission("patient:view_basic")
    const matchingPatients = canReview ? store.patients.filter(patient => patientWithinMatchingScope(patient, matchingAccess)) : []
    const matchingPatientIds = new Set(matchingPatients.map(patient => patient.id))
    const patientIds = new Set(store.patients.filter(item => operationalAccess && hasPermission("patient:view_basic") && (hasGlobalScope || currentUser.clinicIds.includes(item.primaryClinicId))).map(item => item.id))
    const identityIds = new Set(cases.flatMap((item) => item.contactIdentityIds ?? [item.contactIdentityId]))

    const interactions = store.interactions.filter((item) => item.caseId ? caseIds.has(item.caseId)
      : isSmsMessage(item) && Boolean(item.patientId && patientIds.has(item.patientId))
        && (hasGlobalScope || Boolean(item.clinicId && currentUser.clinicIds.includes(item.clinicId))))
    const scopedInteractions = interactions.map(item => "aiTrace" in item && item.aiTrace && !hasPermission("ai:trace_view")
      ? { ...item, aiTrace: undefined }
      : item)
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
      tasks: hasPermission("task:view") ? store.tasks.filter((item) => caseIds.has(item.caseId)) : [],
      conversationControls: hasPermission("communication:view") ? store.conversationControls.filter(item => caseIds.has(item.caseId)) : [],
      // Policy timing/rules are operational read data; ai:manage controls mutations.
      aiConversationPolicies: hasPermission("communication:view") ? store.aiConversationPolicies.filter(item => hasGlobalScope || !item.clinicId || currentUser.clinicIds.includes(item.clinicId)) : [],
      botActivationSchedules: hasPermission("communication:view") ? store.botActivationSchedules.filter(item => caseIds.has(item.caseId)) : [],
      comments: operationalAccess && hasPermission("case:view") ? store.comments.filter(item => caseIds.has(item.caseId)) : [],
      patients: store.patients.filter((item) => patientIds.has(item.id) || matchingPatientIds.has(item.id)).map(item => {
        if (hasPermission("patient:view_medical")) return item
        return { id: item.id, externalPatientId: item.externalPatientId, firstName: item.firstName, lastName: item.lastName, preferredLanguage: item.preferredLanguage, primaryClinicId: item.primaryClinicId, integrationState: item.integrationState, lastSyncAt: item.lastSyncAt, careOwnerId: item.careOwnerId, contactable: item.contactable, consentNote: item.consentNote, localTags: item.localTags, localNote: item.localNote, provenance: [] }
      }),
      matchDecisions: store.matchDecisions.filter(item => caseIds.has(item.caseId)).map(item => ({ ...item,
        candidates: canReview ? item.candidates.filter(candidate => matchingPatientIds.has(candidate.candidatePatientId)) : [],
        candidatePatientId: canReview && item.candidatePatientId && matchingPatientIds.has(item.candidatePatientId) ? item.candidatePatientId : undefined,
        reason: canReview ? item.reason : "Powiązanie pacjenta wymaga bezpiecznej weryfikacji. Sprawa nadal pozostaje dostępna do pracy." })),
      bookAppointment: (input:Parameters<typeof store.bookAppointment>[0]) => store.bookAppointment(input,matchingAccessRef.current),
      changeTask: (id:string,input:Parameters<typeof store.changeTask>[1]) => store.changeTask(id,input,matchingAccessRef.current),
      completeTask: (id:string,outcome:Parameters<typeof store.completeTask>[1]) => store.completeTask(id,outcome,{access:matchingAccessRef.current}),
      reopenTask: (id:string,reason?:string) => store.reopenTask(id,matchingAccessRef.current,reason),
      skipTask: (id:string,reason:string) => store.skipTask(id,reason,matchingAccessRef.current),
      rescheduleTask: (id:string,dueAt:string,reason?:string) => store.rescheduleTask(id,dueAt,reason,{access:matchingAccessRef.current}),
      assignTask: (id:string,ownerId:string,_actorId:string,reason?:string) => store.assignTask(id,ownerId,matchingAccessRef.current.actorId,matchingAccessRef.current,reason),
      setPriority: (id:string,priority:Parameters<typeof store.setPriority>[1],_actorId:string,reason?:string) => store.setPriority(id,priority,matchingAccessRef.current.actorId,matchingAccessRef.current,reason),
      moveCase: (id:string,status:string,_actorId:string,options?:Parameters<typeof store.moveCase>[3]) => store.moveCase(id,status,matchingAccessRef.current.actorId,options,matchingAccessRef.current),
      createPatientCase: (input: Parameters<typeof store.createPatientCase>[0]) => store.createPatientCase(input, matchingAccessRef.current),
      createPatientTask: (input: Parameters<typeof store.createPatientTask>[0]) => store.createPatientTask(input, matchingAccessRef.current),
      completePatientTask: (id: string) => store.completePatientTask(id, matchingAccessRef.current),
      addPatientContact: (input: Parameters<typeof store.addPatientContact>[0]) => store.addPatientContact(input, matchingAccessRef.current),
      updatePatientLocal: (id: string, input: Parameters<typeof store.updatePatientLocal>[1]) => store.updatePatientLocal(id, input, matchingAccessRef.current),
      addCaseComment: (id: string, text: string) => store.addCaseComment(id, text, matchingAccessRef.current),
      syncPatientWithMedicalCrm: (id: string, _actorId: string) => store.syncPatientWithMedicalCrm(id, matchingAccessRef.current.actorId, matchingAccessRef.current),
      sendTreatmentPlanTask: (patientId: string, caseId: string, _actorId: string) => store.sendTreatmentPlanTask(patientId, caseId, matchingAccessRef.current.actorId, matchingAccessRef.current),
      createDraftCase: (input: Parameters<typeof store.createDraftCase>[0]) => store.createDraftCase(input, matchingAccessRef.current),
      matchCaseToPatient: (id: string, _actorId: string) => {
        if (!caseIds.has(id)) throw new AccessCommandError("Sprawa poza zakresem dostępu.")
        const result = store.matchCaseToPatient(id, matchingAccessRef.current.actorId, matchingAccessRef.current)
        return { ...result, patientId: result.patientId && (hasGlobalScope || store.patients.some(patient => patient.id === result.patientId && patientWithinMatchingScope(patient, matchingAccess))) ? result.patientId : undefined }
      },
      approvePatientMatch: (id: string, patientId: string, reason: string) => {
        const decision = store.matchDecisions.find(item => item.id === id)
        if (!decision || !caseIds.has(decision.caseId)) throw new AccessCommandError("Decyzja poza zakresem dostępu.")
        store.approvePatientMatch(id, patientId, reason, matchingAccessRef.current)
      },
      rejectPatientMatch: (id: string, reason: string) => {
        const decision = store.matchDecisions.find(item => item.id === id)
        if (!decision || !caseIds.has(decision.caseId)) throw new AccessCommandError("Decyzja poza zakresem dostępu.")
        store.rejectPatientMatch(id, reason, matchingAccessRef.current)
      },
      saveCaseContactProfile: (input: Parameters<typeof store.saveCaseContactProfile>[0]) => {
        if (!caseIds.has(input.caseId)) throw new AccessCommandError("Sprawa poza zakresem dostępu.")
        return store.saveCaseContactProfile({ ...input, actorId: matchingAccessRef.current.actorId }, matchingAccessRef.current)
      },
      identities: store.identities.filter((item) => identityIds.has(item.id) || Boolean(item.patientId && (patientIds.has(item.patientId) || matchingPatientIds.has(item.patientId)))),
      interactions: hasPermission("communication:view") ? scopedInteractions : [],
      sendMessage: (input: Parameters<typeof store.sendMessage>[0]) => {
        if (!caseIds.has(input.caseId)) throw new AccessCommandError("Sprawa poza zakresem dostępu.")
        return store.sendMessage({ ...input, authorId: input.direction === "outgoing" ? currentUser.id : undefined,
          senderKind: input.direction === "outgoing" ? "user" : input.senderKind ?? "patient" }, matchingAccessRef.current)
      },
      setConversationMode: (input: Parameters<typeof store.setConversationMode>[0]) => store.setConversationMode(input, matchingAccessRef.current),
      setConversationAiEnabled: (input: Parameters<typeof store.setConversationAiEnabled>[0]) => store.setConversationAiEnabled(input, matchingAccessRef.current),
      updateAiConversationPolicy: (id: string, patch: Parameters<typeof store.updateAiConversationPolicy>[1], reason: string) => store.updateAiConversationPolicy(id, patch, reason, matchingAccessRef.current),
      activateDueBot: (threadKey: string) => store.activateDueBot(threadKey, matchingAccessRef.current),
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
      auditEvents: hasPermission("audit:view") ? store.auditEvents.filter((item) => item.caseId ? caseIds.has(item.caseId) : !item.patientId || patientIds.has(item.patientId)) : [],
      broadcasts: store.broadcasts.filter((item) => hasGlobalScope || !item.clinicId || currentUser.clinicIds.includes(item.clinicId)),
      currentUser,
    }
  }, [currentUser, users, hasPermission, role, store])
}
