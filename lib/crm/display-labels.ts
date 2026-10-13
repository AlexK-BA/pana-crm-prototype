import type { ContactChannel, TaskPriority } from "./entities"
import type { ActionKind } from "./entity-selectors"
import type { Language } from "./language-context"

/** Presentation-only labels. Stored values and business rules never depend on these strings. */

const PRIORITY: Record<TaskPriority, Record<Language, string>> = {
  P0: { en: "Manual escalation", pl: "Ręczna eskalacja", ru: "Ручная эскалация", es: "Escalamiento manual" },
  P1: { en: "Urgent callback", pl: "Pilne oddzwonienie", ru: "Срочный перезвон", es: "Devolución de llamada urgente" },
  P2: { en: "Scheduled task", pl: "Zaplanowane zadanie", ru: "Запланированная задача", es: "Tarea programada" },
  P3: { en: "New lead", pl: "Nowy lead", ru: "Новый лид", es: "Nuevo lead" },
  P4: { en: "Follow-up attempt", pl: "Kolejna próba", ru: "Повторная попытка", es: "Nuevo intento" },
}

const ACTION: Record<ActionKind, Record<Language, string>> = {
  unassigned_clinic: { en: "Assign clinic", pl: "Przypisz klinikę", ru: "Назначить клинику", es: "Asignar clínica" },
  reply: { en: "Reply in chat", pl: "Odpowiedz w czacie", ru: "Ответить в чате", es: "Responder en el chat" },
  call: { en: "Call", pl: "Zadzwoń", ru: "Позвонить", es: "Llamar" },
  follow_up: { en: "Follow-up attempt", pl: "Kolejna próba", ru: "Повторная попытка", es: "Nuevo intento" },
  treatment_plan: { en: "Send treatment plan", pl: "Wyślij plan leczenia", ru: "Отправить план лечения", es: "Enviar plan de tratamiento" },
}

const TASK_STATUS: Record<string, Record<Language, string>> = {
  planned: { en: "Planned", pl: "Zaplanowane", ru: "Запланировано", es: "Programada" },
  ready: { en: "Ready", pl: "Gotowe", ru: "Готово к работе", es: "Lista" },
  assigned: { en: "Assigned", pl: "Przypisane", ru: "Назначено", es: "Asignada" },
  in_progress: { en: "In progress", pl: "W toku", ru: "В работе", es: "En curso" },
  overdue: { en: "Overdue", pl: "Po terminie", ru: "Просрочено", es: "Vencidas" },
  completed: { en: "Completed", pl: "Zakończone", ru: "Выполнено", es: "Finalizada" },
  cancelled: { en: "Cancelled", pl: "Anulowane", ru: "Отменено", es: "Cancelada" },
  failed: { en: "Failed", pl: "Nieudane", ru: "Не удалось", es: "Fallida" },
}

const CHANNEL: Record<string, Record<Language, string>> = {
  phone: { en: "Phone", pl: "Telefon", ru: "Телефон", es: "Teléfono" },
  email: { en: "Email", pl: "E-mail", ru: "E-mail", es: "Correo electrónico" },
  website: { en: "Website", pl: "Strona www", ru: "Сайт", es: "Sitio web" },
  whatsapp: { en: "WhatsApp", pl: "WhatsApp", ru: "WhatsApp", es: "WhatsApp" },
  instagram: { en: "Instagram", pl: "Instagram", ru: "Instagram", es: "Instagram" },
  facebook: { en: "Facebook", pl: "Facebook", ru: "Facebook", es: "Facebook" },
  tiktok: { en: "TikTok", pl: "TikTok", ru: "TikTok", es: "TikTok" },
  telegram: { en: "Telegram", pl: "Telegram", ru: "Telegram", es: "Telegram" },
  viber: { en: "Viber", pl: "Viber", ru: "Viber", es: "Viber" },
  sms: { en: "SMS", pl: "SMS", ru: "SMS", es: "SMS" },
  personal_account: { en: "Patient account", pl: "Konto pacjenta", ru: "Личный кабинет", es: "Cuenta del paciente" },
}

