import type { ContactChannel, TaskPriority } from "./entities"
import type { ActionKind } from "./entity-selectors"
import type { Language } from "./language-context"

/** Presentation-only labels. Stored values and business rules never depend on these strings. */

const PRIORITY: Record<TaskPriority, Record<Language, string>> = {
  P0: { pl: "Ręczna eskalacja", ru: "Ручная эскалация" },
  P1: { pl: "Pilne oddzwonienie", ru: "Срочный перезвон" },
  P2: { pl: "Zaplanowane zadanie", ru: "Запланированная задача" },
  P3: { pl: "Nowy lead", ru: "Новый лид" },
  P4: { pl: "Kolejna próba", ru: "Повторная попытка" },
}

const ACTION: Record<ActionKind, Record<Language, string>> = {
  unassigned_clinic: { pl: "Przypisz klinikę", ru: "Назначить клинику" },
  reply: { pl: "Odpowiedz w czacie", ru: "Ответить в чате" },
  call: { pl: "Zadzwoń", ru: "Позвонить" },
  follow_up: { pl: "Kolejna próba", ru: "Повторная попытка" },
  treatment_plan: { pl: "Wyślij plan leczenia", ru: "Отправить план лечения" },
}

const TASK_STATUS: Record<string, Record<Language, string>> = {
  planned: { pl: "Zaplanowane", ru: "Запланировано" },
  ready: { pl: "Gotowe", ru: "Готово к работе" },
  assigned: { pl: "Przypisane", ru: "Назначено" },
  in_progress: { pl: "W toku", ru: "В работе" },
  overdue: { pl: "Po terminie", ru: "Просрочено" },
  completed: { pl: "Zakończone", ru: "Выполнено" },
  cancelled: { pl: "Anulowane", ru: "Отменено" },
  failed: { pl: "Nieudane", ru: "Не удалось" },
}

const CHANNEL: Record<string, Record<Language, string>> = {
  phone: { pl: "Telefon", ru: "Телефон" },
  email: { pl: "E-mail", ru: "E-mail" },
  website: { pl: "Strona www", ru: "Сайт" },
  whatsapp: { pl: "WhatsApp", ru: "WhatsApp" },
  instagram: { pl: "Instagram", ru: "Instagram" },
  facebook: { pl: "Facebook", ru: "Facebook" },
  telegram: { pl: "Telegram", ru: "Telegram" },
  viber: { pl: "Viber", ru: "Viber" },
  sms: { pl: "SMS", ru: "SMS" },
  personal_account: { pl: "Konto pacjenta", ru: "Личный кабинет" },
}

/** Composer channels: the "website" channel is a live chat and "phone" is sent as SMS. */
const SEND_CHANNEL: Record<string, Record<Language, string>> = {
  website: { pl: "Czat", ru: "Чат" },
  phone: { pl: "SMS", ru: "SMS" },
  tiktok: { pl: "TikTok", ru: "TikTok" },
}

const POTENTIAL_CHANNEL: Record<Language, { badge: string; tooltip: string }> = {
  pl: { badge: "Potencjalny", tooltip: "Integracja nie jest jeszcze podłączona" },
  ru: { badge: "Потенциальный", tooltip: "Интеграция ещё не подключена" },
}

export const priorityText = (priority: TaskPriority, language: Language) => PRIORITY[priority][language]
export const sendChannelText = (channel: ContactChannel | string, language: Language) =>
  SEND_CHANNEL[channel]?.[language] ?? CHANNEL[channel]?.[language] ?? channel
export const potentialChannelText = (language: Language) => POTENTIAL_CHANNEL[language]
export const actionKindText = (kind: ActionKind, language: Language) => ACTION[kind][language]
export const taskStatusText = (status: string, language: Language) => TASK_STATUS[status]?.[language] ?? status
export const channelText = (channel: ContactChannel | string, language: Language) => CHANNEL[channel]?.[language] ?? channel
