"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { AppSidebar } from "@/components/crm/app-sidebar"
import { AppTopbar } from "@/components/crm/app-topbar"
import { Button } from "@/components/ui/button"
import { useRole } from "@/lib/crm/role-context"
import { canAccessRoute } from "@/lib/crm/permissions"

export function PageShell({
  title,
  subtitle,
  children,
  noPadding,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  noPadding?: boolean
}) {
  const pathname = usePathname()
  const { role } = useRole()
  const allowed = canAccessRoute(role, pathname)
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar title={title} subtitle={subtitle} />
        <main className={noPadding ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto p-4 md:p-6"}>
          {allowed ? children : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
                <h2 className="mt-3 text-base font-semibold">Brak dostępu</h2>
                <p className="mt-2 text-sm text-muted-foreground">Twoja aktualna rola nie ma uprawnienia do tego obszaru. Próba wejścia bezpośrednim adresem nie omija RBAC.</p>
                <Button className="mt-4" nativeButton={false} render={<Link href="/">Wróć do pulpitu</Link>} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
