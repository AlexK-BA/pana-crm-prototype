import { PageShell } from "@/components/crm/page-shell"
import { TaskCalendar } from "@/components/crm/task-calendar"

export default function CalendarPage() {
  return (
    <PageShell title="Kalendarz zadań" titleRu="Календарь задач" subtitle="Zadania w widoku tygodniowym" subtitleRu="Задачи в недельном виде" noPadding>
      <TaskCalendar />
    </PageShell>
  )
}
