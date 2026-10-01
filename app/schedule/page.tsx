"use client"

import { PageShell } from "@/components/crm/page-shell"
import { ScheduleList } from "@/components/crm/schedule-list"

export default function SchedulePage() {
  return (
    <PageShell title="Harmonogram" subtitle="Najbliższe połączenia, powtórne próby i wizyty">
      <ScheduleList />
    </PageShell>
  )
}
