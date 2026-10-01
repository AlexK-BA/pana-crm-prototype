"use client"

import { PageShell } from "@/components/crm/page-shell"
import { AuditLogView } from "@/components/crm/audit-log-view"
import { useLanguage } from "@/lib/crm/language-context"

export default function AuditPage() {
  const { t } = useLanguage()

  return (
    <PageShell title={t("nav_audit")} subtitle={t("page_audit_subtitle")}>
      <AuditLogView />
    </PageShell>
  )
}
