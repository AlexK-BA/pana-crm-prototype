import { PageShell } from "@/components/crm/page-shell"
import { TaskCalendar } from "@/components/crm/task-calendar"

export default function CalendarPage() {
  return (
    <PageShell title="Kalendarz zadań" subtitle="Zadania w widoku tygodniowym" noPadding>
      <TaskCalendar />
    </PageShell>
  )
}
