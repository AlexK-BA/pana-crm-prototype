"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useRole } from "@/lib/crm/role-context"
import { getClinic } from "@/lib/crm/catalog"
import type { SmsProviderConfiguration } from "@/lib/crm/entities"
import { formatDateTime } from "@/lib/crm/format"

export function SmsProviderSettings() {
  const { smsProviderConfigurations, currentUser } = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { role } = useRole()
  if (!hasPermission("sms:provider_manage")) return null
  const configurations = smsProviderConfigurations.filter((config) => role === "admin" || role === "team_leader"
    || Boolean(config.clinicId && currentUser.clinicIds.includes(config.clinicId)))
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">SMS · dostawcy i nadawcy</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">Stage 1 · wyłącznie emulacja. Zmiany obowiązują po zapisaniu; test nie wysyła SMS.</p>
      <div className="space-y-3">{configurations.map((config) => <ProviderCard key={config.id} config={config} />)}</div>
      <p className="mt-3 text-xs text-muted-foreground">Credentials: •••••••• · nie skonfigurowano w prototypie. Sekrety obsługuje wyłącznie przyszły backend; to pole nie zawiera klucza.</p>
    </section>
  )
}

function ProviderCard({ config }: { config: SmsProviderConfiguration }) {
  const { updateSmsProviderConfiguration, testSmsProviderConfiguration } = useScopedEntityStore()
  const [draft, setDraft] = useState({ name: config.name, providerType: config.providerType,
    senderValue: config.senderValue, enabled: config.enabled, defaultMessageText: config.defaultMessageText })
  const [notice, setNotice] = useState("")
  const dirty = Object.entries(draft).some(([key, value]) => config[key as keyof typeof draft] !== value)
  function save() {
    try { updateSmsProviderConfiguration(config.id, draft); setNotice("Zapisano konfigurację.") }
    catch (error) { setNotice(error instanceof Error ? error.message : "Błąd zapisu.") }
  }
  function test() {
    try { testSmsProviderConfiguration(config.id); setNotice("Wykonano test zapisanej konfiguracji emulatora.") }
    catch (error) { setNotice(error instanceof Error ? error.message : "Błąd testu.") }
  }
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{config.name}</h3>
        <Badge variant="outline">{config.clinicId ? getClinic(config.clinicId)?.name : "Global fallback"}</Badge>
        <Badge variant="secondary">Emulacja</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor={`${config.id}-name`}>Nazwa konfiguracji</Label>
          <Input id={`${config.id}-name`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
        <div className="space-y-1.5"><Label>Dostawca</Label>
          <Select value={draft.providerType} onValueChange={(value) => value && setDraft({ ...draft, providerType: value })}>
            <SelectTrigger aria-label={`Dostawca ${config.name}`}><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set(["emulator", "smsapi", "supervoip", draft.providerType])].map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label htmlFor={`${config.id}-sender`}>Nazwa lub numer nadawcy</Label>
          <Input id={`${config.id}-sender`} value={draft.senderValue} onChange={(event) => setDraft({ ...draft, senderValue: event.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} aria-label={`Aktywuj ${config.name}`} /><span className="text-sm">Aktywna konfiguracja</span></div>
      </div>
      <div className="mt-3 space-y-1.5"><Label htmlFor={`${config.id}-text`}>Domyślny tekst roboczy SMS</Label>
        <Textarea id={`${config.id}-text`} value={draft.defaultMessageText} onChange={(event) => setDraft({ ...draft, defaultMessageText: event.target.value })} /></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!dirty || !draft.name.trim() || !draft.senderValue.trim()} onClick={save}>Zapisz konfigurację</Button>
        <Button size="sm" variant="outline" disabled={dirty} onClick={test}>Testuj emulator</Button>
        {config.lastTestAt && <span className="text-xs text-muted-foreground">Test: {formatDateTime(config.lastTestAt)} · {config.lastTestStatus}</span>}
      </div>
      {notice && <p role="status" className="mt-2 text-xs">{notice}</p>}
    </div>
  )
}
