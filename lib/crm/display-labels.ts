import type { ContactChannel, TaskPriority } from "./entities"
import type { ActionKind } from "./entity-selectors"
import type { Language } from "./language-context"

/** Presentation-only labels. Stored values and business rules never depend on these strings. */

const PRIORITY: Record<TaskPriority, Partial<Record<Language, string>>> = {
  P0: { en: "Manual escalation", pl: "Ręczna eskalacja", ru: "Ручная эскалация" },
  P1: { en: "Urgent callback", pl: "Pilne oddzwonienie", ru: "Срочный перезвон" },
  P2: { en: "Scheduled task", pl: "Zaplanowane zadanie", ru: "Запланированная задача" },
  P3: { en: "New lead", pl: "Nowy lead", ru: "Новый лид" },
  P4: { en: "Next attempt", pl: "Kolejna próba", ru: "Повторная попытка" },
}

const ACTION: Record<ActionKind, Partial<Record<Language, string>>> = {
  unassigned_clinic: { en: "Assign clinic", pl: "Przypisz klinikę", ru: "Назначить клинику" },
  reply: { en: "Reply in chat", pl: "Odpowiedz w czacie", ru: "Ответить в чате" },
  call: { en: "Call", pl: "Zadzwoń", ru: "Позвонить" },
  follow_up: { en: "Next attempt", pl: "Kolejna próba", ru: "Повторная попытка" },
  treatment_plan: { en: "Send treatment plan", pl: "Wyślij plan leczenia", ru: "Отправить план лечения" },
}

const TASK_STATUS: Record<string, Partial<Record<Language, string>>> = {
  planned: { en: "Planned", pl: "Zaplanowane", ru: "Запланировано" },
  ready: { en: "Ready", pl: "Gotowe", ru: "Готово к работе" },
  assigned: { en: "Assigned", pl: "Przypisane", ru: "Назначено" },
  in_progress: { en: "In progress", pl: "W toku", ru: "В работе" },
  overdue: { en: "Overdue", pl: "Po terminie", ru: "Просрочено" },
  completed: { en: "Completed", pl: "Zakończone", ru: "Выполнено" },
  cancelled: { en: "Cancelled", pl: "Anulowane", ru: "Отменено" },
  failed: { en: "Failed", pl: "Nieudane", ru: "Не удалось" },
}

const CHANNEL: Record<string, Partial<Record<Language, string>>> = {
  phone: { en: "Phone", pl: "Telefon", ru: "Телефон" },
  email: { pl: "E-mail", ru: "E-mail" },
  website: { en: "Website", pl: "Strona www", ru: "Сайт" },
  whatsapp: { pl: "WhatsApp", ru: "WhatsApp" },
  instagram: { pl: "Instagram", ru: "Instagram" },
  facebook: { pl: "Facebook", ru: "Facebook" },
  tiktok: { pl: "TikTok", ru: "TikTok" },
  telegram: { pl: "Telegram", ru: "Telegram" },
  viber: { pl: "Viber", ru: "Viber" },
  sms: { pl: "SMS", ru: "SMS" },
  personal_account: { en: "Patient portal", pl: "Konto pacjenta", ru: "Личный кабинет" },
}

/** Composer channels: the "website" channel is a live chat and "phone" is sent as SMS. */
const SEND_CHANNEL: Record<string, Partial<Record<Language, string>>> = {
  website: { en: "Chat", pl: "Czat", ru: "Чат" },
  phone: { pl: "SMS", ru: "SMS" },
  tiktok: { pl: "TikTok", ru: "TikTok" },
}

const POTENTIAL_CHANNEL: Record<Language, { badge: string; tooltip: string }> = {
  en: { badge: "Planned", tooltip: "This integration is not connected yet" },
  pl: { badge: "Potencjalny", tooltip: "Integracja nie jest jeszcze podłączona" },
  ru: { badge: "Потенциальный", tooltip: "Интеграция ещё не подключена" },
}

const TASK_TYPE: Record<string, Partial<Record<Language, string>>> = {
  call: { en: "Call", pl: "Telefon", ru: "Звонок" },
  message: { en: "Message", pl: "Wiadomość", ru: "Сообщение" },
  sms: { pl: "SMS", ru: "SMS" },
  email: { pl: "E-mail", ru: "E-mail" },
  qualification: { en: "Qualification", pl: "Kwalifikacja", ru: "Квалификация" },
  appointment_confirmation: { en: "Appointment confirmation", pl: "Potwierdzenie wizyty", ru: "Подтверждение визита" },
  appointment_booking: { en: "Appointment booking", pl: "Rezerwacja wizyty", ru: "Запись на визит" },
  post_visit_follow_up: { en: "Post-visit follow-up", pl: "Kontakt po wizycie", ru: "Контакт после визита" },
  waitlist_contact: { en: "Waitlist contact", pl: "Kontakt z listy oczekujących", ru: "Контакт из листа ожидания" },
  patient_care_handoff: { en: "Patient-care handover", pl: "Przekazanie opieki", ru: "Передача сопровождения" },
  treatment_plan_review: { en: "Treatment-plan review", pl: "Przegląd planu leczenia", ru: "Проверка плана лечения" },
  send_treatment_plan: { en: "Send treatment plan", pl: "Wysyłka planu leczenia", ru: "Отправка плана лечения" },
  custom: { en: "Custom task", pl: "Własne zadanie", ru: "Своя задача" },
}

const TASK_OUTCOME: Record<string, Partial<Record<Language, string>>> = {
  done: { en: "Done", pl: "Wykonane", ru: "Выполнено" },
  sent: { en: "Sent", pl: "Wysłane", ru: "Отправлено" },
  failed: { en: "Failed", pl: "Nieudane", ru: "Не удалось" },
  patient_declined: { en: "Patient declined", pl: "Pacjent odmówił", ru: "Пациент отказался" },
  no_valid_channel: { en: "No available channel", pl: "Brak działającego kanału", ru: "Нет рабочего канала" },
}

const readable = (value: string) => value.replaceAll("_", " ").replace(/^./, char => char.toUpperCase())

export const priorityText = (priority: TaskPriority, language: Language) => PRIORITY[priority][language] ?? readable(priority)
export const taskTypeText = (type: string, language: Language) => TASK_TYPE[type]?.[language] ?? readable(type)
export const taskOutcomeText = (outcome: string, language: Language) => TASK_OUTCOME[outcome]?.[language] ?? readable(outcome)
export const sendChannelText = (channel: ContactChannel | string, language: Language) =>
  SEND_CHANNEL[channel]?.[language] ?? CHANNEL[channel]?.[language] ?? readable(channel)
export const potentialChannelText = (language: Language) => POTENTIAL_CHANNEL[language]
export const actionKindText = (kind: ActionKind, language: Language) => ACTION[kind][language] ?? readable(kind)
export const taskStatusText = (status: string, language: Language) => TASK_STATUS[status]?.[language] ?? readable(status)
export const channelText = (channel: ContactChannel | string, language: Language) => CHANNEL[channel]?.[language] ?? readable(channel)
