"use client"

import { PageShell } from "@/components/crm/page-shell"
import { RoleHome } from "@/components/crm/home/role-home"
import { useRole } from "@/lib/crm/role-context"
import { useLanguage } from "@/lib/crm/language-context"
import { ROLE_PROFILES } from "@/lib/crm/roles"

export default function HomePage() {
  const { role } = useRole()
  const { t } = useLanguage()
  const profile = ROLE_PROFILES[role]

  return (
    <PageShell title={t(profile.homeLabelKey)} subtitle={`${t(profile.greetingKey)} · ${profile.user.name}`}>
      <RoleHome />
    </PageShell>
  )
}
