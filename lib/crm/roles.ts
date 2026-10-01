import type { DictionaryKey } from "./language-context"
import { getCatalogUserByRole } from "./user-catalog"

export type RoleId = "operator" | "patient_care" | "team_leader" | "clinic_manager" | "marketing" | "admin"

export interface RoleProfile {
  id: RoleId
  labelKey: DictionaryKey
  homeLabelKey: DictionaryKey
  titleKey: DictionaryKey
  descriptionKey: DictionaryKey
  greetingKey: DictionaryKey
  user: {
    id: string
    name: string
    initials: string
    color: string
  }
}

function roleUser(role: RoleId): RoleProfile["user"] {
  const { id, name, initials, color } = getCatalogUserByRole(role)
  return { id, name, initials, color }
}

export const ROLE_PROFILES: Record<RoleId, RoleProfile> = {
  operator: {
    id: "operator",
    labelKey: "role_operator_label",
    homeLabelKey: "role_operator_home",
    titleKey: "role_operator_title",
    descriptionKey: "role_operator_desc",
    greetingKey: "role_operator_greet",
    user: roleUser("operator"),
  },
  patient_care: {
    id: "patient_care",
    labelKey: "role_patient_care_label",
    homeLabelKey: "role_patient_care_home",
    titleKey: "role_patient_care_title",
    descriptionKey: "role_patient_care_desc",
    greetingKey: "role_patient_care_greet",
    user: roleUser("patient_care"),
  },
  team_leader: {
    id: "team_leader",
    labelKey: "role_team_leader_label",
    homeLabelKey: "role_team_leader_home",
    titleKey: "role_team_leader_title",
    descriptionKey: "role_team_leader_desc",
    greetingKey: "role_team_leader_greet",
    user: roleUser("team_leader"),
  },
  clinic_manager: {
    id: "clinic_manager",
    labelKey: "role_clinic_manager_label",
    homeLabelKey: "role_clinic_manager_home",
    titleKey: "role_clinic_manager_title",
    descriptionKey: "role_clinic_manager_desc",
    greetingKey: "role_clinic_manager_greet",
    user: roleUser("clinic_manager"),
  },
  marketing: {
    id: "marketing",
    labelKey: "role_marketing_label",
    homeLabelKey: "role_marketing_home",
    titleKey: "role_marketing_title",
    descriptionKey: "role_marketing_desc",
    greetingKey: "role_marketing_greet",
    user: roleUser("marketing"),
  },
  admin: {
    id: "admin",
    labelKey: "role_admin_label",
    homeLabelKey: "role_admin_home",
    titleKey: "role_admin_title",
    descriptionKey: "role_admin_desc",
    greetingKey: "role_admin_greet",
    user: roleUser("admin"),
  },
}

export const ROLE_ORDER: RoleId[] = ["operator", "patient_care", "team_leader", "clinic_manager", "marketing", "admin"]
