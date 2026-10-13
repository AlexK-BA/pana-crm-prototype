import type { Language } from "./language-context"

type Localized = { en: string; ru: string }

const EXACT: Record<string, Localized> = {
  "Eskalacja P0 utworzona ręcznie": { en: "P0 escalation created manually", ru: "Эскалация P0 создана вручную" },
  "Lead przekształcony w Deal": { en: "Lead converted to Deal", ru: "Лид преобразован в сделку" },
  "Połączono kontakt e-mail z pacjentem po dopasowaniu numeru telefonu": { en: "Email contact linked to the patient after a phone number match", ru: "Email-контакт привязан к пациенту по совпадению номера телефона" },
  "Przypisano po rozpoczęciu obsługi": { en: "Assigned after handling started", ru: "Назначено после начала обработки" },
  "Sprawa z listy oczekujących przeniesiona do aktywnego callbacku": { en: "Waitlist case moved to an active callback", ru: "Кейс из листа ожидания переведён в активный обратный звонок" },
  "Status zmieniony": { en: "Status changed", ru: "Статус изменён" },
  "Synchronizacja z Medical CRM nie powiodła się — dane lokalne pozostają dostępne": { en: "Sync with Medical CRM failed — local data remains available", ru: "Синхронизация с Medical CRM не удалась — локальные данные остаются доступными" },
  "Team Leader zmienił przypisanie": { en: "Team Leader changed the assignment", ru: "Тимлид изменил назначение" },
  "Wykryto konflikt danych z Medical CRM (nazwisko)": { en: "Data conflict with Medical CRM detected (last name)", ru: "Обнаружен конфликт данных с Medical CRM (фамилия)" },
  "Zaktualizowano kolejność kolumn kanban": { en: "Kanban column order updated", ru: "Обновлён порядок колонок канбана" },
  "Aktywowano AI po upływie skonfigurowanego czasu": { en: "AI activated after the configured delay", ru: "AI активирован по истечении заданного времени" },
  "Anulowano aktywację AI: odpowiedział operator": { en: "AI activation cancelled: an operator replied", ru: "Активация AI отменена: ответил оператор" },
  "Anulowano oczekującą aktywację AI po wyłączeniu AI": { en: "Pending AI activation cancelled after AI was turned off", ru: "Ожидающая активация AI отменена после отключения AI" },
  "Anulowano oczekującą aktywację AI": { en: "Pending AI activation cancelled", ru: "Ожидающая активация AI отменена" },
  "Dodano komentarz pracownika": { en: "Staff comment added", ru: "Добавлен комментарий сотрудника" },
  "Konflikt lokalnego kontaktu przekazano do Patient Matching": { en: "Local contact conflict handed to Patient Matching", ru: "Конфликт локального контакта передан в Patient Matching" },
  "Pacjent zsynchronizowany z Medical CRM (dopasowanie po numerze/e-mailu)": { en: "Patient synced with Medical CRM (matched by phone/email)", ru: "Пациент синхронизирован с Medical CRM (совпадение по номеру/email)" },
  "Sprawa przypisana do kliniki": { en: "Case assigned to a clinic", ru: "Кейс назначен клинике" },
  "Utworzono kolejny Engagement Case z Patient 360": { en: "Another Engagement Case created from Patient 360", ru: "Создан ещё один Engagement Case из Patient 360" },
  "Zapisano lokalne dane kontaktu do ponownego wyszukania. Patient w Medical CRM bez zmian.": { en: "Local contact data saved for re-search. Patient in Medical CRM unchanged.", ru: "Локальные данные контакта сохранены для повторного поиска. Пациент в Medical CRM не изменён." },
  "Zapisano lokalne tagi i notatkę operacyjną": { en: "Local tags and operational note saved", ru: "Сохранены локальные теги и операционная заметка" },
  "Zastąpiono timer AI po nowszej wiadomości pacjenta": { en: "AI timer replaced after a newer patient message", ru: "Таймер AI заменён после нового сообщения пациента" },
  "Override: pominięto automatyczną task; brak następnego działania pozostaje w kolejce kontrolnej": { en: "Override: automatic task skipped; missing next action stays in the review queue", ru: "Override: автоматическая задача пропущена; отсутствие следующего действия остаётся в контрольной очереди" },
}

const NO_CONFIG: Localized = { en: "no configuration", ru: "нет конфигурации" }

type Pattern = { re: RegExp; en: (m: string[]) => string; ru: (m: string[]) => string }

