import type { Task, TaskType } from "./entities"
import type { Language } from "./language-context"

const LABELS: Record<TaskType, Partial<Record<Language, string>>> = {
  call: { en: "Call", pl: "Zadzwoń", ru: "Позвонить" },
  message: { en: "Send message", pl: "Wyślij wiadomość", ru: "Отправить сообщение" },
  sms: { en: "Send SMS", pl: "Wyślij SMS", ru: "Отправить SMS" },
  email: { en: "Send email", pl: "Wyślij e-mail", ru: "Отправить e-mail" },
  qualification: { en: "Complete qualification", pl: "Uzupełnij kwalifikację", ru: "Заполнить квалификацию" },
  appointment_confirmation: { en: "Confirm appointment", pl: "Potwierdź wizytę", ru: "Подтвердить визит" },
  appointment_booking: { en: "Book appointment", pl: "Zarezerwuj wizytę", ru: "Забронировать визит" },
  post_visit_follow_up: { en: "Post-visit follow-up", pl: "Kontakt po wizycie", ru: "Контакт после визита" },
  waitlist_contact: { en: "Contact waitlist patient", pl: "Kontakt z listą oczekujących", ru: "Связаться с листом ожидания" },
  patient_care_handoff: { en: "Hand over to patient care", pl: "Przekaż opiekę", ru: "Передать в заботу о пациенте" },
  treatment_plan_review: { en: "Review treatment plan", pl: "Sprawdź plan leczenia", ru: "Проверить план лечения" },
  send_treatment_plan: { en: "Send treatment plan", pl: "Wyślij plan leczenia", ru: "Отправить план лечения" },
  custom: { en: "Custom task", pl: "Zadanie indywidualne", ru: "Индивидуальная задача" },
}

/** Canonical Polish business labels used for persisted prototype task titles. */
export const TASK_TYPE_LABELS = Object.fromEntries(
  Object.entries(LABELS).map(([type, labels]) => [type, labels.pl]),
) as Record<TaskType, string>

/** UI label for a task type in the current UI language. Task titles stored on records are data and stay untouched. */
export function taskTypeLabel(type: TaskType, language: Language) {
  return LABELS[type][language] ?? type.replaceAll("_", " ").replace(/^./, char => char.toUpperCase())
}

/** Workflow titles are seeded data, so present their canonical localized type. Manual titles remain user content. */
export function taskDisplayTitle(task: Pick<Task, "title" | "type" | "source" | "workflowRuleId">, language: Language) {
  return (task.source === "workflow" || task.workflowRuleId) && task.type
    ? taskTypeLabel(task.type, language)
    : task.title
}
