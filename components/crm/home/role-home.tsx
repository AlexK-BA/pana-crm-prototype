"use client"

import { useRole } from "@/lib/crm/role-context"
import { OperatorHome } from "@/components/crm/home/operator-home"
import { PatientCareHome } from "@/components/crm/home/patient-care-home"
import { TeamLeaderHome } from "@/components/crm/home/team-leader-home"
import { ClinicManagerHome } from "@/components/crm/home/clinic-manager-home"
import { MarketingHome } from "@/components/crm/home/marketing-home"
import { AdminHome } from "@/components/crm/home/admin-home"

export function RoleHome() {
  const { role } = useRole()

  switch (role) {
    case "operator":
      return <OperatorHome />
    case "patient_care":
      return <PatientCareHome />
    case "team_leader":
      return <TeamLeaderHome />
    case "clinic_manager":
      return <ClinicManagerHome />
    case "marketing":
      return <MarketingHome />
    case "admin":
      return <AdminHome />
    default:
      return <OperatorHome />
  }
}
