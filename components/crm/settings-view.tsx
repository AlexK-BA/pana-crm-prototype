"use client"

import { useState } from "react"
import Link from "next/link"
import { BOARD_LABEL_KEYS, BOARD_COLUMNS, COLOR_CLASSES } from "@/lib/crm/boards"
import { CLINICS, PROCEDURES, DOCTORS, CLINIC_TONE } from "@/lib/crm/catalog"
import { BRAND_CONFIG } from "@/lib/crm/brand-config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2, Plus, Bot, Database, FileText, Globe2, Play, RefreshCw, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/crm/role-context"
import { ROLE_PROFILES, ROLE_ORDER, type RoleId } from "@/lib/crm/roles"
import { useLanguage } from "@/lib/crm/language-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { WORKFLOW_STAGE_RULES } from "@/lib/crm/workflow-rules"
import { AiComplianceCenter } from "@/components/crm/ai-compliance-center"
import { SmsProviderSettings } from "@/components/crm/sms-provider-settings"

interface KbArticle {
  id: string
  question: string
  answer: string
  category: string
  uses: number
}

const INITIAL_KB: KbArticle[] = [
  {
    id: "kb-1",
    question: "Jakie są godziny otwarcia kliniki?",
    answer: "Nasze kliniki są otwarte od poniedziałku do piątku 8:00–20:00, w soboty 9:00–15:00.",
    category: "Ogólne",
    uses: 142,
  },
  {
    id: "kb-2",
    question: "Jak umówić wizytę kontrolną?",
    answer: "Wizytę kontrolną można umówić przez chat, telefon lub formularz na stronie — bot automatycznie proponuje najbliższy wolny termin u tego samego lekarza.",
    category: "Wizyty",
    uses: 87,
  },
  {
    id: "kb-3",
    question: "Czy przyjmujecie pacjentów z NFZ?",
    answer: "Klinika działa w modelu prywatnym — nie realizujemy świadczeń w ramach NFZ.",
    category: "Płatności",
    uses: 54,
  },
]

let kbSeq = INITIAL_KB.length

const WORKFLOW_BOARD: Record<string, readonly [string, string]> = {
  leads: ["Leady", "Лиды"], deals: ["Wizyty", "Визиты"], patients: ["Pacjenci", "Пациенты"],
}
const WORKFLOW_POLICY: Record<string, readonly [string, string]> = {
  manual: ["ręcznie", "вручную"], appointment: ["wg terminu wizyty", "по времени визита"], clinical: ["wg wskazań klinicznych", "по клиническим показаниям"],
}
const WORKFLOW_LABEL: Record<string, readonly [string, string]> = {
  new: ["Nowy", "Новый"], qualification: ["Kwalifikacja", "Квалификация"], waiting: ["Lista oczekujących", "Список ожидания"], call_later: ["Oddzwonić później", "Перезвонить позже"], failed: ["Nieudany", "Неудачный"], closed: ["Zamknięty", "Закрытый"], converted: ["Skonwertowany", "Конвертированный"], complete: ["Zakończone", "Завершено"],
  scheduled: ["Umówiona", "Запланирован"], post_visit: ["Po wizycie", "После визита"], recall: ["Przypomnienie", "Напоминание"], care: ["Opieka", "Сопровождение"], no_show: ["Nieobecność", "Неявка"], completed: ["Zakończona", "Завершён"],
  appt_scheduled: ["Wizyta umówiona", "Визит запланирован"], new_patient: ["Nowy pacjent", "Новый пациент"], returning: ["Powracający", "Повторный пациент"], in_treatment: ["W leczeniu", "На лечении"], control: ["Kontrola", "Контроль"],
  call: ["telefon", "звонок"], message: ["wiadomość", "сообщение"], sms: ["SMS", "SMS"], email: ["e-mail", "e-mail"], custom: ["własne", "пользовательское"],
  waitlist_contact: ["kontakt z listy oczekujących", "контакт со списком ожидания"], appointment_booking: ["umówienie wizyty", "запись на визит"], appointment_confirmation: ["potwierdzenie wizyty", "подтверждение визита"],
  post_visit_follow_up: ["kontakt po wizycie", "контакт после визита"], send_treatment_plan: ["wysłanie planu leczenia", "отправка плана лечения"], patient_care_handoff: ["przekazanie opieki", "передача в сопровождение"],
  treatment_plan_review: ["przegląd planu leczenia", "проверка плана лечения"],
}
const WORKFLOW_TASK_TITLE_RU: Record<string, string> = {
  "leads.new.first-contact": "Первый контакт с новым лидом",
  "leads.qualification.complete": "Завершить квалификацию и определить следующий шаг",
  "leads.waiting.offer-slot": "Предложить время из списка ожидания",
  "deals.scheduled.confirm": "Подтвердить запланированный визит",
  "deals.post-visit.follow-up": "Связаться после визита",
  "deals.recall.schedule": "Запланировать рекомендованный контрольный визит",
  "deals.care.handoff": "Принять пациента на сопровождение",
  "deals.no-show.call": "Связаться после неявки",
  "patients.scheduled.reminder": "Подтвердить ближайший визит",
  "patients.new.welcome": "Первый контакт отдела сопровождения",
  "patients.returning.next-step": "Определить следующий шаг для повторного пациента",
  "patients.treatment.review": "Проверить следующий этап плана лечения",
  "patients.control.schedule": "Запланировать контрольный снимок",
}

