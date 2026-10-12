"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { inlineEnglish } from "./inline-english"

export type Language = "en" | "pl" | "ru"

const STORAGE_KEY = "smart-clinic-crm-language"
const LEGACY_STORAGE_KEY = "pana-crm-language"

const DICTIONARY = {
  next_action: { pl: "Następne działanie", ru: "Следующее действие" },
  skip_reason: { pl: "Pomiń z powodem", ru: "Пропустить с причиной" },
  open_start: { pl: "Otwórz i rozpocznij", ru: "Открыть и начать" },
  full_task_queue: { pl: "Pełna kolejka zadań", ru: "Полная очередь задач" },
  personal_queue_clear: { pl: "Twoja kolejka jest pusta", ru: "Ваша очередь пуста" },
  personal_queue_clear_hint: { pl: "Nie pokazujemy zadań przypisanych innym osobom. Możesz przejrzeć zadania nieprzypisane lub pełną kolejkę.", ru: "Мы не показываем задачи, назначенные другим сотрудникам. Можно открыть неназначенные задачи или полную очередь." },
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
  skip_reason_placeholder: { pl: "Powód pominięcia…", ru: "Причина пропуска…" },
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
  search_placeholder: { pl: "Szukaj spraw, pacjentów…", ru: "Поиск заявок, пациентов…" },
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
  first_note_placeholder: { pl: "Krótki opis zapytania pacjenta…", ru: "Краткое описание запроса пациента…" },

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

/** UI language only. Patient preferred language and content language are separate concepts. */
export const UI_LOCALES: Record<Language, string> = { en: "en-GB", pl: "pl-PL", ru: "ru-RU" }

/**
 * English is the neutral commercial default. Existing PL/RU copy remains the
 * source for the established regional versions while the product is migrated
 * from inline labels to stable translation keys.
 */
const ENGLISH_DICTIONARY: Partial<Record<DictionaryKey, string>> = {
  next_action: "Next action", skip_reason: "Skip with reason", open_start: "Open and start",
  full_task_queue: "Full task queue", personal_queue_clear: "Your queue is clear",
  personal_queue_clear_hint: "Tasks assigned to other team members are hidden. You can review unassigned tasks or the full queue.",
  last_action: "Last action", next_step: "Next step", no_service: "No service",
  tile_p0: "P0 Urgent", tile_p1: "P1 Missed", tile_p2: "P2 Due today", tile_p3: "P3 New leads",
  tile_overdue: "Overdue", tile_unassigned: "Unassigned", clear_filter: "Clear filter",
  tab_mine: "Mine", tab_unassigned: "Unassigned", tab_team: "Team", kanban_view: "Kanban view",
  action_required: "Action required", all: "All", queue_empty: "The queue is empty.",
  no_clinic: "No clinic", unknown_contact: "Unknown contact", full_profile: "Full profile", close: "Close",
  board_lead: "Lead", board_deal: "Deal", board_patient_care: "Patient care", call: "Call",
  message: "Message", book_appointment: "Book appointment",
  matched_note: "Matched to an existing patient in Medical CRM.",
  none_matched_note: "No match found — the contact remains unlinked.",
  not_linked_note: "This contact is not linked to a Medical CRM patient yet.",
  check_in_crm: "Check in Medical CRM", tab_tasks: "Tasks", tab_history: "Contact history",
  tab_comments: "Comments", tab_audit: "Audit log", tab_timeline: "Timeline",
  no_timeline: "No events for this case.", timeline_task_created: "Task created",
  timeline_task_completed: "Task completed", timeline_comment: "Comment", no_tasks: "No tasks for this case.",
  due_prefix: "due", unassigned_owner: "Unassigned", skipped_prefix: "Skipped", skip: "Skip",
  skip_reason_placeholder: "Reason for skipping...", save: "Save", no_messages: "No messages in this case.",
  no_comments: "No comments.", no_audit: "No system changes.", language: "Language", board: "Board",
  all_boards: "All boards", nav_board: "CRM board", nav_inbox: "Inbox", nav_schedule: "Schedule",
  nav_waitlist: "Waitlist", nav_calendar: "Task calendar", nav_records: "All records",
  nav_audit: "Audit log", nav_docs: "Documentation", nav_settings: "Settings",
  page_board_subtitle: "Leads, deals and patients", page_records_subtitle: "Browse and filter all cases",
  page_waitlist_subtitle: "Cases waiting for an appointment proposal",
  page_audit_subtitle: "Data, status and assignment changes across the system",
  page_docs_subtitle: "AS-IS → TO-BE migration status", workspace_suffix: "Workspace",
  search_placeholder: "Search cases and patients...", simulate_call: "Simulate call",
  demo_incoming_call: "Demo: incoming call", notifications: "Notifications", needs_attention: "Needs attention",
  no_new_notifications: "No new notifications.", new_case: "New case", create_case: "Create case", cancel: "Cancel",
  contact_channel: "Contact channel", clinic_optional: "Clinic (optional)", no_assignment: "No assignment",
  first_name: "First name", last_name: "Last name", phone_number: "Phone number",
  patient_id_optional: "Medical CRM patient ID (optional)",
  patient_id_hint: "An existing patient ID, phone number or email links the case to the patient profile immediately.",
  first_note: "First note / message", first_note_placeholder: "Briefly describe the patient's request...",
  role_operator_label: "Operator", role_operator_home: "My queue", role_operator_title: "Operator · Contact centre",
  role_operator_desc: "Work with leads and deals: task queue, calls and messages.",
  role_operator_greet: "What needs your attention now",
  role_patient_care_label: "Patient care", role_patient_care_home: "Patient care",
  role_patient_care_title: "Patient care specialist",
  role_patient_care_desc: "Appointments, post-visit follow-up, recalls and patients in treatment.",
  role_patient_care_greet: "Patients who need follow-up and support",
  role_team_leader_label: "Team leader", role_team_leader_home: "Team", role_team_leader_title: "Team leader",
  role_team_leader_desc: "P0–P4 queues, team workload, assignments and overdue tasks.",
  role_team_leader_greet: "Queues, team workload and overdue tasks",
  role_clinic_manager_label: "Clinic manager", role_clinic_manager_home: "Clinic",
  role_clinic_manager_title: "Clinic manager",
  role_clinic_manager_desc: "Doctors, procedures, schedule and patient-care outcomes for the clinic.",
  role_clinic_manager_greet: "Your clinic's performance and workload",
  role_marketing_label: "Marketing", role_marketing_home: "Marketing", role_marketing_title: "Marketing",
  role_marketing_desc: "Attribution, funnel and campaign results — without access to medical data.",
  role_marketing_greet: "Source attribution and campaign conversion",
  role_admin_label: "Administrator", role_admin_home: "Administration", role_admin_title: "System administrator",
  role_admin_desc: "Clinics, users, integrations, queue rules and audit log.",
  role_admin_greet: "System status, users and integrations", contact_center_role: "Contact centre operator",
  board_leads_label: "Leads · Contact centre", board_deals_label: "Deals · Contact centre",
  board_patients_label: "Patients · Patient care", col_new: "New enquiry", col_qualification: "Qualification",
  col_waiting: "Waitlist", col_call_later: "Call back later", col_failed: "No contact / no-show",
  col_closed: "Closed · not converted", col_converted: "Converted to deal", col_scheduled: "Appointment scheduled",
  col_post_visit: "Post-visit follow-up", col_recall: "Recall recommended", col_care: "Handed over to patient care",
  col_no_show: "No-show", col_completed: "Deal completed", col_appt_scheduled: "Appointment scheduled",
  col_new_patient: "New patient", col_returning: "Returning patient", col_in_treatment: "In treatment",
  col_control: "Follow-up imaging", col_complete: "Treatment completed",
  settings_title: "Settings", settings_subtitle: "Workspace, roles, team, clinic catalogue and stages",
  settings_role_title: "Working role",
  settings_role_desc: "Switch roles to preview the home dashboard for each position. The choice is stored locally and applies across all tabs.",
  settings_team_title: "Team", settings_active: "Active", settings_clinics_title: "Clinics and procedures",
  settings_doctors_count: "doctors", settings_procedures_count: "procedures", settings_boards_title: "Boards and stages",
  settings_bot_title: "Bot settings",
  settings_bot_desc: "Configure automatic replies, working hours and escalation for the chat assistant.",
  settings_bot_enabled: "Bot enabled", settings_bot_name: "Bot name", settings_bot_hours: "Working hours",
  settings_bot_channels: "Channels", settings_bot_autoreply: "Out-of-hours auto-reply",
  settings_bot_escalation: "Escalation threshold",
  settings_bot_escalation_hint: "Number of unsuccessful bot attempts before handover to a human operator.",
  settings_kb_title: "Knowledge base",
  settings_kb_desc: "Articles and answers used by the bot to handle patient enquiries automatically.",
  settings_kb_add: "Add article", settings_kb_question: "Question / topic", settings_kb_answer: "Answer",
  settings_kb_category: "Category", settings_kb_used: "uses", settings_kb_edit: "Edit",
  settings_kb_delete: "Delete", settings_kb_empty: "The knowledge base has no articles yet.",
}

const humaniseKey = (key: DictionaryKey) => key.replace(/^(nav|page|settings|tab|tile|role)_/, "").replaceAll("_", " ").replace(/^./, char => char.toUpperCase())

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: DictionaryKey) => string
  /** Picks a system label for the current UI language. Never use it for user data. */
  tr: (pl: string, ru: string, en?: string) => string
  locale: string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (stored === "en" || stored === "pl" || stored === "ru") setLanguageState(stored)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem(STORAGE_KEY, language)
  }, [language, mounted])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (lang: Language) => setLanguageState(lang)
  const t = (key: DictionaryKey) => language === "en"
    ? ENGLISH_DICTIONARY[key] ?? humaniseKey(key)
    : DICTIONARY[key][language]

  const tr = (pl: string, ru: string, en?: string) => language === "en" ? (en ?? inlineEnglish(pl) ?? pl) : language === "ru" ? ru : pl

  return <LanguageContext.Provider value={{ language, setLanguage, t, tr, locale: UI_LOCALES[language] }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}
