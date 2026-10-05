"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { ChannelIcon, type ChannelPlatform } from "@/components/crm/channel-icon"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useLanguage } from "@/lib/crm/language-context"

const ICON_CHANNELS: ChannelPlatform[] = ["instagram", "telegram", "whatsapp", "website", "phone"]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { openCase } = useCasePanel()
  const { cases, patients, identities } = useScopedEntityStore()
  const { hasPermission, canAccessRoute } = useAuthorization()
  const { tr } = useLanguage()
  const canViewCases = hasPermission("case:view")

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={tr("Paleta poleceń", "Палитра команд")} description={tr("Wyszukaj polecenie do uruchomienia...", "Найдите команду для запуска...")}>
      <CommandInput placeholder={tr("Szukaj spraw, pacjentów, numerów telefonu...", "Искать кейсы, пациентов, номера телефонов...")} />
      <CommandList>
        <CommandEmpty>{tr("Nie znaleziono wyników.", "Ничего не найдено.")}</CommandEmpty>
        <CommandGroup heading={tr("Nawigacja", "Навигация")}>
          <CommandItem onSelect={() => { router.push("/"); setOpen(false) }}>{tr("Strona główna", "Главная")}</CommandItem>
          {canAccessRoute("/board") && <CommandItem onSelect={() => { router.push("/board"); setOpen(false) }}>{tr("Tablica CRM", "Доска CRM")}</CommandItem>}
          {canAccessRoute("/inbox") && <CommandItem onSelect={() => { router.push("/inbox"); setOpen(false) }}>{tr("Skrzynka odbiorcza", "Входящие")}</CommandItem>}
        </CommandGroup>
        {canViewCases && <CommandGroup heading={tr("Sprawy", "Кейсы")}>
          {cases.slice(0, 12).map((engagementCase) => {
            const patient = patients.find((item) => item.id === engagementCase.patientId)
            const identity = identities.find((item) => item.id === engagementCase.contactIdentityId)
            const displayName = patient
              ? `${patient.firstName} ${patient.lastName}`
              : identity?.displayName ?? tr("Nierozpoznany kontakt", "Неизвестный контакт")
            const platform: ChannelPlatform = identity && ICON_CHANNELS.includes(identity.channel as ChannelPlatform)
              ? identity.channel as ChannelPlatform
              : "internal"

            return (
              <CommandItem
                key={engagementCase.id}
                value={`${displayName} ${identity?.value ?? ""} ${engagementCase.id}`}
                onSelect={() => {
                  openCase(engagementCase.id)
                  setOpen(false)
                }}
                className="gap-2"
              >
                <ChannelIcon platform={platform} className="h-4 w-4" />
                <span className="flex-1 truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground">{identity?.value}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>}
      </CommandList>
    </CommandDialog>
  )
}
