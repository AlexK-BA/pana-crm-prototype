import { PageShell } from "@/components/crm/page-shell"
import { UserManagementView } from "@/components/crm/user-management-view"

export default function UsersPage() {
  return <PageShell title="Użytkownicy" subtitle="Konta, role, zakres klinik i operacje bezpieczeństwa"><UserManagementView /></PageShell>
}
