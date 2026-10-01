import { PageShell } from "@/components/crm/page-shell"
import { SettingsView } from "@/components/crm/settings-view"

export default function SettingsPage() {
  return (
    <PageShell title="Ustawienia" subtitle="Workspace, role, zespół, katalog klinik i etapy">
      <SettingsView />
    </PageShell>
  )
}
