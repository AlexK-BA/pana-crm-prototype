"use client"

import Link from "next/link"
import { ArrowRight, Building2, ListChecks, Plug, ShieldCheck, Users } from "lucide-react"
import { ROLE_ORDER, ROLE_PROFILES } from "@/lib/crm/roles"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { CLINICS } from "@/lib/crm/catalog"
import { useLanguage } from "@/lib/crm/language-context"
import { formatRelative } from "@/lib/crm/format"
import { cn } from "@/lib/utils"

const ADMIN_SECTIONS = [
  { icon: Building2, title: ["Kliniki i lekarze", "Клиники и врачи"], detail: [`${CLINICS.length} kliniki`, `${CLINICS.length} клиники`] },
  { icon: ListChecks, title: ["Reguły kolejek P0–P4", "Правила очередей P0–P4"], detail: ["SLA i auto-przejścia", "SLA и автопереходы"] },
  { icon: Plug, title: ["Integracje", "Интеграции"], detail: ["Yeastar, Instagram, WhatsApp, Medical CRM", "Yeastar, Instagram, WhatsApp, Medical CRM"] },
  { icon: ShieldCheck, title: ["Audit log", "Журнал аудита"], detail: ["Zmiany danych i statusów", "Изменения данных и статусов"] },
]

const AUDIT_SUMMARY_RU: Record<string, string> = {
  "Sprawa z listy oczekujących przeniesiona do aktywnego callbacku": "Заявка из списка ожидания переведена в активный обратный звонок",
  "Team Leader zmienił przypisanie": "Тимлид изменил назначение",
  "Status zmieniony": "Статус изменён",
  "Wykryto konflikt danych z Medical CRM (nazwisko)": "Обнаружен конфликт данных с Medical CRM (фамилия)",
  "Eskalacja P0 utworzona ręcznie": "Эскалация P0 создана вручную",
  "Przypisano po rozpoczęciu obsługi": "Назначено после начала обработки",
}

export function AdminHome() {
  const { auditEvents, cases, identities } = useScopedEntityStore()
  const { users } = useUserDirectory()
  const { language, t, tr } = useLanguage()
  const caseIdentityIds = new Set(cases.map((item) => item.contactIdentityId))
  const channels = new Set(identities.filter((item) => caseIdentityIds.has(item.id)).map((item) => item.channel))
  const recentAudit = [...auditEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("Sprawy w systemie", "Кейсы в системе")} value={cases.length} />
        <Stat label={tr("Użytkownicy", "Пользователи")} value={users.length} />
        <Stat label={tr("Kliniki", "Клиники")} value={CLINICS.length} />
        <Stat label={tr("Podłączone kanały", "Подключённые каналы")} value={channels.size} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-medium text-foreground">{tr("Użytkownicy i role", "Пользователи и роли")}</h3></div>
            <Link href="/users" className="text-xs font-medium text-primary hover:underline">{tr("Zarządzaj", "Управление")}</Link>
          </div>
          <div className="divide-y divide-border">
            {ROLE_ORDER.map((id) => {
              const profile = ROLE_PROFILES[id]
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                      profile.user.color,
                    )}
                  >
                    {profile.user.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{profile.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t(profile.titleKey)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {t(profile.labelKey)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-foreground">{tr("Obszary administracji", "Разделы администрирования")}</h3>
          </div>
          <div className="divide-y divide-border">
            {ADMIN_SECTIONS.map((s) => (
              <div key={s.title[0]} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.title[language === "ru" ? 1 : 0]}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.detail[language === "ru" ? 1 : 0]}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">{tr("Ostatnie zdarzenia (audit)", "Последние события (аудит)")}</h3>
          <Link
            href="/audit"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {tr("Pełny dziennik", "Полный журнал")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentAudit.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tr("Brak zdarzeń audytowych.", "Событий аудита нет.")}</p>
          ) : (
            recentAudit.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate text-foreground">{language === "ru" ? AUDIT_SUMMARY_RU[e.summary] ?? e.summary : e.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(e.at, language)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
