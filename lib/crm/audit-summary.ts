import type { Language } from "./language-context"

type Localized = { en: string; ru: string; es: string }

const EXACT: Record<string, Localized> = {
  "Eskalacja P0 utworzona ręcznie": { en: "P0 escalation created manually", ru: "Эскалация P0 создана вручную", es: "Escalamiento P0 creado manualmente" },
  "Lead przekształcony w Deal": { en: "Lead converted to Deal", ru: "Лид преобразован в сделку", es: "Lead convertido en Deal" },
  "Połączono kontakt e-mail z pacjentem po dopasowaniu numeru telefonu": { en: "Email contact linked to the patient after a phone number match", ru: "Email-контакт привязан к пациенту по совпадению номера телефона", es: "Contacto de correo electrónico vinculado al paciente tras coincidir el número de teléfono" },
  "Przypisano po rozpoczęciu obsługi": { en: "Assigned after handling started", ru: "Назначено после начала обработки", es: "Asignado tras iniciar la atención" },
  "Sprawa z listy oczekujących przeniesiona do aktywnego callbacku": { en: "Waitlist case moved to an active callback", ru: "Кейс из листа ожидания переведён в активный обратный звонок", es: "Caso de la lista de espera movido a una devolución de llamada activa" },
  "Status zmieniony": { en: "Status changed", ru: "Статус изменён", es: "Estado modificado" },
  "Synchronizacja z Medical CRM nie powiodła się — dane lokalne pozostają dostępne": { en: "Sync with Medical CRM failed — local data remains available", ru: "Синхронизация с Medical CRM не удалась — локальные данные остаются доступными", es: "La sincronización con Medical CRM falló: los datos locales siguen disponibles" },
  "Team Leader zmienił przypisanie": { en: "Team Leader changed the assignment", ru: "Тимлид изменил назначение", es: "El Team Leader cambió la asignación" },
  "Wykryto konflikt danych z Medical CRM (nazwisko)": { en: "Data conflict with Medical CRM detected (last name)", ru: "Обнаружен конфликт данных с Medical CRM (фамилия)", es: "Se detectó un conflicto de datos con Medical CRM (apellido)" },
  "Zaktualizowano kolejność kolumn kanban": { en: "Kanban column order updated", ru: "Обновлён порядок колонок канбана", es: "Se actualizó el orden de las columnas del kanban" },
  "Aktywowano AI po upływie skonfigurowanego czasu": { en: "AI activated after the configured delay", ru: "AI активирован по истечении заданного времени", es: "IA activada tras el tiempo configurado" },
  "Anulowano aktywację AI: odpowiedział operator": { en: "AI activation cancelled: an operator replied", ru: "Активация AI отменена: ответил оператор", es: "Activación de IA cancelada: respondió un operador" },
  "Anulowano oczekującą aktywację AI po wyłączeniu AI": { en: "Pending AI activation cancelled after AI was turned off", ru: "Ожидающая активация AI отменена после отключения AI", es: "Activación de IA pendiente cancelada tras desactivar la IA" },
  "Anulowano oczekującą aktywację AI": { en: "Pending AI activation cancelled", ru: "Ожидающая активация AI отменена", es: "Activación de IA pendiente cancelada" },
  "Dodano komentarz pracownika": { en: "Staff comment added", ru: "Добавлен комментарий сотрудника", es: "Se agregó un comentario del personal" },
  "Konflikt lokalnego kontaktu przekazano do Patient Matching": { en: "Local contact conflict handed to Patient Matching", ru: "Конфликт локального контакта передан в Patient Matching", es: "El conflicto del contacto local se derivó a Patient Matching" },
  "Pacjent zsynchronizowany z Medical CRM (dopasowanie po numerze/e-mailu)": { en: "Patient synced with Medical CRM (matched by phone/email)", ru: "Пациент синхронизирован с Medical CRM (совпадение по номеру/email)", es: "Paciente sincronizado con Medical CRM (coincidencia por teléfono/correo electrónico)" },
  "Sprawa przypisana do kliniki": { en: "Case assigned to a clinic", ru: "Кейс назначен клинике", es: "Caso asignado a una clínica" },
  "Utworzono kolejny Engagement Case z Patient 360": { en: "Another Engagement Case created from Patient 360", ru: "Создан ещё один Engagement Case из Patient 360", es: "Se creó otro Engagement Case desde Patient 360" },
  "Zapisano lokalne dane kontaktu do ponownego wyszukania. Patient w Medical CRM bez zmian.": { en: "Local contact data saved for re-search. Patient in Medical CRM unchanged.", ru: "Локальные данные контакта сохранены для повторного поиска. Пациент в Medical CRM не изменён.", es: "Datos locales del contacto guardados para una nueva búsqueda. El paciente en Medical CRM no cambió." },
  "Zapisano lokalne tagi i notatkę operacyjną": { en: "Local tags and operational note saved", ru: "Сохранены локальные теги и операционная заметка", es: "Se guardaron las etiquetas locales y la nota operativa" },
  "Zastąpiono timer AI po nowszej wiadomości pacjenta": { en: "AI timer replaced after a newer patient message", ru: "Таймер AI заменён после нового сообщения пациента", es: "Temporizador de IA reemplazado tras un mensaje más reciente del paciente" },
  "Override: pominięto automatyczną task; brak następnego działania pozostaje w kolejce kontrolnej": { en: "Override: automatic task skipped; missing next action stays in the review queue", ru: "Override: автоматическая задача пропущена; отсутствие следующего действия остаётся в контрольной очереди", es: "Override: tarea automática omitida; la falta de una próxima acción permanece en la cola de control" },
}

