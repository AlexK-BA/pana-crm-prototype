import { PageShell } from "@/components/crm/page-shell"
import { SettingsView } from "@/components/crm/settings-view"

export default function SettingsPage() {
  return (
    <PageShell title="Ustawienia" titleRu="Настройки" subtitle="Workspace, role, zespół, katalog klinik i etapy" subtitleRu="Workspace, роли, команда, каталог клиник и этапы">
      <SettingsView />
    </PageShell>
  )
}
