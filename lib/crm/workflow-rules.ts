import type { CaseBoard, EngagementCase, Task, TaskPriority, TaskType, TaskOutcome } from "./entities"

export const TASK_TYPE_LABELS: Record<TaskType,string> = {call:"Zadzwoń",message:"Wyślij wiadomość",sms:"Wyślij SMS",email:"Wyślij e-mail",qualification:"Uzupełnij kwalifikację",appointment_confirmation:"Potwierdź wizytę",appointment_booking:"Zarezerwuj wizytę",post_visit_follow_up:"Kontakt po wizycie",waitlist_contact:"Kontakt z listą oczekujących",patient_care_handoff:"Przekaż opiekę",treatment_plan_review:"Sprawdź plan leczenia",send_treatment_plan:"Wyślij plan leczenia",custom:"Zadanie indywidualne"}

export interface AutomaticTaskRule {
  id: string
  title: string
  priority: TaskPriority
  dueInMinutes: number
  requiresCall?: boolean
  type?: TaskType
  description?: string
  duePolicy?: "sla" | "manual" | "appointment" | "clinical"
  allowedOutcomes?: TaskOutcome[]
}

export interface WorkflowStageRule {
  board: CaseBoard
  status: string
  terminal?: boolean
  requiresReason?: boolean
  automaticTask?: AutomaticTaskRule
  suggestedTasks?: TaskType[]
  nextActionMandatory?: boolean
  enabled?: boolean
  automationWorkflowKey?: string
  configurability?: "clinic-config-required"
}

/**
 * Configurable prototype defaults. They demonstrate the workflow mechanism;
 * exact SLA values and task wording remain subject to Daniel/clinic approval.
 */
const BASE_STAGE_RULES: WorkflowStageRule[] = [
  { board: "leads", status: "new", automaticTask: { id: "leads.new.first-contact", title: "Pierwszy kontakt z nowym leadem", priority: "P2", dueInMinutes: 15 } },
  { board: "leads", status: "qualification", automaticTask: { id: "leads.qualification.complete", title: "Uzupełnij kwalifikację i kolejny krok", priority: "P2", dueInMinutes: 240 } },
  { board: "leads", status: "waiting", automaticTask: { id: "leads.waiting.offer-slot", title: "Zaproponuj termin z listy oczekujących", priority: "P2", dueInMinutes: 1440 } },
  { board: "leads", status: "call_later" },
  { board: "leads", status: "failed", requiresReason: true },
  { board: "leads", status: "closed", terminal: true, requiresReason: true },
  { board: "leads", status: "converted", terminal: true },

  { board: "deals", status: "scheduled", automaticTask: { id: "deals.scheduled.confirm", title: "Potwierdź zaplanowaną wizytę", priority: "P2", dueInMinutes: 1440 } },
  { board: "deals", status: "post_visit", automaticTask: { id: "deals.post-visit.follow-up", title: "Kontakt po wizycie", priority: "P2", dueInMinutes: 1440 } },
  { board: "deals", status: "recall", automaticTask: { id: "deals.recall.schedule", title: "Zaplanuj zalecaną wizytę kontrolną", priority: "P3", dueInMinutes: 43200 } },
  { board: "deals", status: "care", automaticTask: { id: "deals.care.handoff", title: "Przejmij opiekę nad pacjentem", priority: "P2", dueInMinutes: 1440 } },
  { board: "deals", status: "no_show", automaticTask: { id: "deals.no-show.call", title: "Skontaktuj się po niezjawieniu", priority: "P1", dueInMinutes: 15, requiresCall: true } },
  { board: "deals", status: "completed", terminal: true },

  { board: "patients", status: "appt_scheduled", automaticTask: { id: "patients.scheduled.reminder", title: "Potwierdź najbliższą wizytę", priority: "P2", dueInMinutes: 1440 } },
  { board: "patients", status: "new_patient", automaticTask: { id: "patients.new.welcome", title: "Pierwszy kontakt opieki nad pacjentem", priority: "P2", dueInMinutes: 1440 } },
  { board: "patients", status: "returning", automaticTask: { id: "patients.returning.next-step", title: "Ustal kolejny krok powracającego pacjenta", priority: "P3", dueInMinutes: 10080 } },
  { board: "patients", status: "in_treatment", automaticTask: { id: "patients.treatment.review", title: "Sprawdź kolejny etap planu leczenia", priority: "P3", dueInMinutes: 10080 } },
  { board: "patients", status: "control", automaticTask: { id: "patients.control.schedule", title: "Zaplanuj zdjęcie kontrolne", priority: "P3", dueInMinutes: 10080 } },
  { board: "patients", status: "complete", terminal: true },
]

