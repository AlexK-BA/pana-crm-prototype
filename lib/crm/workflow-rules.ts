import type { CaseBoard, EngagementCase, Task, TaskPriority } from "./entities"

export interface AutomaticTaskRule {
  id: string
  title: string
  priority: TaskPriority
  dueInMinutes: number
  requiresCall?: boolean
}

export interface WorkflowStageRule {
  board: CaseBoard
  status: string
  terminal?: boolean
  requiresReason?: boolean
  automaticTask?: AutomaticTaskRule
}

/**
 * Configurable prototype defaults. They demonstrate the workflow mechanism;
 * exact SLA values and task wording remain subject to Daniel/clinic approval.
 */
export const WORKFLOW_STAGE_RULES: WorkflowStageRule[] = [
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

export function getWorkflowStageRule(board: CaseBoard, status: string) {
  return WORKFLOW_STAGE_RULES.find((rule) => rule.board === board && rule.status === status)
}

export function buildAutomaticTask(rule: AutomaticTaskRule, engagementCase: EngagementCase, now = new Date()): Task {
  return {
    id: "", // assigned atomically by EntityStore
    caseId: engagementCase.id,
    patientId: engagementCase.patientId,
    title: rule.title,
    status: "planned",
    priority: rule.priority,
    dueAt: new Date(now.getTime() + rule.dueInMinutes * 60_000).toISOString(),
    createdAt: now.toISOString(),
    attempts: 0,
    requiresCall: rule.requiresCall,
    workflowRuleId: rule.id,
  }
}
