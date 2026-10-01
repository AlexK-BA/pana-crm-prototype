"use client"

import { useMemo, useState } from "react"
import { RotateCcw, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { PERMISSION_DEFINITIONS } from "@/lib/crm/permissions"
import { ROLE_ORDER, ROLE_PROFILES, type RoleId } from "@/lib/crm/roles"

export function RolePermissionMatrix() {
  const [selectedRole, setSelectedRole] = useState<RoleId>("operator")
  const { rolePermissions, roleHasPermission, toggleRolePermission, resetRolePermissions } = useAuthorization()
  const groups = useMemo(() => [...new Set(PERMISSION_DEFINITIONS.map((item) => item.group))], [])
  const protectedRole = selectedRole === "admin"

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Role i uprawnienia</h2></div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">Rola jest pakietem atomowych uprawnień. Zakres klinik użytkownika pozostaje dodatkowym ograniczeniem danych.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as RoleId)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{ROLE_ORDER.map((role) => <SelectItem key={role} value={role}>{ROLE_PROFILES[role].id}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={protectedRole} onClick={() => resetRolePermissions(selectedRole)}><RotateCcw className="h-3.5 w-3.5" />Domyślne</Button>
        </div>
      </div>
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{ROLE_PROFILES[selectedRole].id}</span> · {rolePermissions[selectedRole].length} uprawnień{protectedRole && <Badge variant="outline" className="ml-2">Rola systemowa · pełny dostęp</Badge>}</div>
      <div className="grid gap-0 lg:grid-cols-2">
        {groups.map((group) => <div key={group} className="border-b border-border p-4 lg:odd:border-r"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3><div className="space-y-1">
          {PERMISSION_DEFINITIONS.filter((item) => item.group === group).map((permission) => <label key={permission.id} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-muted/40"><span className="min-w-0"><span className="block text-sm font-medium">{permission.label}</span><span className="block text-[11px] text-muted-foreground">{permission.description} · <code>{permission.id}</code></span></span><Switch checked={roleHasPermission(selectedRole, permission.id)} disabled={protectedRole} onCheckedChange={() => toggleRolePermission(selectedRole, permission.id)} /></label>)}
        </div></div>)}
      </div>
      <div className="bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">Prototyp stosuje zmiany natychmiast w bieżącej sesji. Produkcyjnie wersje macierzy będą przechowywane po stronie backendu, audytowane i egzekwowane w każdym API.</div>
    </section>
  )
}
