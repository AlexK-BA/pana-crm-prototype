import { PageShell } from "@/components/crm/page-shell"
import { PatientProfile } from "@/components/crm/patient-profile"

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PageShell title="Profil pacjenta" subtitle="Pełna historia sprawy, interakcji i planu leczenia">
      <PatientProfile patientId={id} />
    </PageShell>
  )
}
