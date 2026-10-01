"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ROLE_PROFILES, type RoleId } from "./roles"

const STORAGE_KEY = "pana-crm-demo-role"

interface RoleContextValue {
  role: RoleId
  setRole: (role: RoleId) => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<RoleId>("operator")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && stored in ROLE_PROFILES) setRole(stored as RoleId)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, role)
  }, [role, hydrated])

  const value = useMemo(() => ({ role, setRole }), [role])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within RoleProvider")
  return ctx
}
