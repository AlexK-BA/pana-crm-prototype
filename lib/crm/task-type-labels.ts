import type { TaskType } from "./entities"
import type { Language } from "./language-context"

const LABELS: Record<TaskType, Record<Language, string>> = {
  call: { pl: "Zadzwoń", ru: "Позвонить" },
  message: { pl: "Wyślij wiadomość", ru: "Отправить сообщение" },
  sms: { pl: "Wyślij SMS", ru: "Отправить SMS" },
  email: { pl: "Wyślij e-mail", ru: "Отправить e-mail" },
  qualification: { pl: "Uzupełnij kwalifikację", ru: "Заполнить квалификацию" },
  appointment_confirmation: { pl: "Potwierdź wizytę", ru: "Подтвердить визит" },
  appointment_booking: { pl: "Zarezerwuj wizytę", ru: "Забронировать визит" },
  post_visit_follow_up: { pl: "Kontakt po wizycie", ru: "Контакт после визита" },
  waitlist_contact: { pl: "Kontakt z listą oczekujących", ru: "Связаться с листом ожидания" },
  patient_care_handoff: { pl: "Przekaż opiekę", ru: "Передать в заботу о пациенте" },
  treatment_plan_review: { pl: "Sprawdź plan leczenia", ru: "Проверить план лечения" },
  send_treatment_plan: { pl: "Wyślij plan leczenia", ru: "Отправить план лечения" },
  custom: { pl: "Zadanie indywidualne", ru: "Индивидуальная задача" },
}

/** Canonical Polish business labels used for persisted prototype task titles. */
export const TASK_TYPE_LABELS = Object.fromEntries(
  Object.entries(LABELS).map(([type, labels]) => [type, labels.pl]),
) as Record<TaskType, string>

/** UI label for a task type in the current UI language. Task titles stored on records are data and stay untouched. */
export function taskTypeLabel(type: TaskType, language: Language) {
  return LABELS[type][language]
}
