import { PageShell } from "@/components/crm/page-shell"
import { PatientProfile } from "@/components/crm/patient-profile"

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PageShell title="Profil pacjenta" subtitle="Patient 360 · sprawy, zadania, komunikacje i Medical CRM">
      <PatientProfile patientId={id} />
    </PageShell>
  )
}
