"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/crm/role-context"
import { useLanguage } from "@/lib/crm/language-context"
import { ROLE_ORDER, ROLE_PROFILES } from "@/lib/crm/roles"
import { cn } from "@/lib/utils"

export function RoleSwitcher() {
  const { role, setRole } = useRole()
  const { t, language } = useLanguage()
  const active = ROLE_PROFILES[role]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent/60">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                active.user.color,
              )}
            >
              {active.user.initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-medium text-sidebar-foreground">{active.user.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{t(active.titleKey)}</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
            Demo · przełącz rolę
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLE_ORDER.map((id) => {
            const profile = ROLE_PROFILES[id]
            return (
              <DropdownMenuItem key={id} onClick={() => setRole(id)} className="flex items-start gap-2 py-2">
                <div
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                    profile.user.color,
                  )}
                >
                  {profile.user.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {t(profile.labelKey)}
                    {id === role && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{t(profile.descriptionKey)}</p>
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
