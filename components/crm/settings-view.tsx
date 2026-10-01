"use client"

import { useState } from "react"
import Link from "next/link"
import { BOARD_LABEL_KEYS, BOARD_COLUMNS, COLOR_CLASSES } from "@/lib/crm/boards"
import { CLINICS, PROCEDURES, DOCTORS, CLINIC_TONE } from "@/lib/crm/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2, Plus, Bot, Database, FileText, Globe2, Play, RefreshCw, ShieldCheck, Check, Eye, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/crm/role-context"
import { ROLE_PROFILES, ROLE_ORDER, type RoleId } from "@/lib/crm/roles"
import { useLanguage } from "@/lib/crm/language-context"
import { useUserDirectory } from "@/lib/crm/user-directory"

type AccessLevel = "full" | "view" | "none"

interface PermissionRow {
  id: string
  label: string
  access: Record<RoleId, AccessLevel>
}

const PERMISSION_MATRIX: PermissionRow[] = [
  {
    id: "board",
    label: "Przeglądanie tablicy spraw",
    access: { operator: "full", patient_care: "full", team_leader: "full", clinic_manager: "full", marketing: "view", admin: "full" },
  },
  {
    id: "stage",
    label: "Zmiana etapu / przenoszenie spraw",
    access: { operator: "full", patient_care: "full", team_leader: "full", clinic_manager: "view", marketing: "none", admin: "full" },
  },
  {
    id: "assign",
    label: "Przypisywanie zadań i właścicieli",
    access: { operator: "none", patient_care: "view", team_leader: "full", clinic_manager: "full", marketing: "none", admin: "full" },
  },
  {
    id: "merge",
    label: "Scalanie i łączenie pacjentów",
    access: { operator: "none", patient_care: "none", team_leader: "view", clinic_manager: "full", marketing: "none", admin: "full" },
  },
  {
    id: "export",
    label: "Eksport danych pacjentów",
    access: { operator: "none", patient_care: "none", team_leader: "none", clinic_manager: "view", marketing: "view", admin: "full" },
  },
  {
    id: "reports",
    label: "Raporty i analityka",
    access: { operator: "none", patient_care: "view", team_leader: "full", clinic_manager: "full", marketing: "full", admin: "full" },
  },
  {
    id: "bot",
    label: "Konfiguracja bota i bazy wiedzy",
    access: { operator: "none", patient_care: "none", team_leader: "view", clinic_manager: "full", marketing: "none", admin: "full" },
  },
  {
    id: "users",
    label: "Zarządzanie użytkownikami i rolami",
    access: { operator: "none", patient_care: "none", team_leader: "view", clinic_manager: "none", marketing: "none", admin: "full" },
  },
]

function AccessIcon({ level }: { level: AccessLevel }) {
  if (level === "full") return <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" aria-label="Pełny dostęp" />
  if (level === "view") return <Eye className="mx-auto h-3.5 w-3.5 text-amber-600" aria-label="Tylko podgląd" />
  return <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" aria-label="Brak dostępu" />
}

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
    answer: "Kliniki PaNa Medica są otwarte od poniedziałku do piątku 8:00–20:00, w soboty 9:00–15:00.",
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
    answer: "PaNa Medica działa w modelu prywatnym — nie realizujemy świadczeń w ramach NFZ.",
    category: "Płatności",
    uses: 54,
  },
]

let kbSeq = INITIAL_KB.length

const INITIAL_SOURCES = [
  { id: "src-web", name: "pa-na.pl", type: "WWW", scope: "Wszystkie kliniki", items: 84, status: "Gotowe" },
  { id: "src-prices", name: "Cenniki i procedury", type: "Dokumenty", scope: "Według kliniki", items: 12, status: "Gotowe" },
  { id: "src-doctors", name: "Lekarze i specjalizacje", type: "Medical CRM", scope: "Według kliniki", items: 26, status: "Synchronizacja" },
]

export function SettingsView() {
  const { role, setRole } = useRole()
  const { t } = useLanguage()
  const { users } = useUserDirectory()

  const [botEnabled, setBotEnabled] = useState(true)
  const [botName, setBotName] = useState("PaNa Assistant")
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
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
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

      <section className="rounded-lg border border-border bg-card p-4">
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
              <Badge variant="secondary">{user.status}</Badge>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2 w-full" nativeButton={false} render={<Link href="/users">Zarządzaj użytkownikami i dostępem</Link>} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
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

      <section className="rounded-lg border border-border bg-card p-4">
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

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-1 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Role i uprawnienia</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Przegląd dostępu do kluczowych funkcji systemu w zależności od roli.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card py-2 pr-3 text-left font-medium text-muted-foreground">Funkcja</th>
                {ROLE_ORDER.map((roleId) => {
                  const profile = ROLE_PROFILES[roleId]
                  return (
                    <th key={roleId} className="px-2 py-2 text-center font-medium text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white",
                            profile.user.color,
                          )}
                        >
                          {profile.user.initials}
                        </div>
                        <span className="whitespace-nowrap">{t(profile.labelKey)}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="sticky left-0 bg-card py-2 pr-3 text-foreground">{row.label}</td>
                  {ROLE_ORDER.map((roleId) => (
                    <td key={roleId} className="px-2 py-2 text-center">
                      <AccessIcon level={row.access[roleId]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-emerald-600" /> Pełny dostęp
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-amber-600" /> Tylko podgląd
          </span>
          <span className="flex items-center gap-1.5">
            <Minus className="h-3 w-3 text-muted-foreground/40" /> Brak dostępu
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
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

      <section className="rounded-lg border border-border bg-card p-4">
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
                <h3 className="text-sm font-semibold">Źródła wiedzy bota</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Źródła używane do odpowiedzi. W prototypie synchronizacja i indeksowanie są emulowane.</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setSources((prev) => [...prev, { id: `src-${prev.length + 1}`, name: "Nowe źródło", type: "Dokument", scope: "Do konfiguracji", items: 0, status: "Szkic" }])}>
              <Plus className="h-3.5 w-3.5" />Dodaj źródło
            </Button>
          </div>
          <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5">
                {source.type === "WWW" ? <Globe2 className="h-4 w-4 text-sky-600" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{source.name}</p>
                  <p className="text-[11px] text-muted-foreground">{source.type} · {source.scope} · {source.items} elementów</p>
                </div>
                <Badge variant={source.status === "Gotowe" ? "secondary" : "outline"}>{source.status}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ponownie indeksuj" onClick={() => setSources((prev) => prev.map((item) => item.id === source.id ? { ...item, status: "Gotowe" } : item))}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center gap-2"><Play className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Test odpowiedzi</h3></div>
          <p className="mb-3 text-xs text-muted-foreground">Sprawdź, czy bot znajduje odpowiedź w aktywnej bazie przed publikacją zmian.</p>
          <div className="flex gap-2">
            <Input value={testQuery} onChange={(event) => setTestQuery(event.target.value)} placeholder="Np. jakie są godziny otwarcia?" />
            <Button variant="secondary" disabled={!testQuery.trim()} onClick={() => setTestAnswer(INITIAL_KB.find((item) => item.question.toLowerCase().includes("godziny"))?.answer ?? "Nie znaleziono pewnej odpowiedzi — przekaż rozmowę operatorowi.")}>Testuj</Button>
          </div>
          {testAnswer && <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed"><span className="font-medium">Odpowiedź bota:</span> {testAnswer}</div>}
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
