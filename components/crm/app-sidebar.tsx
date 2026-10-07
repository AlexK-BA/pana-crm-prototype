"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/crm/role-context"
import { useLanguage } from "@/lib/crm/language-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"
import { BRAND_CONFIG } from "@/lib/crm/brand-config"
import { RoleSwitcher } from "@/components/crm/role-switcher"
import {
  LayoutDashboard,
  KanbanSquare,
  Inbox,
  CalendarClock,
  Stethoscope,
  Settings,
  ShieldCheck,
  Clock3,
  CalendarDays,
  Table2,
  BookOpen,
  UsersRound,
} from "lucide-react"
import { useAuthorization } from "@/lib/crm/authorization-context"

export function AppSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { role } = useRole()
  const { t, tr } = useLanguage()
  const { canAccessRoute } = useAuthorization()
  const profile = ROLE_PROFILES[role]

  const navItems = [
    { href: "/", label: t(profile.homeLabelKey), icon: LayoutDashboard },
    { href: "/board", label: t("nav_board"), icon: KanbanSquare },
    { href: "/inbox", label: t("nav_inbox"), icon: Inbox },
    { href: "/schedule", label: t("nav_schedule"), icon: CalendarClock },
    ...(role !== "marketing"
      ? [
          { href: "/waitlist", label: t("nav_waitlist"), icon: Clock3 },
          { href: "/calendar", label: t("nav_calendar"), icon: CalendarDays },
          { href: "/records", label: t("nav_records"), icon: Table2 },
        ]
      : []),
    ...(role === "admin" || role === "team_leader"
      ? [
          { href: "/audit", label: t("nav_audit"), icon: ShieldCheck },
          { href: "/docs", label: t("nav_docs"), icon: BookOpen },
        ]
      : []),
    ...(role === "admin" ? [{ href: "/users", label: tr("Użytkownicy", "Пользователи"), icon: UsersRound }] : []),
  ].filter((item) => canAccessRoute(item.href))

  return (
    <aside className={cn("w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar", mobile ? "flex h-full w-full" : "hidden md:flex")}>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">{BRAND_CONFIG.appName}</div>
          <div className="text-[11px] text-muted-foreground">
            {t(profile.labelKey)} {t("workspace_suffix")}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {canAccessRoute("/settings") && (
          <Link
            href="/settings"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
            {tr("Ustawienia", "Настройки")}
          </Link>
        )}
        <div className="mt-1">
          <RoleSwitcher />
        </div>
      </div>
    </aside>
  )
}
