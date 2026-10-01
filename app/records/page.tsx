"use client"

import { PageShell } from "@/components/crm/page-shell"
import { RecordsTable } from "@/components/crm/records-table"
import { useLanguage } from "@/lib/crm/language-context"

export default function RecordsPage() {
  const { t } = useLanguage()

  return (
    <PageShell title={t("nav_records")} subtitle={t("page_records_subtitle")} noPadding>
      <RecordsTable />
    </PageShell>
  )
}
