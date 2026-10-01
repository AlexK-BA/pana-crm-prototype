import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScreenRow {
  screen: string
  route: string
  state: "as_is" | "to_be"
  note: string
}

const SCREENS: ScreenRow[] = [
  { screen: "Moja kolejka / Home", route: "/", state: "to_be", note: "Task/EngagementCase model, per-rola widoki" },
  { screen: "Kanban Board", route: "/board", state: "to_be", note: "Leads · Deals · Patients na EngagementCase" },
  { screen: "Audit Log", route: "/audit", state: "to_be", note: "AuditEvent z entity-store, live diff before/after" },
  { screen: "Lista oczekujących", route: "/waitlist", state: "to_be", note: "EngagementCase.status === waiting" },
  { screen: "Kalendarz zadań", route: "/calendar", state: "to_be", note: "Task.dueAt w widoku tygodniowym" },
  { screen: "Wszystkie rekordy", route: "/records", state: "to_be", note: "Tabela EngagementCase z filtrami i widokami" },
  { screen: "Skrzynka (Inbox)", route: "/inbox", state: "to_be", note: "useEntityStore/Interaction — każda odpowiedź trafia do Case i Audit Log" },
  { screen: "Harmonogram", route: "/schedule", state: "to_be", note: "Widok Task.dueAt z entity-queue, wspólny z Kalendarzem i Queue" },
  { screen: "Ustawienia", route: "/settings", state: "to_be", note: "Konfiguracja dostawców SMS oraz katalog klinik/procedur" },
]

export function MigrationDocs() {
  const asIsCount = SCREENS.filter((s) => s.state === "as_is").length
  const toBeCount = SCREENS.filter((s) => s.state === "to_be").length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Migracja modelu zakończona</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">
              Płaski model <code className="rounded bg-muted px-1 py-0.5 text-xs">CrmCase</code>, tablica
              <code className="rounded bg-muted px-1 py-0.5 text-xs">CASES</code> i przybliżony
              <code className="rounded bg-muted px-1 py-0.5 text-xs">queue.ts</code> zostały usunięte. Aktywne ekrany nie czytają
              już równoległego zestawu danych.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Ekrany pozostające na legacy: {asIsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aktywny model prototypu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">
              Rozdzielone encje (<code className="rounded bg-muted px-1 py-0.5 text-xs">lib/crm/entities.ts</code>):{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">Patient</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">EngagementCase</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">Task</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">Interaction/Call</code> i{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">AuditEvent</code>. Wszystko żyje w jednym{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">EntityStoreProvider</code>, więc zmiana jest natychmiast
              widoczna na każdym ekranie i trafia do audit logu.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Aktywne ekrany: {toBeCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stan migracji per ekran</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Ekran</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Stan</th>
                <th className="px-3 py-2 font-medium">Uwaga</th>
              </tr>
            </thead>
            <tbody>
              {SCREENS.map((s) => (
                <tr key={s.route} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{s.screen}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{s.route}</td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        s.state === "to_be"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700",
                      )}
                    >
                      {s.state === "to_be" ? "TO-BE" : "AS-IS"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ścieżka migracji</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              CrmCase (usunięty)
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">rozbicie na encje</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Patient + EngagementCase + Task
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Wszystkie ekrany operacyjne czytają z <code className="rounded bg-muted px-1 py-0.5 text-xs">EntityStoreProvider</code>.
            Odpowiedź tworzy Interaction i wpis w Audit Log, a Harmonogram, Kalendarz i Queue czytają te same Task. Użytkownicy,
            role i numery wewnętrzne korzystają ze wspólnych identyfikatorów <code className="rounded bg-muted px-1 py-0.5 text-xs">usr-*</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