const NO_CONFIG: Localized = { en: "no configuration", ru: "нет конфигурации", es: "sin configuración" }

type Pattern = { re: RegExp; en: (m: string[]) => string; ru: (m: string[]) => string; es: (m: string[]) => string }

const PATTERNS: Pattern[] = [
  { re: /^Przywrócono domyślne uprawnienia roli (.+)$/, en: (m) => `Default permissions restored for role ${m[1]}`, ru: (m) => `Восстановлены права по умолчанию для роли ${m[1]}`, es: (m) => `Se restablecieron los permisos predeterminados del rol ${m[1]}` },
  { re: /^Zmieniono uprawnienie (.+) dla roli (.+)$/, en: (m) => `Permission ${m[1]} changed for role ${m[2]}`, ru: (m) => `Изменено право ${m[1]} для роли ${m[2]}`, es: (m) => `Se cambió el permiso ${m[1]} del rol ${m[2]}` },
  { re: /^Routing połączenia · (.+)$/, en: (m) => `Call routing · ${m[1]}`, ru: (m) => `Маршрутизация звонка · ${m[1]}`, es: (m) => `Enrutamiento de llamada · ${m[1]}` },
  { re: /^AI (włączone|wyłączone) dla rozmowy$/, en: (m) => `AI ${m[1] === "włączone" ? "enabled" : "disabled"} for the conversation`, ru: (m) => `AI ${m[1] === "włączone" ? "включён" : "выключен"} для диалога`, es: (m) => `IA ${m[1] === "włączone" ? "activada" : "desactivada"} para la conversación` },
  { re: /^Błąd SMS (\S+?): (.+)$/, en: (m) => `SMS error ${m[1]}: ${m[2]}`, ru: (m) => `Ошибка SMS ${m[1]}: ${m[2]}`, es: (m) => `Error de SMS ${m[1]}: ${m[2]}` },
  { re: /^Obsługa rozmowy: (.+) → (.+)$/, en: (m) => `Conversation handling: ${m[1]} → ${m[2]}`, ru: (m) => `Обработка диалога: ${m[1]} → ${m[2]}`, es: (m) => `Gestión de la conversación: ${m[1]} → ${m[2]}` },
  { re: /^Ponowiono SMS (\S+) jako (\S+)$/, en: (m) => `SMS ${m[1]} retried as ${m[2]}`, ru: (m) => `SMS ${m[1]} отправлен повторно как ${m[2]}`, es: (m) => `SMS ${m[1]} reenviado como ${m[2]}` },
  { re: /^SMS dodany do kolejki · (.+)$/, en: (m) => `SMS queued · ${m[1] === "brak konfiguracji" ? NO_CONFIG.en : m[1]}`, ru: (m) => `SMS добавлен в очередь · ${m[1] === "brak konfiguracji" ? NO_CONFIG.ru : m[1]}`, es: (m) => `SMS en cola · ${m[1] === "brak konfiguracji" ? NO_CONFIG.es : m[1]}` },
  { re: /^Sprawa oznaczona jako duplikat sprawy (.+)$/, en: (m) => `Case marked as a duplicate of case ${m[1]}`, ru: (m) => `Кейс помечен как дубликат кейса ${m[1]}`, es: (m) => `Caso marcado como duplicado del caso ${m[1]}` },
  { re: /^Test emulatora SMS · (.+)$/, en: (m) => `SMS emulator test · ${m[1]}`, ru: (m) => `Тест SMS-эмулятора · ${m[1]}`, es: (m) => `Prueba del emulador de SMS · ${m[1]}` },
  { re: /^Wizyta zaplanowana · (.+)$/, en: (m) => `Appointment scheduled · ${m[1]}`, ru: (m) => `Визит запланирован · ${m[1]}`, es: (m) => `Cita programada · ${m[1]}` },
  { re: /^Wskazano duplikat: sprawa (.+)$/, en: (m) => `Duplicate indicated: case ${m[1]}`, ru: (m) => `Указан дубликат: кейс ${m[1]}`, es: (m) => `Duplicado indicado: caso ${m[1]}` },
  { re: /^Wysłano kampanię SMS „(.*)["”] do (\d+) kontaktów$/, en: (m) => `SMS campaign “${m[1]}” sent to ${m[2]} contacts`, ru: (m) => `SMS-кампания «${m[1]}» отправлена ${m[2]} контактам`, es: (m) => `Campaña de SMS «${m[1]}» enviada a ${m[2]} contactos` },
  { re: /^Zapisano konfigurację SMS · (.+)$/, en: (m) => `SMS configuration saved · ${m[1]}`, ru: (m) => `Конфигурация SMS сохранена · ${m[1]}`, es: (m) => `Configuración de SMS guardada · ${m[1]}` },
  { re: /^Zapisano odpowiedź AI z (\d+) źródłami Bazy Wiedzy$/, en: (m) => `AI response saved with ${m[1]} Knowledge Base sources`, ru: (m) => `Ответ AI сохранён, источников Базы знаний: ${m[1]}`, es: (m) => `Respuesta de IA guardada con ${m[1]} fuentes de la Base de conocimiento` },
  { re: /^Zaplanowano aktywację AI za (.+)$/, en: (m) => `AI activation scheduled in ${m[1]}`, ru: (m) => `Активация AI запланирована через ${m[1]}`, es: (m) => `Activación de IA programada en ${m[1]}` },
  { re: /^Zmieniono aktywnego dostawcę SMS · (.+)$/, en: (m) => `Active SMS provider changed · ${m[1]}`, ru: (m) => `Изменён активный SMS-провайдер · ${m[1]}`, es: (m) => `Proveedor de SMS activo cambiado · ${m[1]}` },
  { re: /^Zmieniono politykę AI (.+): (v\d+ → v\d+)$/, en: (m) => `AI policy ${m[1]} changed: ${m[2]}`, ru: (m) => `Изменена политика AI ${m[1]}: ${m[2]}`, es: (m) => `Política de IA ${m[1]} modificada: ${m[2]}` },
  { re: /^Etap: (.+) → (.+)$/, en: (m) => `Stage: ${m[1]} → ${m[2]}`, ru: (m) => `Этап: ${m[1]} → ${m[2]}`, es: (m) => `Etapa: ${m[1]} → ${m[2]}` },
  { re: /^(Aktywowano|Dezaktywowano i odwołano sesje) konto (.+) \(demo\)$/, en: (m) => (m[1] === "Aktywowano" ? `Account ${m[2]} activated (demo)` : `Account ${m[2]} deactivated and sessions revoked (demo)`), ru: (m) => (m[1] === "Aktywowano" ? `Аккаунт ${m[2]} активирован (демо)` : `Аккаунт ${m[2]} деактивирован, сессии отозваны (демо)`), es: (m) => (m[1] === "Aktywowano" ? `Cuenta ${m[2]} activada (demo)` : `Cuenta ${m[2]} desactivada y sesiones revocadas (demo)`) },
  { re: /^Zaproszono użytkownika (.+) \(demo\)$/, en: (m) => `User ${m[1]} invited (demo)`, ru: (m) => `Приглашён пользователь ${m[1]} (демо)`, es: (m) => `Usuario ${m[1]} invitado (demo)` },
  { re: /^Zarejestrowano odwołanie sesji użytkownika (.+) \(demo\)$/, en: (m) => `Session revocation recorded for user ${m[1]} (demo)`, ru: (m) => `Зафиксирован отзыв сессий пользователя ${m[1]} (демо)`, es: (m) => `Revocación de sesiones registrada para el usuario ${m[1]} (demo)` },
  { re: /^Zarejestrowano prośbę o reset hasła dla (.+) \(demo, bez wysyłki\)$/, en: (m) => `Password reset requested for ${m[1]} (demo, nothing sent)`, ru: (m) => `Запрос сброса пароля для ${m[1]} (демо, без отправки)`, es: (m) => `Solicitud de restablecimiento de contraseña registrada para ${m[1]} (demo, sin envío)` },
  { re: /^Zmieniono role lub zakres klinik użytkownika (.+)$/, en: (m) => `Role or clinic scope changed for user ${m[1]}`, ru: (m) => `Изменены роль или набор клиник пользователя ${m[1]}`, es: (m) => `Se cambió el rol o el alcance de clínicas del usuario ${m[1]}` },
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
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(summary)
    if (match) return pattern[language](match)
  }
  return summary
}
