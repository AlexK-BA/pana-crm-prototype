import type { CrmCase, Priority } from "./types"

/**
 * Approximate P0-P4 queue ranking based on the current single-entity data model
 * (CrmCase.priority + nextContactAt + board stage). This stands in for the full
 * Task-level SLA engine described in the master spec (§6) until Task becomes its
 * own entity with due_at/status lifecycle.
 */
const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export function isOverdue(c: CrmCase) {
  return !!c.nextContactAt && new Date(c.nextContactAt).getTime() < Date.now()
}

export function isDueToday(c: CrmCase) {
  if (!c.nextContactAt) return false
  const d = new Date(c.nextContactAt)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export function openTaskCount(c: CrmCase) {
  return c.tasks.filter((t) => !t.done).length
}

export function sortByUrgency(cases: CrmCase[]) {
  return [...cases].sort((a, b) => {
    const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a))
    if (overdueDiff !== 0) return overdueDiff
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (rankDiff !== 0) return rankDiff
    const aTime = a.nextContactAt ? new Date(a.nextContactAt).getTime() : Number.POSITIVE_INFINITY
    const bTime = b.nextContactAt ? new Date(b.nextContactAt).getTime() : Number.POSITIVE_INFINITY
    return aTime - bTime
  })
}

export interface PriorityTag {
  code: "P0" | "P1" | "P2" | "P3" | "P4"
  label: string
  tone: string
}

export function approximatePriority(c: CrmCase): PriorityTag {
  if (isOverdue(c)) return { code: "P1", label: "Przeterminowane", tone: "bg-red-500" }
  if (c.priority === "urgent") return { code: "P0", label: "Pilne", tone: "bg-red-500" }
  if (c.priority === "high") return { code: "P1", label: "Priorytet wysoki", tone: "bg-orange-500" }
  if (isDueToday(c)) return { code: "P2", label: "Na dziś", tone: "bg-amber-500" }
  if (c.boards.leads === "new") return { code: "P3", label: "Nowy lead", tone: "bg-sky-500" }
  return { code: "P4", label: "Kolejna próba", tone: "bg-slate-400" }
}
