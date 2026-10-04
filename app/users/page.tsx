import { PageShell } from "@/components/crm/page-shell"
import { UserManagementView } from "@/components/crm/user-management-view"

export default function UsersPage() {
  return <PageShell title="Użytkownicy" titleRu="Пользователи" subtitle="Konta, role, zakres klinik i operacje bezpieczeństwa" subtitleRu="Аккаунты, роли, доступ к клиникам и операции безопасности"><UserManagementView /></PageShell>
}
