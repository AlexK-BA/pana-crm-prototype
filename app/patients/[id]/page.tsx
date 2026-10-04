import { PageShell } from "@/components/crm/page-shell"
import { PatientProfile } from "@/components/crm/patient-profile"

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PageShell title="Profil pacjenta" titleRu="Профиль пациента" subtitle="Patient 360 · sprawy, zadania, komunikacje i Medical CRM" subtitleRu="Patient 360 · кейсы, задачи, коммуникации и Medical CRM">
      <PatientProfile patientId={id} />
    </PageShell>
  )
}
