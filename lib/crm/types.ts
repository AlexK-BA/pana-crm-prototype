export type BoardId = "leads" | "deals" | "patients"

export type ChannelPlatform =
  | "instagram"
  | "telegram"
  | "whatsapp"
  | "website"
  | "phone"
  | "internal"

export type Priority = "urgent" | "high" | "normal" | "low"

export type Qualification = "qualified" | "unqualified" | "undefined"

export interface BoardColumn {
  id: string
  label: string
  /** dictionary key used to render this column's label in the active UI language */
  labelKey: import("./language-context").DictionaryKey
  /** tailwind color token used for the stage dot + card accent */
  color: "rose" | "amber" | "violet" | "orange" | "red" | "slate" | "emerald" | "sky"
}

export interface Task {
  id: string
  title: string
  done: boolean
  due?: string
  assignee: string
}

export interface TimelineEvent {
  id: string
  type: "call" | "chat" | "status" | "note" | "task"
  at: string
  text: string
  author?: string
}

export interface CrmCase {
  id: string
  title: string
  displayName: string
  phone?: string
  channelType: "Chat" | "Call" | "Web Form" | "Personal Account"
  channelPlatform: ChannelPlatform
  service?: string
  doctor?: string
  qualification: Qualification
  priority: Priority
  tags: string[]
  assignedTo?: string
  nextContactAt?: string
  lastActivityAt: string
  createdAt: string
  clinic: "Pana Comfort" | "Pana Medica"
  boards: Partial<Record<BoardId, string>>
  tasks: Task[]
  notes: string
  timeline: TimelineEvent[]
  unread?: number
  lastMessage?: string
}

export interface Operator {
  id: string
  name: string
  initials: string
  color: string
}