const PATTERNS: Pattern[] = [
  { re: /^Przywrócono domyślne uprawnienia roli (.+)$/, en: (m) => `Default permissions restored for role ${m[1]}`, ru: (m) => `Восстановлены права по умолчанию для роли ${m[1]}` },
  { re: /^Zmieniono uprawnienie (.+) dla roli (.+)$/, en: (m) => `Permission ${m[1]} changed for role ${m[2]}`, ru: (m) => `Изменено право ${m[1]} для роли ${m[2]}` },
  { re: /^Routing połączenia · (.+)$/, en: (m) => `Call routing · ${m[1]}`, ru: (m) => `Маршрутизация звонка · ${m[1]}` },
  { re: /^AI (włączone|wyłączone) dla rozmowy$/, en: (m) => `AI ${m[1] === "włączone" ? "enabled" : "disabled"} for the conversation`, ru: (m) => `AI ${m[1] === "włączone" ? "включён" : "выключен"} для диалога` },
  { re: /^Błąd SMS (\S+?): (.+)$/, en: (m) => `SMS error ${m[1]}: ${m[2]}`, ru: (m) => `Ошибка SMS ${m[1]}: ${m[2]}` },
  { re: /^Obsługa rozmowy: (.+) → (.+)$/, en: (m) => `Conversation handling: ${m[1]} → ${m[2]}`, ru: (m) => `Обработка диалога: ${m[1]} → ${m[2]}` },
  { re: /^Ponowiono SMS (\S+) jako (\S+)$/, en: (m) => `SMS ${m[1]} retried as ${m[2]}`, ru: (m) => `SMS ${m[1]} отправлен повторно как ${m[2]}` },
  { re: /^SMS dodany do kolejki · (.+)$/, en: (m) => `SMS queued · ${m[1] === "brak konfiguracji" ? NO_CONFIG.en : m[1]}`, ru: (m) => `SMS добавлен в очередь · ${m[1] === "brak konfiguracji" ? NO_CONFIG.ru : m[1]}` },
  { re: /^Sprawa oznaczona jako duplikat sprawy (.+)$/, en: (m) => `Case marked as a duplicate of case ${m[1]}`, ru: (m) => `Кейс помечен как дубликат кейса ${m[1]}` },
  { re: /^Test emulatora SMS · (.+)$/, en: (m) => `SMS emulator test · ${m[1]}`, ru: (m) => `Тест SMS-эмулятора · ${m[1]}` },
  { re: /^Wizyta zaplanowana · (.+)$/, en: (m) => `Appointment scheduled · ${m[1]}`, ru: (m) => `Визит запланирован · ${m[1]}` },
  { re: /^Wskazano duplikat: sprawa (.+)$/, en: (m) => `Duplicate indicated: case ${m[1]}`, ru: (m) => `Указан дубликат: кейс ${m[1]}` },
  { re: /^Wysłano kampanię SMS „(.*)["”] do (\d+) kontaktów$/, en: (m) => `SMS campaign “${m[1]}” sent to ${m[2]} contacts`, ru: (m) => `SMS-кампания «${m[1]}» отправлена ${m[2]} контактам` },
  { re: /^Zapisano konfigurację SMS · (.+)$/, en: (m) => `SMS configuration saved · ${m[1]}`, ru: (m) => `Конфигурация SMS сохранена · ${m[1]}` },
  { re: /^Zapisano odpowiedź AI z (\d+) źródłami Bazy Wiedzy$/, en: (m) => `AI response saved with ${m[1]} Knowledge Base sources`, ru: (m) => `Ответ AI сохранён, источников Базы знаний: ${m[1]}` },
  { re: /^Zaplanowano aktywację AI za (.+)$/, en: (m) => `AI activation scheduled in ${m[1]}`, ru: (m) => `Активация AI запланирована через ${m[1]}` },
  { re: /^Zmieniono aktywnego dostawcę SMS · (.+)$/, en: (m) => `Active SMS provider changed · ${m[1]}`, ru: (m) => `Изменён активный SMS-провайдер · ${m[1]}` },
  { re: /^Zmieniono politykę AI (.+): (v\d+ → v\d+)$/, en: (m) => `AI policy ${m[1]} changed: ${m[2]}`, ru: (m) => `Изменена политика AI ${m[1]}: ${m[2]}` },
  { re: /^Etap: (.+) → (.+)$/, en: (m) => `Stage: ${m[1]} → ${m[2]}`, ru: (m) => `Этап: ${m[1]} → ${m[2]}` },
  { re: /^(Aktywowano|Dezaktywowano i odwołano sesje) konto (.+) \(demo\)$/, en: (m) => (m[1] === "Aktywowano" ? `Account ${m[2]} activated (demo)` : `Account ${m[2]} deactivated and sessions revoked (demo)`), ru: (m) => (m[1] === "Aktywowano" ? `Аккаунт ${m[2]} активирован (демо)` : `Аккаунт ${m[2]} деактивирован, сессии отозваны (демо)`) },
  { re: /^Zaproszono użytkownika (.+) \(demo\)$/, en: (m) => `User ${m[1]} invited (demo)`, ru: (m) => `Приглашён пользователь ${m[1]} (демо)` },
  { re: /^Zarejestrowano odwołanie sesji użytkownika (.+) \(demo\)$/, en: (m) => `Session revocation recorded for user ${m[1]} (demo)`, ru: (m) => `Зафиксирован отзыв сессий пользователя ${m[1]} (демо)` },
  { re: /^Zarejestrowano prośbę o reset hasła dla (.+) \(demo, bez wysyłki\)$/, en: (m) => `Password reset requested for ${m[1]} (demo, nothing sent)`, ru: (m) => `Запрос сброса пароля для ${m[1]} (демо, без отправки)` },
  { re: /^Zmieniono role lub zakres klinik użytkownika (.+)$/, en: (m) => `Role or clinic scope changed for user ${m[1]}`, ru: (m) => `Изменены роль или набор клиник пользователя ${m[1]}` },
]

/**
 * Audit summaries are persisted in Polish by the store. Localize them only
 * when rendering so stored data stays untouched. Unknown summaries (for
 * example ones that embed user-entered text) are returned as stored.
 */
export function localizeAuditSummary(summary: string, language: Language): string {
  if (language === "pl") return summary
  const exact = EXACT[summary]
  if (exact) return exact[language]
  for (const { re, en, ru } of PATTERNS) {
    const match = re.exec(summary)
    if (match) return (language === "en" ? en : ru)(match)
  }
  return summary
}
