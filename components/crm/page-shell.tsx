import type { ReactNode } from "react"
import { AppSidebar } from "@/components/crm/app-sidebar"
import { AppTopbar } from "@/components/crm/app-topbar"

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
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar title={title} subtitle={subtitle} />
        <main className={noPadding ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto p-4 md:p-6"}>
          {children}
        </main>
      </div>
    </div>
  )
}
