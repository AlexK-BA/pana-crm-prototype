"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Language = "pl" | "ru"

const STORAGE_KEY = "pana-crm-language"

const DICTIONARY = {
  next_action: { pl: "Następne działanie", ru: "Следующее действие" },
  skip_reason: { pl: "Pomiń z powodem", ru: "Пропустить с причиной" },
  open_start: { pl: "Otwórz i rozpocznij", ru: "Открыть и начать" },
  last_action: { pl: "Ostatnia akcja", ru: "Последнее действие" },
  next_step: { pl: "Kolejny krok", ru: "Следующий шаг" },
  no_service: { pl: "Brak usługi", ru: "Без услуги" },
  tile_p0: { pl: "P0 Pilne", ru: "P0 Срочные" },
  tile_p1: { pl: "P1 Nieodebrane", ru: "P1 Пропущенные" },
  tile_p2: { pl: "P2 Na dziś", ru: "P2 На сегодня" },
  tile_p3: { pl: "P3 Nowe leady", ru: "P3 Новые лиды" },
  tile_overdue: { pl: "Przeterminowane", ru: "Просроченные" },
  tile_unassigned: { pl: "Nieprzypisane", ru: "Без назначения" },
  clear_filter: { pl: "Wyczyść filtr", ru: "Сбросить фильтр" },
  tab_mine: { pl: "Moje", ru: "Мои" },
  tab_unassigned: { pl: "Nieprzypisane", ru: "Не назначено" },
  tab_team: { pl: "Zespół", ru: "Команда" },
  kanban_view: { pl: "Widok kanban", ru: "Вид kanban" },
  action_required: { pl: "Wymagane działanie", ru: "Требуемое действие" },
  all: { pl: "Wszystkie", ru: "Все" },
  queue_empty: { pl: "Kolejka jest pusta.", ru: "Очередь пуста." },
  no_clinic: { pl: "Bez kliniki", ru: "Без клиники" },
  unknown_contact: { pl: "Nierozpoznany kontakt", ru: "Неопознанный контакт" },
  full_profile: { pl: "Pełny profil", ru: "Полный профиль" },
  close: { pl: "Zamknij", ru: "Закрыть" },
  board_lead: { pl: "Lead", ru: "Лид" },
  board_deal: { pl: "Deal", ru: "Сделка" },
  board_patient_care: { pl: "Patient care", ru: "Пациент" },
  call: { pl: "Zadzwoń", ru: "Позвонить" },
  message: { pl: "Wiadomość", ru: "Сообщение" },
  book_appointment: { pl: "Umów wizytę", ru: "Записать на визит" },
  matched_note: { pl: "Dopasowano do istniejącego pacjenta w Medical CRM.", ru: "Сопоставлено с существующим пациентом в Medical CRM." },
  none_matched_note: { pl: "Brak dopasowania — kontakt pozostaje bez powiązania z pacjentem.", ru: "Совпадений нет — контакт остаётся без привязки к пациенту." },
  not_linked_note: { pl: "Ten kontakt nie jest jeszcze powiązany z pacjentem w Medical CRM.", ru: "Этот контакт ещё не привязан к пациенту в Medical CRM." },
  check_in_crm: { pl: "Sprawdź w Medical CRM", ru: "Проверить в Medical CRM" },
  tab_tasks: { pl: "Zadania", ru: "Задачи" },
  tab_history: { pl: "Historia kontaktu", ru: "История контакта" },
  tab_comments: { pl: "Komentarze", ru: "Комментарии" },
  tab_audit: { pl: "Historia zmian", ru: "История изменений" },
  tab_timeline: { pl: "Oś czasu", ru: "Хронология" },
  no_timeline: { pl: "Brak zdarzeń dla tej sprawy.", ru: "Нет событий по этой заявке." },
  timeline_task_created: { pl: "Utworzono zadanie", ru: "Задача создана" },
  timeline_task_completed: { pl: "Zadanie zakończone", ru: "Задача завершена" },
  timeline_comment: { pl: "Komentarz", ru: "Комментарий" },
  no_tasks: { pl: "Brak zadań dla tej sprawy.", ru: "Нет задач для этой заявки." },
  due_prefix: { pl: "termin", ru: "срок" },
  unassigned_owner: { pl: "Nieprzypisane", ru: "Не назначено" },
  skipped_prefix: { pl: "Pominięto", ru: "Пропущено" },
  skip: { pl: "Pomiń", ru: "Пропустить" },
  skip_reason_placeholder: { pl: "Powód pominięcia...", ru: "Причина пропуска..." },
  save: { pl: "Zapisz", ru: "Сохранить" },
  no_messages: { pl: "Brak wiadomości w tej sprawie.", ru: "Нет сообщений по этой заявке." },
  no_comments: { pl: "Brak komentarzy.", ru: "Нет комментариев." },
  no_audit: { pl: "Brak zmian systemowych.", ru: "Нет системных изменений." },
  language: { pl: "Język", ru: "Язык" },
  board: { pl: "Tablica", ru: "Доска" },
  all_boards: { pl: "Wszystkie tablice", ru: "Все доски" },
  nav_board: { pl: "Tablica CRM", ru: "CRM-доска" },
  nav_inbox: { pl: "Skrzynka", ru: "Входящие" },
  nav_schedule: { pl: "Harmonogram", ru: "Расписание" },
  nav_waitlist: { pl: "Lista oczekujących", ru: "Список ожидания" },
  nav_calendar: { pl: "Kalendarz zadań", ru: "Календарь задач" },
  nav_records: { pl: "Wszystkie rekordy", ru: "Все записи" },
  nav_audit: { pl: "Dziennik zmian", ru: "Журнал изменений" },
  nav_docs: { pl: "Dokumentacja", ru: "Документация" },
  nav_settings: { pl: "Ustawienia", ru: "Настройки" },
  page_board_subtitle: { pl: "Potencjalni klienci, transakcje i pacjenci", ru: "Лиды, сделки и пациенты" },
  page_records_subtitle: { pl: "Przeglądaj i filtruj wszystkie sprawy", ru: "Просматривайте и фильтруйте все заявки" },
  page_waitlist_subtitle: { pl: "Sprawy czekające na propozycję terminu", ru: "Заявки, ожидающие предложения времени" },
  page_audit_subtitle: {
    pl: "Zmiany danych, statusów i przypisań w całym systemie",
    ru: "Изменения данных, статусов и назначений по всей системе",
  },
  page_docs_subtitle: { pl: "Stan migracji AS-IS → TO-BE", ru: "Статус миграции AS-IS → TO-BE" },
  workspace_suffix: { pl: "Obszar roboczy", ru: "Рабочая область" },
  search_placeholder: { pl: "Szukaj spraw, pacjentów...", ru: "Поиск заявок, пациентов..." },
  simulate_call: { pl: "Symuluj połączenie", ru: "Симулировать звонок" },
  demo_incoming_call: { pl: "Demo: przychodzące połączenie", ru: "Демо: входящий звонок" },
  notifications: { pl: "Powiadomienia", ru: "Уведомления" },
  needs_attention: { pl: "Wymaga uwagi", ru: "Требует внимания" },
  no_new_notifications: { pl: "Brak nowych powiadomień.", ru: "Нет новых уведомлений." },
  new_case: { pl: "Nowa sprawa", ru: "Новая заявка" },
  create_case: { pl: "Utwórz sprawę", ru: "Создать заявку" },
  cancel: { pl: "Anuluj", ru: "Отмена" },
  contact_channel: { pl: "Kanał kontaktu", ru: "Канал контакта" },
  clinic_optional: { pl: "Klinika (opcjonalnie)", ru: "Клиника (опционально)" },
  no_assignment: { pl: "Bez przypisania", ru: "Без привязки" },
  first_name: { pl: "Imię", ru: "Имя" },
  last_name: { pl: "Nazwisko", ru: "Фамилия" },
  phone_number: { pl: "Numer telefonu", ru: "Номер телефона" },
  patient_id_optional: { pl: "ID pacjenta z Medical CRM (opcjonalnie)", ru: "ID пациента из Medical CRM (опционально)" },
  patient_id_hint: {
    pl: "Podanie ID, telefonu lub e-mailu istniejącego pacjenta natychmiast połączy sprawę z jego profilem.",
    ru: "Указание ID, телефона или e-mail существующего пациента сразу привяжет заявку к его профилю.",
  },
  first_note: { pl: "Pierwsza notatka / wiadomość", ru: "Первая заметка / сообщение" },
  first_note_placeholder: { pl: "Krótki opis zapytania pacjenta...", ru: "Краткое описание запроса пациента..." },

  // Role profiles
  role_operator_label: { pl: "Operator", ru: "Оператор" },
  role_operator_home: { pl: "Moja kolejka", ru: "Моя очередь" },
  role_operator_title: { pl: "Operator · Contact Center", ru: "Оператор · Контакт-центр" },
  role_operator_desc: { pl: "Praca z leadami i dealami: kolejka zadań, połączenia i wiadomości.", ru: "Работа с лидами и сделками: очередь задач, звонки и сообщения." },
  role_operator_greet: { pl: "To wymaga Twojej uwagi teraz", ru: "Вот что требует вашего внимания сейчас" },

  role_patient_care_label: { pl: "Opieka nad pacjentem", ru: "Забота о пациентах" },
  role_patient_care_home: { pl: "Opieka nad pacjentem", ru: "Забота о пациентах" },
  role_patient_care_title: { pl: "Specjalista opieki nad pacjentem", ru: "Специалист по заботе о пациентах" },
  role_patient_care_desc: { pl: "Wizyty, kontrola po wizycie, wizyty kontrolne i pacjenci w trakcie leczenia.", ru: "Визиты, сопровождение после визита, повторные визиты и пациенты на лечении." },
  role_patient_care_greet: { pl: "Pacjenci wymagający kontroli i wsparcia", ru: "Пациенты, которым нужно сопровождение и контроль" },

  role_team_leader_label: { pl: "Team leader", ru: "Тимлид" },
  role_team_leader_home: { pl: "Zespół", ru: "Команда" },
  role_team_leader_title: { pl: "Team leader", ru: "Тимлид" },
  role_team_leader_desc: { pl: "Kolejki P0–P4, obciążenie zespołu, przypisania i przeterminowania.", ru: "Очереди P0–P4, загрузка команды, назначения и просрочки." },
  role_team_leader_greet: { pl: "Przegląd kolejek, zespołu i przeterminowań", ru: "Обзор очередей, команды и просрочек" },

  role_clinic_manager_label: { pl: "Kierownik kliniki", ru: "Руководитель клиники" },
  role_clinic_manager_home: { pl: "Klinika", ru: "Клиника" },
  role_clinic_manager_title: { pl: "Kierownik kliniki", ru: "Руководитель клиники" },
  role_clinic_manager_desc: { pl: "Lekarze, procedury, harmonogram i wyniki opieki nad pacjentem w klinice.", ru: "Врачи, процедуры, расписание и результаты заботы о пациентах в клинике." },
  role_clinic_manager_greet: { pl: "Wyniki i obciążenie Twojej kliniki", ru: "Результаты и загрузка вашей клиники" },

  role_marketing_label: { pl: "Marketing", ru: "Маркетинг" },
  role_marketing_home: { pl: "Marketing", ru: "Маркетинг" },
  role_marketing_title: { pl: "Marketing", ru: "Маркетинг" },
  role_marketing_desc: { pl: "Atrybucja, lejek i wyniki kampanii — bez dostępu do danych medycznych.", ru: "Атрибуция, воронка и результаты кампаний — без доступа к медицинским данным." },
  role_marketing_greet: { pl: "Atrybucja źródeł i konwersja kampanii", ru: "Атрибуция источников и конверсия кампаний" },

  role_admin_label: { pl: "Administrator", ru: "Администратор" },
  role_admin_home: { pl: "Administracja", ru: "Администрирование" },
  role_admin_title: { pl: "Administrator systemu", ru: "Администратор системы" },
  role_admin_desc: { pl: "Kliniki, użytkownicy, integracje, reguły kolejek i dziennik audytu.", ru: "Клиники, пользователи, интеграции, правила очередей и журнал аудита." },
  role_admin_greet: { pl: "Stan systemu, użytkownicy i integracje", ru: "Состояние системы, пользователи и интеграции" },

  contact_center_role: { pl: "Operator Contact Center", ru: "Оператор контакт-центра" },

  // Board labels
  board_leads_label: { pl: "Leady · Contact Center", ru: "Лиды · Контакт-центр" },
  board_deals_label: { pl: "Dealy · Contact Center", ru: "Сделки · Контакт-центр" },
  board_patients_label: { pl: "Pacjenci · Opieka nad pacjentem", ru: "Пациенты · Отдел заботы о пациентах" },

  col_new: { pl: "Nowe zgłoszenie", ru: "Новое обращение" },
  col_qualification: { pl: "Kwalifikacja", ru: "Квалификация" },
  col_waiting: { pl: "Lista oczekujących", ru: "Лист ожидания" },
  col_call_later: { pl: "Oddzwonić później", ru: "Перезвонить позже" },
  col_failed: { pl: "Brak kontaktu / niezjawienie się", ru: "Не дозвонились / неявка" },
  col_closed: { pl: "Zamknięte · nieskonwertowane", ru: "Закрыто · не конвертировано" },
  col_converted: { pl: "Skonwertowane w deal", ru: "Конвертировано в сделку" },
  col_scheduled: { pl: "Wizyta zaplanowana", ru: "Визит запланирован" },
  col_post_visit: { pl: "Kontrola po wizycie", ru: "Проверка после визита" },
  col_recall: { pl: "Zalecana wizyta kontrolna", ru: "Рекомендован повторный визит" },
  col_care: { pl: "Przekazano do opieki nad pacjentem", ru: "Передано в отдел заботы" },
  col_no_show: { pl: "Niezjawienie się", ru: "Неявка" },
  col_completed: { pl: "Deal zakończony", ru: "Сделка завершена" },
  col_appt_scheduled: { pl: "Wizyta zaplanowana", ru: "Визит запланирован" },
  col_new_patient: { pl: "Nowy pacjent", ru: "Новый пациент" },
  col_returning: { pl: "Pacjent powracający", ru: "Повторный пациент" },
  col_in_treatment: { pl: "W trakcie leczenia", ru: "На лечении" },
  col_control: { pl: "Zdjęcie kontrolne", ru: "Контрольный снимок" },
  col_complete: { pl: "Leczenie zakończone", ru: "Лечение завершено" },

  // Settings page
  settings_title: { pl: "Ustawienia", ru: "Настройки" },
  settings_subtitle: { pl: "Workspace, role, zespół, katalog klinik i etapy", ru: "Workspace, роли, команда, каталог клиник и этапы" },
  settings_role_title: { pl: "Rola robocza", ru: "Рабочая роль" },
  settings_role_desc: {
    pl: "Przełącz rolę, aby zobaczyć widok głównego pulpitu odpowiedni dla danego stanowiska. Wybór jest zapisywany lokalnie i obowiązuje we wszystkich zakładkach.",
    ru: "Переключите роль, чтобы увидеть вид главного экрана для данной должности. Выбор сохраняется локально и действует во всех вкладках.",
  },
  settings_team_title: { pl: "Zespół", ru: "Команда" },
  settings_active: { pl: "Aktywny", ru: "Активен" },
  settings_clinics_title: { pl: "Kliniki i procedury", ru: "Клиники и процедуры" },
  settings_doctors_count: { pl: "lekarzy", ru: "врачей" },
  settings_procedures_count: { pl: "procedur", ru: "процедур" },
  settings_boards_title: { pl: "Tablice i etapy", ru: "Доски и этапы" },
  settings_bot_title: { pl: "Ustawienia bota", ru: "Настройки бота" },
  settings_bot_desc: {
    pl: "Konfiguracja automatycznych odpowiedzi, godzin pracy i eskalacji dla asystenta czatu.",
    ru: "Конфигурация автоответов, рабочих часов и эскалации для чат-ассистента.",
  },
  settings_bot_enabled: { pl: "Bot włączony", ru: "Бот включён" },
  settings_bot_name: { pl: "Nazwa bota", ru: "Имя бота" },
  settings_bot_hours: { pl: "Godziny pracy", ru: "Рабочие часы" },
  settings_bot_channels: { pl: "Kanały", ru: "Каналы" },
  settings_bot_autoreply: { pl: "Auto-odpowiedź poza godzinami pracy", ru: "Автоответ вне рабочих часов" },
  settings_bot_escalation: { pl: "Próg eskalacji do operatora", ru: "Порог эскалации на оператора" },
  settings_bot_escalation_hint: {
    pl: "Liczba nieudanych prób bota przed przekazaniem sprawy do żywego operatora.",
    ru: "Количество неудачных попыток бота перед передачей заявки живому оператору.",
  },
  settings_kb_title: { pl: "Baza wiedzy", ru: "База знаний" },
  settings_kb_desc: {
    pl: "Artykuły i odpowiedzi wykorzystywane przez bota do automatycznej obsługi zapytań pacjentów.",
    ru: "Статьи и ответы, используемые ботом для автоматической обработки запросов пациентов.",
  },
  settings_kb_add: { pl: "Dodaj artykuł", ru: "Добавить статью" },
  settings_kb_question: { pl: "Pytanie / temat", ru: "Вопрос / тема" },
  settings_kb_answer: { pl: "Odpowiedź", ru: "Ответ" },
  settings_kb_category: { pl: "Kategoria", ru: "Категория" },
  settings_kb_used: { pl: "użyć", ru: "использований" },
  settings_kb_edit: { pl: "Edytuj", ru: "Редактировать" },
  settings_kb_delete: { pl: "Usuń", ru: "Удалить" },
  settings_kb_empty: { pl: "Brak artykułów w bazie wiedzy.", ru: "В базе знаний нет статей." },
} as const

export type DictionaryKey = keyof typeof DICTIONARY

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: DictionaryKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pl")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "pl" || stored === "ru") setLanguageState(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem(STORAGE_KEY, language)
  }, [language, mounted])

  const setLanguage = (lang: Language) => setLanguageState(lang)
  const t = (key: DictionaryKey) => DICTIONARY[key][language]

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}
