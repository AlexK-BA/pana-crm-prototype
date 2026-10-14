import type { Task, TaskType } from "./entities"
import { translate, type Language } from "./language-context"
import { inlineEnglish } from "./inline-english"
import { localizeDemoText } from "./demo-text"

const LABELS: Record<TaskType, Partial<Record<Language, string>>> = {
  call: { en: "Call", pl: "Zadzwoń", ru: "Позвонить", es: "Llamar" },
  message: { en: "Send message", pl: "Wyślij wiadomość", ru: "Отправить сообщение", es: "Enviar mensaje" },
  sms: { en: "Send SMS", pl: "Wyślij SMS", ru: "Отправить SMS", es: "Enviar SMS" },
  email: { en: "Send email", pl: "Wyślij e-mail", ru: "Отправить e-mail", es: "Enviar correo electrónico" },
  qualification: { en: "Complete qualification", pl: "Uzupełnij kwalifikację", ru: "Заполнить квалификацию", es: "Completar calificación" },
  appointment_confirmation: { en: "Confirm appointment", pl: "Potwierdź wizytę", ru: "Подтвердить визит", es: "Confirmar cita" },
  appointment_booking: { en: "Book appointment", pl: "Zarezerwuj wizytę", ru: "Забронировать визит", es: "Reservar cita" },
  post_visit_follow_up: { en: "Post-visit follow-up", pl: "Kontakt po wizycie", ru: "Контакт после визита", es: "Seguimiento posterior a la cita" },
  waitlist_contact: { en: "Contact waitlist patient", pl: "Kontakt z listą oczekujących", ru: "Связаться с листом ожидания", es: "Contactar al paciente en lista de espera" },
  patient_care_handoff: { en: "Hand over to patient care", pl: "Przekaż opiekę", ru: "Передать в заботу о пациенте", es: "Transferir a atención al paciente" },
  treatment_plan_review: { en: "Review treatment plan", pl: "Sprawdź plan leczenia", ru: "Проверить план лечения", es: "Revisar plan de tratamiento" },
  send_treatment_plan: { en: "Send treatment plan", pl: "Wyślij plan leczenia", ru: "Отправить план лечения", es: "Enviar plan de tratamiento" },
  custom: { en: "Custom task", pl: "Zadanie indywidualne", ru: "Индивидуальная задача", es: "Tarea personalizada" },
}

/** Canonical Polish business labels used for persisted prototype task titles. */
export const TASK_TYPE_LABELS = Object.fromEntries(
  Object.entries(LABELS).map(([type, labels]) => [type, labels.pl]),
) as Record<TaskType, string>

/** UI label for a task type in the current UI language. Task titles stored on records are data and stay untouched. */
export function taskTypeLabel(type: TaskType, language: Language) {
  const labels = LABELS[type]
  return labels[language] ?? translate(language, labels.pl ?? type, labels.ru ?? type, labels.en)
}

/** Workflow titles are seeded data, so present their canonical localized type. Manual titles remain user content. */
export function taskDisplayTitle(task: Pick<Task, "title" | "type" | "source" | "workflowRuleId">, language: Language) {
  const localizedDemoTitle = localizeDemoText(task.title, language)
  if (localizedDemoTitle !== task.title) return localizedDemoTitle
  if (language === "en" && inlineEnglish(task.title)) return inlineEnglish(task.title)!
  return (task.source === "workflow" || task.workflowRuleId) && task.type
    ? taskTypeLabel(task.type, language)
    : task.title
}
