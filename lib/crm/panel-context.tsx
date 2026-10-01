"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

interface PanelContextValue {
  activeCaseId: string | null
  openCase: (id: string) => void
  closeCase: () => void
}

const PanelContext = createContext<PanelContextValue | null>(null)

export function CasePanelProvider({ children }: { children: ReactNode }) {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)

  const openCase = useCallback((id: string) => setActiveCaseId(id), [])
  const closeCase = useCallback(() => setActiveCaseId(null), [])

  const value = useMemo(() => ({ activeCaseId, openCase, closeCase }), [activeCaseId, openCase, closeCase])

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}

export function useCasePanel() {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error("useCasePanel must be used within CasePanelProvider")
  return ctx
}