const STAGE_TYPES: Record<string, TaskType> = {
  "leads.new": "call", "leads.qualification": "qualification", "leads.waiting": "waitlist_contact",
  "deals.scheduled": "appointment_confirmation", "deals.post_visit": "post_visit_follow_up", "deals.recall": "appointment_booking", "deals.care": "patient_care_handoff", "deals.no_show": "call",
  "patients.appt_scheduled": "appointment_confirmation", "patients.new_patient": "message", "patients.returning": "qualification", "patients.in_treatment": "treatment_plan_review", "patients.control": "appointment_booking",
}
const SUGGESTED: Record<string, TaskType[]> = {
  "leads.new": ["qualification", "message"], "leads.qualification": ["appointment_booking", "call", "message"], "leads.waiting": ["waitlist_contact", "appointment_booking"],
  "leads.call_later": ["call", "message", "sms", "email"], "leads.failed": ["call", "message", "email"], "leads.converted": ["appointment_booking"],
  "deals.scheduled": ["sms", "email"], "deals.post_visit": ["post_visit_follow_up", "send_treatment_plan"], "deals.recall": ["appointment_booking"], "deals.care": ["patient_care_handoff"], "deals.no_show": ["call"], "deals.completed": ["patient_care_handoff", "appointment_booking"],
  "patients.appt_scheduled": ["sms"], "patients.new_patient": ["treatment_plan_review", "message"], "patients.returning": ["appointment_booking"], "patients.in_treatment": ["send_treatment_plan"], "patients.control": ["appointment_booking"], "patients.complete": ["post_visit_follow_up", "appointment_booking"],
}
export const WORKFLOW_STAGE_RULES: WorkflowStageRule[] = BASE_STAGE_RULES.map(rule => {
  const key = `${rule.board}.${rule.status}`
  const manual = ["recall", "returning", "in_treatment", "control"].includes(rule.status)
  return { ...rule, enabled: true, configurability: "clinic-config-required", nextActionMandatory: !rule.terminal,
    suggestedTasks: SUGGESTED[key] ?? [], automaticTask: rule.automaticTask ? { ...rule.automaticTask,
      type: STAGE_TYPES[key], requiresCall: STAGE_TYPES[key] === "call" || rule.automaticTask.requiresCall,
      duePolicy: ["scheduled", "appt_scheduled"].includes(rule.status) ? "appointment" : manual ? "clinical" : "sla",
      description: key==="leads.new"?"Pierwszy kontakt: sprawdź Patient Matching, określ klinikę, usługę i język; ustal następny krok.":key==="patients.new_patient"?"Kontakt powitalny: sprawdź dostępny plan leczenia i preferowany kanał bez edycji danych Medical CRM.":rule.automaticTask.title,
      allowedOutcomes: rule.status === "no_show" ? ["rescheduled", "no_answer", "refused", "wrong_number", "contact_failed"] : undefined } : undefined }
})

export function getWorkflowStageRule(board: CaseBoard, status: string) {
  return WORKFLOW_STAGE_RULES.find((rule) => rule.board === board && rule.status === status)
}

export function buildAutomaticTask(rule: AutomaticTaskRule, engagementCase: EngagementCase, now = new Date()): Task {
  return {
    id: "", // assigned atomically by EntityStore
    caseId: engagementCase.id,
    patientId: engagementCase.patientId,
    title: rule.title,
    description: rule.description ?? rule.title,
    type: rule.type ?? (rule.requiresCall ? "call" : "custom"),
    source: "workflow", mandatory: true, rescheduleCount: 0,
    handoffState: rule.type === "patient_care_handoff" ? "pending" : undefined,
    status: "planned",
    priority: rule.priority,
    dueAt: new Date(now.getTime() + rule.dueInMinutes * 60_000).toISOString(),
    originalDueAt: new Date(now.getTime() + rule.dueInMinutes * 60_000).toISOString(),
    createdAt: now.toISOString(),
    attempts: 0,
    requiresCall: rule.requiresCall,
    workflowRuleId: rule.id,
  }
}
