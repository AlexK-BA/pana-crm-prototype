"use client"

import { PageShell } from "@/components/crm/page-shell"
import { KanbanBoard } from "@/components/crm/kanban-board"
import { useLanguage } from "@/lib/crm/language-context"

export default function BoardPage() {
  const { t } = useLanguage()

  return (
    <PageShell title={t("nav_board")} subtitle={t("page_board_subtitle")} noPadding>
      <KanbanBoard />
    </PageShell>
  )
}
