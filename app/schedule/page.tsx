"use client"

import { PageShell } from "@/components/crm/page-shell"
import { ScheduleList } from "@/components/crm/schedule-list"

export default function SchedulePage() {
  return (
    <PageShell title="Harmonogram" subtitle="Task Queue · następne działania, terminy i historia (zadania ≠ wizyty)">
      <ScheduleList />
    </PageShell>
  )
}
