import type { TaskType } from "./entities"
import type { Language } from "./language-context"

const LABELS: Record<TaskType, Record<Language, string>> = {
  call: { en: "Call", pl: "Zadzwoń", ru: "Позвонить", es: "Llamar" },
  message: { en: "Send a message", pl: "Wyślij wiadomość", ru: "Отправить сообщение", es: "Enviar mensaje" },
  sms: { en: "Send SMS", pl: "Wyślij SMS", ru: "Отправить SMS", es: "Enviar SMS" },
  email: { en: "Send an email", pl: "Wyślij e-mail", ru: "Отправить e-mail", es: "Enviar correo electrónico" },
  qualification: { en: "Complete the qualification", pl: "Uzupełnij kwalifikację", ru: "Заполнить квалификацию", es: "Completar la calificación" },
  appointment_confirmation: { en: "Confirm the appointment", pl: "Potwierdź wizytę", ru: "Подтвердить визит", es: "Confirmar la cita" },
  appointment_booking: { en: "Book the appointment", pl: "Zarezerwuj wizytę", ru: "Забронировать визит", es: "Reservar la cita" },
  post_visit_follow_up: { en: "Post-visit follow-up", pl: "Kontakt po wizycie", ru: "Контакт после визита", es: "Contacto posterior a la cita" },
  waitlist_contact: { en: "Contact the waitlist", pl: "Kontakt z listą oczekujących", ru: "Связаться с листом ожидания", es: "Contactar a la lista de espera" },
  patient_care_handoff: { en: "Hand over to patient care", pl: "Przekaż opiekę", ru: "Передать в заботу о пациенте", es: "Traspasar la atención" },
  treatment_plan_review: { en: "Review the treatment plan", pl: "Sprawdź plan leczenia", ru: "Проверить план лечения", es: "Revisar el plan de tratamiento" },
  send_treatment_plan: { en: "Send the treatment plan", pl: "Wyślij plan leczenia", ru: "Отправить план лечения", es: "Enviar plan de tratamiento" },
  custom: { en: "Custom task", pl: "Zadanie indywidualne", ru: "Индивидуальная задача", es: "Tarea personalizada" },
}

/** Canonical Polish business labels used for persisted prototype task titles. */
export const TASK_TYPE_LABELS = Object.fromEntries(
  Object.entries(LABELS).map(([type, labels]) => [type, labels.pl]),
) as Record<TaskType, string>

/** UI label for a task type in the current UI language. Task titles stored on records are data and stay untouched. */
export function taskTypeLabel(type: TaskType, language: Language) {
  return LABELS[type][language]
}
