import type { Task } from "./entities"

export const DEMO_REFERENCE_AT = "2026-09-25T12:00:00.000Z"
export const DEMO_REFERENCE_MS = Date.parse(DEMO_REFERENCE_AT)

const TASK_TIME_FIELDS = ["dueAt", "slaAt", "createdAt", "originalDueAt", "completedAt"] as const

function shiftIso(value: string | undefined, deltaMs: number) {
  if (!value) return value
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed + deltaMs).toISOString() : value
}

/**
 * Keeps the immutable seed dataset SSR-safe while making its operational
 * deadlines useful on every demo session. Only the initial seed tasks are
 * passed here; live/user-created records must never be rebased.
 */
export function rebaseDemoTasks(seedTasks: Task[], sessionNowMs: number): Task[] {
  if (!Number.isFinite(sessionNowMs)) return seedTasks.map((task) => ({ ...task }))
  const deltaMs = sessionNowMs - DEMO_REFERENCE_MS
  return seedTasks.map((task) => {
    const shifted = { ...task }
    for (const field of TASK_TIME_FIELDS) {
      const value = shiftIso(task[field], deltaMs)
      if (value) shifted[field] = value
    }
    return shifted
  })
}
