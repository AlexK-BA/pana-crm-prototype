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
import { CASES } from "@/lib/crm/data"
import { useCasePanel } from "@/lib/crm/panel-context"
import { ChannelIcon } from "@/components/crm/channel-icon"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { openCase } = useCasePanel()

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
          <CommandItem onSelect={() => { router.push("/board"); setOpen(false) }}>Tablica CRM</CommandItem>
          <CommandItem onSelect={() => { router.push("/inbox"); setOpen(false) }}>Skrzynka odbiorcza</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Sprawy">
          {CASES.slice(0, 12).map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.displayName} ${c.phone ?? ""} ${c.id}`}
              onSelect={() => {
                openCase(c.id)
                setOpen(false)
              }}
              className="gap-2"
            >
              <ChannelIcon platform={c.channelPlatform} className="h-4 w-4" />
              <span className="flex-1 truncate">{c.displayName}</span>
              <span className="text-xs text-muted-foreground">{c.phone}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
