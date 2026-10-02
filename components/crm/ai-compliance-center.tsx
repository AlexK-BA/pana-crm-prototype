"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, CircleAlert } from "lucide-react"
import { INITIAL_AI_COMPLIANCE_CONFIGURATIONS, assessComplianceReadiness, previewDraftTransparencyNotice } from "@/lib/crm/ai-compliance"
import { INITIAL_AI_CONVERSATION_POLICIES } from "@/lib/crm/ai-governance"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useLanguage } from "@/lib/crm/language-context"

const STATUS_LABELS = {
  draft: { pl: "Wersja robocza", ru: "Черновик" },
  published: { pl: "Opublikowana", ru: "Опубликована" },
  retired: { pl: "Wycofana", ru: "Снята с публикации" },
} as const

/** Read-only compliance overview; patients only ever see a published, DPO-approved configuration. */
export function AiComplianceCenter() {
  const { hasPermission } = useAuthorization()
  const { tr, language } = useLanguage()
  const [selectedId, setSelectedId] = useState(INITIAL_AI_COMPLIANCE_CONFIGURATIONS[0]?.id)
  if (!hasPermission("ai:manage")) return null

  const config = INITIAL_AI_COMPLIANCE_CONFIGURATIONS.find(item => item.id === selectedId) ?? INITIAL_AI_COMPLIANCE_CONFIGURATIONS[0]
  if (!config) return null
  const policy = INITIAL_AI_CONVERSATION_POLICIES.find(item => item.id === config.botPolicyId && item.version === config.botPolicyVersion)
  const readiness = assessComplianceReadiness(config, INITIAL_AI_CONVERSATION_POLICIES)
  const publishable = readiness.every(item => item.ok)

  return (
    <section className="space-y-4 rounded border p-4" aria-labelledby="ai-compliance-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-compliance-title" className="font-semibold">{tr("Zgodność AI i prywatność", "Соответствие AI и приватность")}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant={config.status === "published" ? "default" : "secondary"}>{STATUS_LABELS[config.status][language]}</Badge>
          <Badge variant="outline">{tr("informacja", "информация")} v{config.version} · {tr("polityka bota", "политика бота")} v{config.botPolicyVersion}</Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {tr("Pacjent zobaczy informację o AI wyłącznie po publikacji zatwierdzonej przez DPO. Dopóki konfiguracja jest roboczym szkicem, bot nie może jej wyświetlać.",
          "Пациент увидит информацию об AI только после публикации, одобренной DPO. Пока конфигурация — черновик, бот не может её показывать.")}
      </p>
      {INITIAL_AI_COMPLIANCE_CONFIGURATIONS.length > 1 && (
        <select aria-label={tr("Konfiguracja", "Конфигурация")} className="rounded border bg-background p-2 text-sm" value={config.id} onChange={event => setSelectedId(event.target.value)}>
          {INITIAL_AI_COMPLIANCE_CONFIGURATIONS.map(item => <option key={item.id} value={item.id}>{item.name} v{item.version}</option>)}
        </select>
      )}
      <ul className="grid gap-2 sm:grid-cols-2" aria-label={tr("Gotowość do publikacji", "Готовность к публикации")}>
        {readiness.map(item => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {item.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />}
            <span>{item.label}</span>
            <span className="sr-only">{item.ok ? tr("spełnione", "выполнено") : tr("do uzupełnienia", "требует заполнения")}</span>
          </li>
        ))}
      </ul>
      <p role="status" className="rounded-md bg-muted/50 p-3 text-sm">
        {publishable
          ? tr("Konfiguracja spełnia wymagania. Publikacja wymaga zapisu zatwierdzenia przez DPO.", "Конфигурация выполняет требования. Для публикации нужна запись об одобрении DPO.")
          : tr("Publikacja zablokowana: uzupełnij brakujące elementy i uzyskaj zatwierdzenie DPO.", "Публикация заблокирована: заполните недостающее и получите одобрение DPO.")}
      </p>
      {policy && (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">{tr("Podgląd wersji roboczej (niewidoczny dla pacjentów)", "Предпросмотр черновика (пациентам не виден)")}</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{previewDraftTransparencyNotice(config, policy, language)}</pre>
        </details>
      )}
    </section>
  )
}