const INITIAL_SOURCES = [
  { id: "src-web", name: BRAND_CONFIG.contactDomain, type: "WWW", scope: "Wszystkie kliniki", items: 84, status: "Gotowe" },
  { id: "src-prices", name: "Cenniki i procedury", type: "Dokumenty", scope: "Według kliniki", items: 12, status: "Gotowe" },
  { id: "src-doctors", name: "Lekarze i specjalizacje", type: "Medical CRM", scope: "Według kliniki", items: 26, status: "Synchronizacja" },
]

export function SettingsView() {
  const { role, setRole } = useRole()
  const { language, t, tr } = useLanguage()
  const { users } = useUserDirectory()
  const [section, setSection] = useState<"operations" | "access" | "communications" | "ai">("operations")

  const [botEnabled, setBotEnabled] = useState(true)
  const [botName, setBotName] = useState<string>(BRAND_CONFIG.botName)
  const [botHours, setBotHours] = useState("Pon–Pt 8:00–20:00, Sob 9:00–15:00")
  const [autoReply, setAutoReply] = useState(true)
  const [escalationThreshold, setEscalationThreshold] = useState("3")
  const [channels, setChannels] = useState({ whatsapp: true, instagram: true, webchat: true, sms: false })

  const [articles, setArticles] = useState<KbArticle[]>(INITIAL_KB)
  const [editing, setEditing] = useState<KbArticle | null>(null)
  const [draft, setDraft] = useState({ question: "", answer: "", category: "" })
  const [showForm, setShowForm] = useState(false)
  const [sources, setSources] = useState(INITIAL_SOURCES)
  const [testQuery, setTestQuery] = useState("")
  const [testAnswer, setTestAnswer] = useState("")
  const localizedPair = (pair: readonly [string, string] | undefined, fallback: string) => pair ? (language === "ru" ? pair[1] : pair[0]) : fallback
  const workflowLabel = (key: string) => localizedPair(WORKFLOW_LABEL[key], key.replaceAll("_", " "))
  const workflowTaskTitle = (id: string, title: string) => language === "ru" ? WORKFLOW_TASK_TITLE_RU[id] ?? title : title
  const sourceText = (value: string) => {
    if (language !== "ru") return value
    return ({
      "Wszystkie kliniki": "Все клиники", "Według kliniki": "По клинике", "Do konfiguracji": "Требует настройки",
      "Cenniki i procedury": "Прайс-листы и процедуры", "Lekarze i specjalizacje": "Врачи и специализации",
      Dokumenty: "Документы", Dokument: "Документ", Gotowe: "Готово", Synchronizacja: "Синхронизация", Szkic: "Черновик",
    } as Record<string, string>)[value] ?? value
  }

  function startAdd() {
    setEditing(null)
    setDraft({ question: "", answer: "", category: "" })
    setShowForm(true)
  }

  function startEdit(article: KbArticle) {
    setEditing(article)
    setDraft({ question: article.question, answer: article.answer, category: article.category })
    setShowForm(true)
  }

  function saveArticle() {
    if (!draft.question.trim() || !draft.answer.trim()) return
    if (editing) {
      setArticles((prev) =>
        prev.map((a) => (a.id === editing.id ? { ...a, ...draft, category: draft.category || "Ogólne" } : a)),
      )
    } else {
      kbSeq += 1
      setArticles((prev) => [
        ...prev,
        { id: `kb-${kbSeq}`, question: draft.question, answer: draft.answer, category: draft.category || "Ogólne", uses: 0 },
      ])
    }
    setShowForm(false)
    setEditing(null)
  }

  function deleteArticle(id: string) {
    setArticles((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1"><h2 className="text-lg font-semibold">{tr("Ustawienia systemu", "Настройки системы")}</h2><p className="text-sm text-muted-foreground">{tr("Wybierz obszar. Pokazujemy tylko ustawienia potrzebne do bieżącego zadania administratora.", "Выберите раздел. Мы показываем только настройки, необходимые для текущей задачи администратора.")}</p></header>
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={tr("Obszary ustawień", "Разделы настроек")}>
        {([
          ["operations", tr("Procesy i kliniki", "Процессы и клиники"), tr("Workflow, SLA, etapy i katalogi", "Воронки, SLA, этапы и каталоги")],
          ["access", tr("Użytkownicy i dostęp", "Пользователи и доступ"), tr("Role, zespół i zarządzanie kontami", "Роли, команда и управление учётными записями")],
          ["communications", tr("Komunikacja", "Коммуникации"), tr("SMS, kanały i zachowanie bota", "SMS, каналы и поведение бота")],
          ["ai", tr("AI i baza wiedzy", "AI и база знаний"), tr("Źródła, testy i zgodność", "Источники, тестирование и соответствие")],
        ] as const).map(([id, label, description]) => <button key={id} type="button" onClick={() => setSection(id)} className={cn("rounded-lg border p-3 text-left transition-colors", section === id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/40")} aria-pressed={section === id}><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></button>)}
      </nav>

      <div className={section === "ai" ? "contents" : "hidden"}><AiComplianceCenter /></div>
      <section className={cn("space-y-2 rounded border p-4", section !== "operations" && "hidden")}><h2 className="font-semibold">{tr("Workflow i SLA — wartości domyślne prototypu", "Процессы и SLA — значения прототипа по умолчанию")}</h2><p className="text-sm text-muted-foreground">{tr("Wartości kalendarne wymagają potwierdzenia. Brak kalendarza pracy i świąt. Zadania kliniczne i wizyty wymagają jawnego terminu; konfiguracja w backendzie w przyszłości.", "Календарные значения требуют подтверждения. Рабочий календарь и праздники пока не настроены. Для клинических задач и визитов срок задаётся явно; конфигурация на бэкенде появится позднее.")}</p><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr><th className="p-2">{tr("Tablica / etap", "Доска / этап")}</th><th>{tr("Zadanie automatyczne", "Автоматическая задача")}</th><th>{tr("SLA / polityka", "SLA / политика")}</th><th>{tr("Sugerowane", "Рекомендуемые")}</th></tr></thead><tbody>{WORKFLOW_STAGE_RULES.map(rule=><tr key={`${rule.board}/${rule.status}`} className="border-t"><td className="p-2">{localizedPair(WORKFLOW_BOARD[rule.board], rule.board)} / {workflowLabel(rule.status)}{rule.terminal ? tr(" · końcowy", " · финальный") : ""}</td><td>{rule.automaticTask ? workflowTaskTitle(rule.automaticTask.id, rule.automaticTask.title) : tr("Jawny wybór / bez automatyzacji", "Явный выбор / без автоматизации")}</td><td>{rule.automaticTask?.duePolicy === "sla" ? `${rule.automaticTask.dueInMinutes} min` : localizedPair(WORKFLOW_POLICY[rule.automaticTask?.duePolicy ?? "manual"], rule.automaticTask?.duePolicy ?? "manual")}</td><td>{rule.suggestedTasks?.map(workflowLabel).join(", ")}</td></tr>)}</tbody></table></div></section>
      <section className={cn("rounded-lg border border-border bg-card p-4", section !== "access" && "hidden")}>
        <h2 className="mb-1 text-sm font-semibold text-foreground">{t("settings_role_title")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("settings_role_desc")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROLE_ORDER.map((id) => {
            const profile = ROLE_PROFILES[id]
            const active = id === role
            return (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                  active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                    profile.user.color,
                  )}
                >
                  {profile.user.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{t(profile.labelKey)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t(profile.homeLabelKey)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <div className={section === "communications" ? "contents" : "hidden"}><SmsProviderSettings /></div>

      <section className={cn("rounded-lg border border-border bg-card p-4", section !== "access" && "hidden")}>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("settings_team_title")}</h2>
        <div className="space-y-2">
          {users.slice(0, 5).map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500 text-xs font-semibold text-white">
                {user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant="secondary">{user.status === "active" ? tr("Aktywny", "Активен") : user.status === "inactive" ? tr("Nieaktywny", "Неактивен") : user.status === "invited" ? tr("Zaproszony", "Приглашён") : tr("Zablokowany", "Заблокирован")}</Badge>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2 w-full" nativeButton={false} render={<Link href="/users">{tr("Zarządzaj użytkownikami i dostępem", "Управление пользователями и доступом")}</Link>} />
        </div>
      </section>

      <section className={cn("rounded-lg border border-border bg-card p-4", section !== "operations" && "hidden")}>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("settings_clinics_title")}</h2>
        <div className="space-y-4">
          {CLINICS.map((clinic) => {
            const tone = CLINIC_TONE[clinic.color]
            const clinicProcedures = PROCEDURES.filter((p) => p.clinicId === clinic.id)
            const clinicDoctors = DOCTORS.filter((d) => d.clinicId === clinic.id)
            return (
              <div key={clinic.id} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                  <p className="text-sm font-medium text-foreground">{clinic.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {clinicDoctors.length} {t("settings_doctors_count")} · {clinicProcedures.length}{" "}
                    {t("settings_procedures_count")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clinicProcedures.map((proc) => (
                    <span
                      key={proc.id}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", tone.chip)}
                    >
                      {proc.name}
                      <span className="text-[10px] opacity-70">{proc.durationMin} min</span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {clinicDoctors.map((doc) => (
                    <span
                      key={doc.id}
                      className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {doc.name}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className={cn("rounded-lg border border-border bg-card p-4", section !== "operations" && "hidden")}>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("settings_boards_title")}</h2>
        <div className="space-y-4">
          {Object.entries(BOARD_LABEL_KEYS).map(([boardId, labelKey]) => (
            <div key={boardId}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t(labelKey)}</p>
              <div className="flex flex-wrap gap-1.5">
                {BOARD_COLUMNS[boardId as keyof typeof BOARD_COLUMNS].map((col) => (
                  <span
                    key={col.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-foreground"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_CLASSES[col.color].dot)} />
                    {t(col.labelKey)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn("rounded-lg border border-border bg-card p-4", section !== "communications" && "hidden")}>
        <div className="mb-1 flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t("settings_bot_title")}</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("settings_bot_desc")}</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="bot-enabled" className="text-sm font-medium text-foreground">
              {t("settings_bot_enabled")}
            </Label>
            <Switch id="bot-enabled" checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bot-name" className="text-xs text-muted-foreground">
                {t("settings_bot_name")}
              </Label>
              <Input id="bot-name" value={botName} onChange={(e) => setBotName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bot-hours" className="text-xs text-muted-foreground">
                {t("settings_bot_hours")}
              </Label>
              <Input id="bot-hours" value={botHours} onChange={(e) => setBotHours(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("settings_bot_channels")}</Label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(channels).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                  <Switch
                    checked={value}
                    onCheckedChange={(v) => setChannels((prev) => ({ ...prev, [key]: v }))}
                  />
                  <span className="capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="auto-reply" className="text-sm font-medium text-foreground">
              {t("settings_bot_autoreply")}
            </Label>
            <Switch id="auto-reply" checked={autoReply} onCheckedChange={setAutoReply} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="escalation" className="text-xs text-muted-foreground">
              {t("settings_bot_escalation")}
            </Label>
            <Input
              id="escalation"
              type="number"
              min={1}
              max={10}
              value={escalationThreshold}
              onChange={(e) => setEscalationThreshold(e.target.value)}
              className="h-8 w-24 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{t("settings_bot_escalation_hint")}</p>
          </div>
        </div>
      </section>

      <section className={cn("rounded-lg border border-border bg-card p-4", section !== "ai" && "hidden")}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t("settings_kb_title")}</h2>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={startAdd}>
            <Plus className="h-3.5 w-3.5" />
            {t("settings_kb_add")}
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("settings_kb_desc")}</p>

        <div className="mb-5 rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{tr("Źródła wiedzy bota", "Источники знаний бота")}</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{tr("Źródła używane do odpowiedzi. W prototypie synchronizacja i indeksowanie są emulowane.", "Источники, используемые для ответов. В прототипе синхронизация и индексация эмулируются.")}</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setSources((prev) => [...prev, { id: `src-${prev.length + 1}`, name: "Nowe źródło", type: "Dokument", scope: "Do konfiguracji", items: 0, status: "Szkic" }])}>
              <Plus className="h-3.5 w-3.5" />{tr("Dodaj źródło", "Добавить источник")}
            </Button>
          </div>
          <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5">
                {source.type === "WWW" ? <Globe2 className="h-4 w-4 text-sky-600" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{sourceText(source.name)}</p>
                  <p className="text-[11px] text-muted-foreground">{sourceText(source.type)} · {sourceText(source.scope)} · {source.items} {tr("elementów", "элементов")}</p>
                </div>
                <Badge variant={source.status === "Gotowe" ? "secondary" : "outline"}>{sourceText(source.status)}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={tr("Ponownie indeksuj", "Переиндексировать")} onClick={() => setSources((prev) => prev.map((item) => item.id === source.id ? { ...item, status: "Gotowe" } : item))}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center gap-2"><Play className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{tr("Test odpowiedzi", "Проверка ответа")}</h3></div>
          <p className="mb-3 text-xs text-muted-foreground">{tr("Sprawdź, czy bot znajduje odpowiedź w aktywnej bazie przed publikacją zmian.", "Проверьте, находит ли бот ответ в активной базе до публикации изменений.")}</p>
          <div className="flex gap-2">
            <Input value={testQuery} onChange={(event) => setTestQuery(event.target.value)} placeholder={tr("Np. jakie są godziny otwarcia?", "Например: какие часы работы?")} />
            <Button variant="secondary" disabled={!testQuery.trim()} onClick={() => setTestAnswer(language === "ru" ? "Наши клиники открыты с понедельника по пятницу с 8:00 до 20:00, в субботу — с 9:00 до 15:00." : INITIAL_KB.find((item) => item.question.toLowerCase().includes("godziny"))?.answer ?? "Nie znaleziono pewnej odpowiedzi — przekaż rozmowę operatorowi.")}>{tr("Testuj", "Проверить")}</Button>
          </div>
          {testAnswer && <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed"><span className="font-medium">{tr("Odpowiedź bota", "Ответ бота")}:</span> {testAnswer}</div>}
        </div>

        {showForm && (
          <div className="mb-4 space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("settings_kb_question")}</Label>
              <Input
                value={draft.question}
                onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("settings_kb_answer")}</Label>
              <Textarea
                value={draft.answer}
                onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
                className="min-h-20 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("settings_kb_category")}</Label>
              <Input
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="h-8 w-40 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={saveArticle}>
                {t("save")}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {articles.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{t("settings_kb_empty")}</p>
          ) : (
            articles.map((article) => (
              <div key={article.id} className="rounded-md border border-border p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{article.question}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => startEdit(article)}
                      aria-label={t("settings_kb_edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => deleteArticle(article.id)}
                      aria-label={t("settings_kb_delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{article.answer}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {article.category}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {article.uses} {t("settings_kb_used")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
