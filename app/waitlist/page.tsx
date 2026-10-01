"use client"

import { PageShell } from "@/components/crm/page-shell"
import { WaitlistView } from "@/components/crm/waitlist-view"
import { useLanguage } from "@/lib/crm/language-context"

export default function WaitlistPage() {
  const { t } = useLanguage()

  return (
    <PageShell title={t("nav_waitlist")} subtitle={t("page_waitlist_subtitle")} noPadding>
      <WaitlistView />
    </PageShell>
  )
}
