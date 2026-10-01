"use client"

import { PageShell } from "@/components/crm/page-shell"
import { MigrationDocs } from "@/components/crm/migration-docs"
import { useLanguage } from "@/lib/crm/language-context"

export default function DocsPage() {
  const { t } = useLanguage()

  return (
    <PageShell title={t("nav_docs")} subtitle={t("page_docs_subtitle")}>
      <MigrationDocs />
    </PageShell>
  )
}
