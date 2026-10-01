"use client"

import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CasePanelProvider } from "@/lib/crm/panel-context"
import { RoleProvider } from "@/lib/crm/role-context"
import { LanguageProvider } from "@/lib/crm/language-context"
import { EntityStoreProvider } from "@/lib/crm/entity-store"
import { CallProvider } from "@/lib/crm/call-context"
import { EngagementCaseDrawer } from "@/components/crm/engagement-case-drawer"
import { CommandPalette } from "@/components/crm/command-palette"
import { CallOverlay } from "@/components/crm/call-overlay"
import { UserDirectoryProvider } from "@/lib/crm/user-directory"
import { AuthorizationProvider } from "@/lib/crm/authorization-context"

export function CrmProviders({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <LanguageProvider>
        <EntityStoreProvider>
          <UserDirectoryProvider>
            <AuthorizationProvider>
            <TooltipProvider delay={200}>
              <CasePanelProvider>
                <CallProvider>
                  {children}
                  <EngagementCaseDrawer />
                  <CommandPalette />
                  <CallOverlay />
                </CallProvider>
              </CasePanelProvider>
            </TooltipProvider>
            </AuthorizationProvider>
          </UserDirectoryProvider>
        </EntityStoreProvider>
      </LanguageProvider>
    </RoleProvider>
  )
}
