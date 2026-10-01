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
import { useEntityStore } from "@/lib/crm/entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { ChannelIcon } from "@/components/crm/channel-icon"
import type { ChannelPlatform } from "@/lib/crm/types"
import { useRole } from "@/lib/crm/role-context"
import { canAccessRoute, hasPermission } from "@/lib/crm/permissions"

const ICON_CHANNELS: ChannelPlatform[] = ["instagram", "telegram", "whatsapp", "website", "phone"]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { openCase } = useCasePanel()
  const { cases, patients, identities } = useEntityStore()
  const { role } = useRole()
  const canViewCases = hasPermission(role, "case:view")

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
          {canAccessRoute(role, "/board") && <CommandItem onSelect={() => { router.push("/board"); setOpen(false) }}>Tablica CRM</CommandItem>}
          {canAccessRoute(role, "/inbox") && <CommandItem onSelect={() => { router.push("/inbox"); setOpen(false) }}>Skrzynka odbiorcza</CommandItem>}
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
