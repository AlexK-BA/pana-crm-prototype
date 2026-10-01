"use client"

import { CheckCircle2, MessageSquareText, PlugZap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useEntityStore } from "@/lib/crm/entity-store"
import { getClinic } from "@/lib/crm/catalog"
import type { SmsProviderType } from "@/lib/crm/entities"
import { getSmsProviderCapabilities } from "@/lib/crm/sms-service"
import { formatDateTime } from "@/lib/crm/format"

const PROVIDER_LABEL: Record<SmsProviderType, string> = {
  emulator: "Emulator",
  smsapi: "SMSAPI",
  supervoip: "SuperVoIP",
}

export function SmsProviderSettings() {
  const { smsProviderConfigurations, updateSmsProviderConfiguration, testSmsProviderConfiguration } = useEntityStore()

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">SMS · dostawcy i nadawcy</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Konfiguracja jest przypisana do kliniki. Interfejs pacjenta korzysta z jednego wewnętrznego SMS Service, niezależnie od wybranego dostawcy.
      </p>

      <div className="space-y-3">
        {smsProviderConfigurations.map((config) => (
          <div key={config.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{config.name}</p>
                  <Badge variant={config.enabled ? "secondary" : "outline"}>{config.enabled ? "Aktywny" : "Wyłączony"}</Badge>
                  {config.isDefault && <Badge variant="outline">Domyślny</Badge>}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {config.clinicId ? getClinic(config.clinicId)?.name : "Wszystkie kliniki bez własnej konfiguracji"}
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) => updateSmsProviderConfiguration(config.id, { enabled })}
                aria-label={`Aktywuj ${config.name}`}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dostawca</Label>
                <Select
                  value={config.providerType}
                  onValueChange={(value) => {
                    const providerType = value as SmsProviderType
                    updateSmsProviderConfiguration(config.id, { providerType, capabilities: getSmsProviderCapabilities(providerType) })
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nazwa lub numer nadawcy</Label>
                <Input
                  className="h-8 text-sm"
                  value={config.senderValue}
                  onChange={(event) => updateSmsProviderConfiguration(config.id, { senderValue: event.target.value })}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Wychodzące: tak</span>
              <span>·</span>
              <span>Przychodzące: {config.capabilities.inboundSms ? "tak" : "nie"}</span>
              <span>·</span>
              <span>Delivery reports: {config.capabilities.deliveryReports ? "tak" : "nie"}</span>
              <span>·</span>
              <span>2-way: {config.capabilities.twoWayMessaging ? "tak" : "nie"}</span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">
                {config.lastTestAt
                  ? <>Ostatni test: {formatDateTime(config.lastTestAt)} · {config.lastTestStatus === "success" ? "połączenie poprawne" : "błąd"}</>
                  : "Połączenie nie było jeszcze testowane w tej sesji."}
              </p>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => testSmsProviderConfiguration(config.id)}>
                {config.lastTestStatus === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PlugZap className="h-3.5 w-3.5" />}
                Testuj
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground">
        Prototyp nie przechowuje tokenów i nie wykonuje zewnętrznych wywołań. Dane logowania będą szyfrowane i obsługiwane wyłącznie po stronie backendu.
      </p>
    </section>
  )
}
