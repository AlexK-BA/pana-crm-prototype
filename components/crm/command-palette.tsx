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

const ICON_CHANNELS: ChannelPlatform[] = ["instagram", "telegram", "whatsapp", "website", "phone"]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { openCase } = useCasePanel()
  const { cases, patients, identities } = useScopedEntityStore()
  const { hasPermission, canAccessRoute } = useAuthorization()
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
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Szukaj spraw, pacjentów, numerów telefonu..." />
      <CommandList>
        <CommandEmpty>Nie znaleziono wyników.</CommandEmpty>
        <CommandGroup heading="Nawigacja">
          <CommandItem onSelect={() => { router.push("/"); setOpen(false) }}>Strona główna</CommandItem>
          {canAccessRoute("/board") && <CommandItem onSelect={() => { router.push("/board"); setOpen(false) }}>Tablica CRM</CommandItem>}
          {canAccessRoute("/inbox") && <CommandItem onSelect={() => { router.push("/inbox"); setOpen(false) }}>Skrzynka odbiorcza</CommandItem>}
        </CommandGroup>
        {canViewCases && <CommandGroup heading="Sprawy">
          {cases.slice(0, 12).map((engagementCase) => {
            const patient = patients.find((item) => item.id === engagementCase.patientId)
            const identity = identities.find((item) => item.id === engagementCase.contactIdentityId)
            const displayName = patient
              ? `${patient.firstName} ${patient.lastName}`
              : identity?.displayName ?? "Nierozpoznany kontakt"
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