/** Composer channels: the "website" channel is a live chat and "phone" is sent as SMS. */
const SEND_CHANNEL: Record<string, Record<Language, string>> = {
  website: { en: "Chat", pl: "Czat", ru: "Чат", es: "Chat" },
  phone: { en: "SMS", pl: "SMS", ru: "SMS", es: "SMS" },
  tiktok: { en: "TikTok", pl: "TikTok", ru: "TikTok", es: "TikTok" },
}

const POTENTIAL_CHANNEL: Record<Language, { badge: string; tooltip: string }> = {
  en: { badge: "Potential", tooltip: "Integration is not connected yet" },
  pl: { badge: "Potencjalny", tooltip: "Integracja nie jest jeszcze podłączona" },
  ru: { badge: "Потенциальный", tooltip: "Интеграция ещё не подключена" },
  es: { badge: "Potencial", tooltip: "La integración aún no está conectada" },
}

const TASK_TYPE: Record<string, Record<Language, string>> = {
  call: { en: "Call", pl: "Telefon", ru: "Звонок", es: "Teléfono" },
  message: { en: "Message", pl: "Wiadomość", ru: "Сообщение", es: "Mensaje" },
  sms: { en: "SMS", pl: "SMS", ru: "SMS", es: "SMS" },
  email: { en: "Email", pl: "E-mail", ru: "E-mail", es: "Correo electrónico" },
  qualification: { en: "Qualification", pl: "Kwalifikacja", ru: "Квалификация", es: "Calificación" },
  appointment_confirmation: { en: "Appointment confirmation", pl: "Potwierdzenie wizyty", ru: "Подтверждение визита", es: "Confirmación de cita" },
  appointment_booking: { en: "Appointment booking", pl: "Rezerwacja wizyty", ru: "Запись на визит", es: "Reserva de cita" },
  post_visit_follow_up: { en: "Post-visit follow-up", pl: "Kontakt po wizycie", ru: "Контакт после визита", es: "Contacto posterior a la cita" },
  waitlist_contact: { en: "Waitlist contact", pl: "Kontakt z listy oczekujących", ru: "Контакт из листа ожидания", es: "Contacto de la lista de espera" },
  patient_care_handoff: { en: "Care handoff", pl: "Przekazanie opieki", ru: "Передача сопровождения", es: "Traspaso de atención" },
  treatment_plan_review: { en: "Treatment plan review", pl: "Przegląd planu leczenia", ru: "Проверка плана лечения", es: "Revisión del plan de tratamiento" },
  send_treatment_plan: { en: "Send treatment plan", pl: "Wysyłka planu leczenia", ru: "Отправка плана лечения", es: "Envío del plan de tratamiento" },
  custom: { en: "Custom task", pl: "Własne zadanie", ru: "Своя задача", es: "Tarea personalizada" },
}

const TASK_OUTCOME: Record<string, Record<Language, string>> = {
  done: { en: "Done", pl: "Wykonane", ru: "Выполнено", es: "Hecho" },
  sent: { en: "Sent", pl: "Wysłane", ru: "Отправлено", es: "Enviado" },
  failed: { en: "Failed", pl: "Nieudane", ru: "Не удалось", es: "Fallida" },
  patient_declined: { en: "Patient declined", pl: "Pacjent odmówił", ru: "Пациент отказался", es: "El paciente rechazó" },
  no_valid_channel: { en: "No working channel", pl: "Brak działającego kanału", ru: "Нет рабочего канала", es: "Sin canal disponible" },
}

export const priorityText = (priority: TaskPriority, language: Language) => PRIORITY[priority][language]
export const taskTypeText = (type: string, language: Language) => TASK_TYPE[type]?.[language] ?? type
export const taskOutcomeText = (outcome: string, language: Language) => TASK_OUTCOME[outcome]?.[language] ?? outcome
export const sendChannelText = (channel: ContactChannel | string, language: Language) =>
  SEND_CHANNEL[channel]?.[language] ?? CHANNEL[channel]?.[language] ?? channel
export const potentialChannelText = (language: Language) => POTENTIAL_CHANNEL[language]
export const actionKindText = (kind: ActionKind, language: Language) => ACTION[kind][language]
export const taskStatusText = (status: string, language: Language) => TASK_STATUS[status]?.[language] ?? status
export const channelText = (channel: ContactChannel | string, language: Language) => CHANNEL[channel]?.[language] ?? channel
